"""Meta/Google reklam sayfasi filtreleri icin additive guvence testleri.

Onceki adimda su iki dashboard endpoint'ine opsiyonel (additive) filtre
parametreleri eklendi:

- GET /dashboard/meta    → +campaigns, +objectives (meta_ads ham tablo)
- GET /dashboard/google  → +campaigns, +devices, +channel_types (google_ads ham)

Ayrica filtre acilir-liste (secenek) endpoint'leri eklendi:

- GET /filters/meta-campaigns       (meta_ads.campaign_name distinct)
- GET /filters/meta-objectives      (meta_ads.objective distinct)
- GET /filters/google-campaigns     (google_ads.campaign_name distinct)
- GET /filters/google-devices       (statik enum)
- GET /filters/google-channel-types (statik enum)

backend/CLAUDE.md §16.2 geregi her degisen endpoint icin minimum:
  (a) filtre VERILINCE → 200 + sonuc daralir (alt-kume),
  (b) filtre VERILMEYINCE → onceki davranisla BIREBIR ayni (ADDITIVE guvence:
      filtre None iken endpoint'in dondurdugu sayilar degismez ve bos-filtre
      ile filtresiz cagri ayni cikar — mevcut aggregate yolu korunur),
  (c) yetkisiz → 403 PERMISSION_DENIED.
Secenek endpoint'leri icin: 200 + liste donuyor.

Dogrulanmis dev veri seti gercekleri (bu testlerin dayandigi taban):
- meta_ads ham tablo doludur. SUM(spend)=216404.48 = filtresiz Meta toplami
  (birebir). 9 kampanya, 3 objective (OUTCOME_AWARENESS / OUTCOME_SALES /
  OUTCOME_TRAFFIC). Tek kampanya filtresi kesin alt-kume verir
  (SP_Meta_DPA_Genel spend=58535.91 < 216404.48).
- google_ads HAM tablo bu dev DB'de BOS olabilir. Filtresiz Google yolu
  aggregate tablolardan hesaplar (dolu); FILTRELI Google yolu ham google_ads
  tablosundan hesaplar. Bu yuzden Google "daralma" testleri veri-uyarlamali:
  ham tabloda satir varsa kesin alt-kume (0 < filtreli < toplam), yoksa
  filtreli toplam 0 olur (yine <= filtresiz). Her iki durumda da assert dogru.
  google_devices / google_channel_types statik enum oldugundan secenek
  endpoint'leri her zaman dolu liste doner; google_campaigns ham tabloya
  bagli oldugundan bos olabilir (list tipi yeterli).
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models import Campaign, GoogleAds, MetaAds, Role, User

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]

# Meta/Google ham veri seti araligi (date_start..date_stop / date).
DATE_FROM = "2024-10-01"
DATE_TO = "2025-03-31"

# Dev veride bulunan, sonucu kesin alt-kume yapan filtre degerleri.
META_CAMPAIGN = "SP_Meta_DPA_Genel"  # tek kampanya → spend << toplam
META_OBJECTIVE = "OUTCOME_SALES"
GOOGLE_DEVICE = "mobile"
GOOGLE_CHANNEL = "search"


# --------------------------------------------------------------------------- #
# Helpers / fixtures (mevcut test_dashboard_filters.py kaliplari ile ayni)
# --------------------------------------------------------------------------- #


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


async def _create_empty_role() -> int:
    """Garanti olarak HICBIR izni olmayan (role_permissions bos) yeni rol uretir.

    Mevcut rastgele bir non-system rol secmek yerine taze, izinsiz rol acariz:
    bu sayede secilen rol yanlislikla `dashboard.view` gibi bir izne sahip
    olamaz. Bu role bagli kullanici hem dashboard (META/GOOGLE_ADS_VIEW) hem de
    secenek (DASHBOARD_VIEW) endpoint'lerinde 403 alir (require_permission gate).
    Test sonunda silinir."""
    async with AsyncSessionLocal() as db:
        role = Role(
            name=f"test_no_perm_{uuid.uuid4().hex[:10]}",
            description="ad-filter integration test (no permissions)",
            is_system=False,
        )
        db.add(role)
        await db.commit()
        return role.id


async def _google_raw_has_data() -> bool:
    """google_ads ham tablo, secili aralikta satir iceriyor mu?

    Filtreli Google yolu ham tablodan hesaplar. Bu dev DB'de tablo bos olabilir
    (filtresiz yol aggregate'lerden gelir). Daralma testleri buna gore uyarlanir.
    """
    async with AsyncSessionLocal() as db:
        stmt = (
            select(func.count())
            .select_from(GoogleAds)
            .where(GoogleAds.date >= DATE_FROM, GoogleAds.date <= DATE_TO)
        )
        return int((await db.execute(stmt)).scalar_one() or 0) > 0


@pytest.fixture
async def low_perm_token(client: AsyncClient) -> str:
    """Hicbir izni olmayan gecici kullanici icin access token.

    Kullanici non-system, izinsiz role bagli; test sonunda silinir. Boylece
    her korumali endpoint'te require_permission 403 dondurur.
    """
    role_id = await _create_empty_role()
    # @example.com kullan: reserved TLD'ler EmailStr'i 422 yapar.
    email = f"lowperm_{uuid.uuid4().hex[:10]}@example.com"
    password = "Test1234!Strong"
    async with AsyncSessionLocal() as db:
        u = User(
            email=email,
            password_hash=hash_password(password),
            first_name="Low",
            last_name="Perm",
            role_id=role_id,
            is_active=True,
        )
        db.add(u)
        await db.commit()
        user_id = u.id

    try:
        r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        yield r.json()["data"]["access_token"]
    finally:
        # Once kullanici (FK), sonra olusturulan izinsiz rol silinir.
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.execute(delete(Role).where(Role.id == role_id))
            await db.commit()


@pytest.fixture
async def admin_headers(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> dict[str, str]:
    return await _auth_headers(client, super_admin_credentials)


def _kpi_value(payload: dict, kpi_field: str):
    return payload[kpi_field]["value"]


def _dec(v) -> Decimal:
    """KPI value (str/int/None) → Decimal; None'i 0 sayar (toplam karsilastirma)."""
    return Decimal(str(v)) if v is not None else Decimal(0)


# =========================================================================== #
# /dashboard/meta  — +campaigns, +objectives  (ham meta_ads, dolu)
# =========================================================================== #


class TestMetaFilters:
    URL = "/api/v1/dashboard/meta"
    BASE = {"date_from": DATE_FROM, "date_to": DATE_TO}

    async def test_unfiltered_baseline(self, client: AsyncClient, admin_headers: dict) -> None:
        """(b) Filtre verilmeyince: 9 kampanya + ham toplam (216404.48) doner."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert _kpi_value(d, "ad_spend") is not None
        # Dogrulanmis taban: ham meta_ads SUM(spend) = filtresiz Meta toplami.
        assert _dec(_kpi_value(d, "ad_spend")) == Decimal("216404.48")
        # 9 kampanya tablosu.
        assert len(d["campaigns"]) == 9

    async def test_unfiltered_equals_empty_filters(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) ADDITIVE: bos-liste filtre (campaigns=[], objectives=[]) filtresiz
        cagriyla BIREBIR ayni KPI/seri/tablo uretmeli (mevcut aggregate yolu korunur)."""
        r_none = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_empty = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "campaigns": [], "objectives": []},
        )
        assert r_none.status_code == 200 and r_empty.status_code == 200
        a, b = r_none.json()["data"], r_empty.json()["data"]
        assert _kpi_value(a, "ad_spend") == _kpi_value(b, "ad_spend")
        assert _kpi_value(a, "impressions") == _kpi_value(b, "impressions")
        assert _kpi_value(a, "clicks") == _kpi_value(b, "clicks")
        assert _kpi_value(a, "roas") == _kpi_value(b, "roas")
        assert a["campaigns"] == b["campaigns"]
        assert a["daily_series"] == b["daily_series"]

    async def test_campaign_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) campaigns verilince: 200 + spend daralir (tek kampanya ⊂ tum) +
        kampanya tablosu sadece secili kampanyayi icerir."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_one = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "campaigns": [META_CAMPAIGN]}
        )
        assert r_one.status_code == 200, r_one.text
        all_spend = _dec(_kpi_value(r_all.json()["data"], "ad_spend"))
        one = r_one.json()["data"]
        one_spend = _dec(_kpi_value(one, "ad_spend"))
        assert Decimal(0) < one_spend < all_spend
        names = {c["campaign_name"] for c in one["campaigns"]}
        assert names <= {META_CAMPAIGN}
        assert len(one["campaigns"]) >= 1

    async def test_objective_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) objectives verilince: 200 + spend daralir (OUTCOME_SALES ⊂ tum)."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_obj = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "objectives": [META_OBJECTIVE]}
        )
        assert r_obj.status_code == 200, r_obj.text
        all_spend = _dec(_kpi_value(r_all.json()["data"], "ad_spend"))
        obj_spend = _dec(_kpi_value(r_obj.json()["data"], "ad_spend"))
        assert Decimal(0) < obj_spend < all_spend

    async def test_unauthorized(self, client: AsyncClient, low_perm_token: str) -> None:
        """(c) Izinsiz kullanici → 403 PERMISSION_DENIED."""
        r = await client.get(
            self.URL,
            headers={"Authorization": f"Bearer {low_perm_token}"},
            params=self.BASE,
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "PERMISSION_DENIED"


# =========================================================================== #
# /dashboard/google  — +campaigns, +devices, +channel_types
# =========================================================================== #


class TestGoogleFilters:
    URL = "/api/v1/dashboard/google"
    BASE = {"date_from": DATE_FROM, "date_to": DATE_TO}

    async def test_unfiltered_baseline(self, client: AsyncClient, admin_headers: dict) -> None:
        """(b) Filtre verilmeyince: aggregate yolundan pozitif harcama + seri doner."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 200, r.text
        d = r.json()["data"]
        assert _dec(_kpi_value(d, "ad_spend")) > 0
        assert len(d["daily_series"]) > 0

    async def test_unfiltered_equals_empty_filters(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) ADDITIVE (EN KRITIK): bos-liste filtre, filtresiz cagriyla BIREBIR
        ayni. Filtre None iken mevcut aggregate yolu hic degismeden calismali."""
        r_none = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_empty = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "campaigns": [], "devices": [], "channel_types": []},
        )
        assert r_none.status_code == 200 and r_empty.status_code == 200
        a, b = r_none.json()["data"], r_empty.json()["data"]
        assert _kpi_value(a, "ad_spend") == _kpi_value(b, "ad_spend")
        assert _kpi_value(a, "impressions") == _kpi_value(b, "impressions")
        assert _kpi_value(a, "clicks") == _kpi_value(b, "clicks")
        assert _kpi_value(a, "roas") == _kpi_value(b, "roas")
        assert a["campaigns"] == b["campaigns"]
        assert a["channel_breakdown"] == b["channel_breakdown"]
        assert a["daily_series"] == b["daily_series"]

    async def test_device_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) devices verilince: 200 + spend daralir (mobile ⊂ tum).

        Veri-uyarlamali: ham google_ads doluysa 0 < mobile < toplam; bos ise
        filtreli yol ham tablodan 0 doner (yine <= toplam). Her halukarda
        request 200 ve filtreli <= filtresiz."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_dev = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "devices": [GOOGLE_DEVICE]}
        )
        assert r_dev.status_code == 200, r_dev.text
        all_spend = _dec(_kpi_value(r_all.json()["data"], "ad_spend"))
        dev_spend = _dec(_kpi_value(r_dev.json()["data"], "ad_spend"))
        if await _google_raw_has_data():
            assert Decimal(0) < dev_spend < all_spend
        else:
            assert dev_spend == Decimal(0) <= all_spend

    async def test_channel_type_filter_narrows(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(a) channel_types verilince: 200 + spend daralir (search ⊂ tum).

        Veri-uyarlamali (yukaridaki gerekce ile ayni)."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_cht = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "channel_types": [GOOGLE_CHANNEL]}
        )
        assert r_cht.status_code == 200, r_cht.text
        all_spend = _dec(_kpi_value(r_all.json()["data"], "ad_spend"))
        cht_spend = _dec(_kpi_value(r_cht.json()["data"], "ad_spend"))
        if await _google_raw_has_data():
            assert Decimal(0) < cht_spend < all_spend
        else:
            assert cht_spend == Decimal(0) <= all_spend

    async def test_unauthorized(self, client: AsyncClient, low_perm_token: str) -> None:
        """(c) Izinsiz kullanici → 403 PERMISSION_DENIED."""
        r = await client.get(
            self.URL,
            headers={"Authorization": f"Bearer {low_perm_token}"},
            params=self.BASE,
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "PERMISSION_DENIED"


# =========================================================================== #
# Secenek (filtre acilir-liste) endpoint'leri
# =========================================================================== #


class TestFilterOptionEndpoints:
    """Yeni secenek endpoint'leri: 200 + liste donuyor (+ izinsiz 403)."""

    META_CAMPAIGNS = "/api/v1/filters/meta-campaigns"
    META_OBJECTIVES = "/api/v1/filters/meta-objectives"
    GOOGLE_CAMPAIGNS = "/api/v1/filters/google-campaigns"
    GOOGLE_DEVICES = "/api/v1/filters/google-devices"
    GOOGLE_CHANNELS = "/api/v1/filters/google-channel-types"

    async def test_meta_campaigns_returns_list(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        r = await client.get(self.META_CAMPAIGNS, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert isinstance(data, list)
        # Ham meta_ads dolu → 9 distinct kampanya; bilinen kampanya listede.
        assert len(data) == 9
        assert META_CAMPAIGN in data

    async def test_meta_objectives_returns_list(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        r = await client.get(self.META_OBJECTIVES, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert isinstance(data, list)
        assert {"OUTCOME_AWARENESS", "OUTCOME_SALES", "OUTCOME_TRAFFIC"} <= set(data)

    async def test_google_campaigns_returns_list(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """Ham google_ads tabloya bagli; bos olabilir → tip kontrolu yeterli."""
        r = await client.get(self.GOOGLE_CAMPAIGNS, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["data"], list)

    async def test_google_devices_returns_list(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """Statik enum → her zaman dolu; bilinen cihazlari icermeli."""
        r = await client.get(self.GOOGLE_DEVICES, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert isinstance(data, list)
        assert {"mobile", "desktop", "tablet"} <= set(data)

    async def test_google_channel_types_returns_list(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """Statik enum → her zaman dolu; bilinen kanal turlerini icermeli."""
        r = await client.get(self.GOOGLE_CHANNELS, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert isinstance(data, list)
        assert {"search", "shopping", "performance_max", "display"} <= set(data)

    @pytest.mark.parametrize(
        "url",
        [
            META_CAMPAIGNS,
            META_OBJECTIVES,
            GOOGLE_CAMPAIGNS,
            GOOGLE_DEVICES,
            GOOGLE_CHANNELS,
        ],
    )
    async def test_option_endpoints_unauthorized(
        self, client: AsyncClient, low_perm_token: str, url: str
    ) -> None:
        """(c) Izinsiz kullanici tum secenek endpoint'lerinde → 403."""
        r = await client.get(url, headers={"Authorization": f"Bearer {low_perm_token}"})
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "PERMISSION_DENIED"


# =========================================================================== #
# /dashboard/campaign-detail  — ad_metrics tum kampanyayi toplamali (regresyon)
# =========================================================================== #


async def _campaign_master_exists(name: str) -> bool:
    """Master `campaigns` tablosunda bu adla (silinmemis) kayit var mi?

    campaign-detail endpoint'i master kaydi 404 ile arar; dev DB'de master
    seed edilmemisse test atlanir (raw meta_ads dolu olsa bile)."""
    async with AsyncSessionLocal() as db:
        stmt = (
            select(func.count())
            .select_from(Campaign)
            .where(Campaign.campaign_name == name, Campaign.deleted_at.is_(None))
        )
        return int((await db.execute(stmt)).scalar_one() or 0) > 0


async def _meta_raw_totals(name: str) -> tuple[Decimal, int, int, Decimal]:
    """Ham meta_ads icin (SUM spend, SUM impressions, SUM clicks, SUM
    action_values_purchase) — kampanya + tarih araligi. Endpoint ad_metrics'in
    DOGRU referansi budur (kullanicinin dogruladigi gercek toplam)."""
    async with AsyncSessionLocal() as db:
        stmt = select(
            func.coalesce(func.sum(MetaAds.spend), 0),
            func.coalesce(func.sum(MetaAds.impressions), 0),
            func.coalesce(func.sum(MetaAds.clicks), 0),
            func.coalesce(func.sum(MetaAds.action_values_purchase), 0),
        ).where(
            MetaAds.campaign_name == name,
            MetaAds.date_start >= DATE_FROM,
            MetaAds.date_start <= DATE_TO,
        )
        row = (await db.execute(stmt)).one()
        return (
            Decimal(str(row[0] or 0)),
            int(row[1] or 0),
            int(row[2] or 0),
            Decimal(str(row[3] or 0)),
        )


class TestCampaignDetailAdMetrics:
    """ad_metrics, secili tarih araligi icin kampanyanin TAMAMINI toplamali.

    Regresyon: eskiden ad_metrics kpi_campaign_aggregates'tan tek bir period
    slice'ini (`.first()`) cekiyordu; bu, UI tarih araligiyla eslesmedigi icin
    kucuk/yanlis bir deger (ornek SP_Meta_DPA_Genel: spend=307, ROAS=0) donerdi.
    Dogru deger ham meta_ads SUM'idir (spend=58535.91, ROAS=conv_value/spend)."""

    URL = "/api/v1/dashboard/campaign-detail"
    BASE = {"date_from": DATE_FROM, "date_to": DATE_TO}

    async def test_ad_metrics_sum_whole_campaign(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(a) ad_metrics = ham meta_ads SUM (tum kampanya), ROAS dogru hesaplanir."""
        if not await _campaign_master_exists(META_CAMPAIGN):
            pytest.skip("campaigns master kaydi seed edilmemis; campaign-detail atlandi")

        spend, impressions, clicks, conv_value = await _meta_raw_totals(META_CAMPAIGN)
        assert spend > 0, "test on-kosulu: ham meta_ads bu kampanya icin dolu olmali"

        r = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "campaign_name": META_CAMPAIGN},
        )
        assert r.status_code == 200, r.text
        am = r.json()["data"]["ad_metrics"]

        # Tek-slice degil, TUM kampanya: ham SUM ile birebir esit.
        assert _dec(am["spend"]) == spend
        assert int(am["impressions"]) == impressions
        assert int(am["clicks"]) == clicks
        assert _dec(am["conversions_value"]) == conv_value

        # ROAS = conversions_value / spend (frontend ham metriklerden turetir);
        # spend > 0 oldugundan oran pozitif ve regresyondaki 0,00x degildir.
        assert spend > 0
        assert conv_value / spend > Decimal(0)

    async def test_unauthorized(self, client: AsyncClient, low_perm_token: str) -> None:
        """(c) Izinsiz kullanici → 403 PERMISSION_DENIED."""
        r = await client.get(
            self.URL,
            headers={"Authorization": f"Bearer {low_perm_token}"},
            params={**self.BASE, "campaign_name": META_CAMPAIGN},
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "PERMISSION_DENIED"

    async def test_missing_campaign_param_validation(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) campaign_pk_id ve campaign_name ikisi de yoksa → 422 VALIDATION_ERROR."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"
