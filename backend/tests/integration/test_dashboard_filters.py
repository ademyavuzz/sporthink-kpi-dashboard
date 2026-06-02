"""Dashboard segment/segment-cross filtreleri için additive guvence testleri.

Onceki adimda su dort endpoint'e opsiyonel (additive) filtre parametreleri
eklendi:

- GET /dashboard/ecom       → +cities, +devices (mevcut categories/brands/
                              statuses/payment_methods'a ek)
- GET /dashboard/cohort     → +genders, +age_groups, +cities
- GET /dashboard/products   → +categories, +brands
- GET /dashboard/customers  → +genders, +age_groups, +cities

backend/CLAUDE.md §16.2 geregi her degisen endpoint icin minimum:
  (a) filtre VERILINCE → 200 + sonuc daralir/degisir,
  (b) filtre VERILMEYINCE → onceki davranisla birebir ayni (ADDITIVE guvence:
      filtre None iken endpoint'in dondurdugu sayilar degismez ve bos-filtre
      ile filtresiz cagri ayni cikar),
  (c) yetkisiz → 403 PERMISSION_DENIED.

Test verisi dev MySQL'deki ornek veri setidir (5000 musteri, 14299 siparis;
order_date 2024-10-01..2025-03-31, first_order_date 2024-01-01..2025-01-11).
Filtre degerleri gercekte veride bulunan, sonucu kesin bir alt-kume yapan
degerler secilir (orn. gender=male, city=Istanbul, category=Ayakkabi).
Cache key'in filtre-duyarli oldugu da dolayli dogrulanir: filtresiz ve
bos-filtre cagrilari ayni; filtreli cagri farkli sonuc dondurur.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models import Role, User

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]

# Ornek veri setine gore gecerli filtre degerleri ve sirali aralik.
DATE_FROM = "2024-10-01"
DATE_TO = "2025-03-31"
# first_order_date / cohort tabani bu araliga dusmeli.
CUST_DATE_FROM = "2024-01-01"
CUST_DATE_TO = "2025-01-11"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


async def _non_system_role_id() -> int:
    """Izinleri olmayan (role_permissions bos) ilk non-system rolun id'si.

    Boyle bir rol yoksa tek seferlik 'test_no_perm' rolu olusturulur. Bu role
    bagli kullanici hicbir dashboard iznine sahip olmaz → tum dashboard
    endpoint'lerinde 403 alir (require_permission gate).
    """
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            select(Role.id).where(Role.is_system.is_(False)).order_by(Role.id).limit(1)
        )
        rid = r.scalar_one_or_none()
        if rid is not None:
            return int(rid)
        role = Role(name="test_no_perm", description="test", is_system=False)
        db.add(role)
        await db.commit()
        return role.id


@pytest.fixture
async def low_perm_token(client: AsyncClient) -> str:
    """Hicbir izni olmayan gecici kullanici icin access token.

    Kullanici non-system, izinsiz role bagli; test sonunda silinir. Boylece
    her dashboard endpoint'inde require_permission 403 dondurur.
    """
    role_id = await _non_system_role_id()
    # @example.com kullan: @test.local gibi reserved TLD'ler EmailStr'i 422 yapar.
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
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


@pytest.fixture
async def admin_headers(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> dict[str, str]:
    return await _auth_headers(client, super_admin_credentials)


def _kpi_value(payload: dict, kpi_field: str):
    return payload[kpi_field]["value"]


# =========================================================================== #
# /dashboard/ecom  — +cities, +devices
# =========================================================================== #


class TestEcomFilters:
    URL = "/api/v1/dashboard/ecom"
    BASE = {"date_from": DATE_FROM, "date_to": DATE_TO}

    async def test_unfiltered_baseline(self, client: AsyncClient, admin_headers: dict) -> None:
        """(b) Filtre verilmeyince: tum siparisler dahil; baz degerler stabil."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 200
        d = r.json()["data"]
        # Sirali aralikta tum gerceklesmis siparisler. Veri seti buyuk; pozitif olmali.
        assert d["orders_total"] > 0
        assert _kpi_value(d, "revenue") is not None

    async def test_unfiltered_equals_empty_filters(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) ADDITIVE: filtre None iken cikti, bos-liste filtreyle birebir ayni.

        Bos filtre (cities=[], devices=[]) FastAPI'de None gibi davranmali;
        sonuc filtresiz cagriyla ayni KPI/total uretmeli.
        """
        r_none = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_empty = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "cities": [], "devices": []},
        )
        assert r_none.status_code == 200 and r_empty.status_code == 200
        a, b = r_none.json()["data"], r_empty.json()["data"]
        assert a["orders_total"] == b["orders_total"]
        assert _kpi_value(a, "revenue") == _kpi_value(b, "revenue")
        assert _kpi_value(a, "orders") == _kpi_value(b, "orders")

    async def test_city_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) cities verilince: 200 + orders_total daralir (Istanbul ⊂ tum)."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_ist = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "cities": ["Istanbul"]}
        )
        assert r_ist.status_code == 200
        all_total = r_all.json()["data"]["orders_total"]
        ist_total = r_ist.json()["data"]["orders_total"]
        assert 0 < ist_total < all_total
        # by_city kirilimi sadece secili sehri icermeli.
        cities = {row["label"] for row in r_ist.json()["data"]["by_city"]}
        assert cities <= {"Istanbul"}

    async def test_device_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) devices verilince: 200 + orders_total daralir (mobile ⊂ tum)."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_mob = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "devices": ["mobile"]}
        )
        assert r_mob.status_code == 200
        all_total = r_all.json()["data"]["orders_total"]
        mob_total = r_mob.json()["data"]["orders_total"]
        assert 0 < mob_total < all_total
        devices = {row["label"] for row in r_mob.json()["data"]["by_device"]}
        assert devices <= {"mobile"}

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
# /dashboard/cohort  — +genders, +age_groups, +cities
# =========================================================================== #


class TestCohortFilters:
    URL = "/api/v1/dashboard/cohort"
    BASE = {"date_from": CUST_DATE_FROM, "date_to": CUST_DATE_TO}

    @staticmethod
    def _cohort_base_size(cells: list[dict]) -> int:
        """offset=0 hucrelerinin musteri sayilarini topla (kohort tabani proxy)."""
        return sum(c["customer_count"] for c in cells if c["month_offset"] == 0)

    async def test_unfiltered_baseline(self, client: AsyncClient, admin_headers: dict) -> None:
        """(b) Filtre verilmeyince: cohort hucreleri uretilir."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 200
        cells = r.json()["data"]["cells"]
        assert len(cells) > 0
        assert self._cohort_base_size(cells) > 0

    async def test_unfiltered_equals_empty_filters(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) ADDITIVE: bos-liste filtre, filtresiz cikti ile ayni hucreleri verir."""
        r_none = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_empty = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "genders": [], "age_groups": [], "cities": []},
        )
        assert r_none.status_code == 200 and r_empty.status_code == 200
        assert r_none.json()["data"]["cells"] == r_empty.json()["data"]["cells"]

    async def test_gender_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) genders verilince: 200 + kohort tabani daralir (male ⊂ tum)."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_male = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "genders": ["male"]}
        )
        assert r_male.status_code == 200
        all_size = self._cohort_base_size(r_all.json()["data"]["cells"])
        male_size = self._cohort_base_size(r_male.json()["data"]["cells"])
        assert 0 < male_size < all_size

    async def test_city_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) cities verilince: 200 + kohort tabani daralir (Istanbul ⊂ tum)."""
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_ist = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "cities": ["Istanbul"]}
        )
        assert r_ist.status_code == 200
        all_size = self._cohort_base_size(r_all.json()["data"]["cells"])
        ist_size = self._cohort_base_size(r_ist.json()["data"]["cells"])
        assert 0 < ist_size < all_size

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
# /dashboard/products  — +categories, +brands
# =========================================================================== #


class TestProductsFilters:
    URL = "/api/v1/dashboard/products"
    BASE = {"date_from": DATE_FROM, "date_to": DATE_TO}

    async def test_unfiltered_baseline(self, client: AsyncClient, admin_headers: dict) -> None:
        """(b) Filtre verilmeyince: birden fazla kategori dagilimda gorunur."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d["top_products"]) > 0
        assert len(d["by_category"]) >= 1

    async def test_unfiltered_equals_empty_filters(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) ADDITIVE: bos-liste filtre filtresiz ciktiyla birebir ayni."""
        r_none = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_empty = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "categories": [], "brands": []},
        )
        assert r_none.status_code == 200 and r_empty.status_code == 200
        a, b = r_none.json()["data"], r_empty.json()["data"]
        assert a["by_category"] == b["by_category"]
        assert a["by_brand"] == b["by_brand"]
        assert a["top_products"] == b["top_products"]

    async def test_category_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) categories verilince: 200 + by_category sadece secili kategori."""
        r = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "categories": ["Ayakkabı"]}
        )
        assert r.status_code == 200
        d = r.json()["data"]
        labels = {row["label"] for row in d["by_category"]}
        assert labels <= {"Ayakkabı"}
        assert len(d["by_category"]) >= 1

    async def test_brand_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) brands verilince: 200 + by_brand sadece secili marka."""
        r = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "brands": ["Nike"]}
        )
        assert r.status_code == 200
        d = r.json()["data"]
        brands = {row["label"] for row in d["by_brand"]}
        assert brands <= {"Nike"}
        # top_products marka filtresiyle daralmali (tum urunlerin alt kumesi).
        r_all = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert len(d["top_products"]) <= len(r_all.json()["data"]["top_products"])

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
# /dashboard/customers  — +genders, +age_groups, +cities
# =========================================================================== #


class TestCustomersFilters:
    URL = "/api/v1/dashboard/customers"
    BASE = {"date_from": CUST_DATE_FROM, "date_to": CUST_DATE_TO}

    async def test_unfiltered_baseline(self, client: AsyncClient, admin_headers: dict) -> None:
        """(b) Filtre verilmeyince: total_customers tum aktif tabani kapsar (5000)."""
        r = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        assert r.status_code == 200
        d = r.json()["data"]
        # Ornek veri setinde 5000 aktif musteri; filtre yokken tamami sayilir.
        assert int(_kpi_value(d, "total_customers")) == 5000
        # Cinsiyet dagilimi hem male hem female icermeli.
        genders = {row["label"] for row in d["by_gender"]}
        assert {"male", "female"} <= genders

    async def test_unfiltered_equals_empty_filters(
        self, client: AsyncClient, admin_headers: dict
    ) -> None:
        """(b) ADDITIVE: bos-liste filtre filtresiz ciktiyla birebir ayni KPI/dagilim."""
        r_none = await client.get(self.URL, headers=admin_headers, params=self.BASE)
        r_empty = await client.get(
            self.URL,
            headers=admin_headers,
            params={**self.BASE, "genders": [], "age_groups": [], "cities": []},
        )
        assert r_none.status_code == 200 and r_empty.status_code == 200
        a, b = r_none.json()["data"], r_empty.json()["data"]
        assert _kpi_value(a, "total_customers") == _kpi_value(b, "total_customers")
        assert _kpi_value(a, "new_customers") == _kpi_value(b, "new_customers")
        assert a["by_gender"] == b["by_gender"]
        assert a["by_city"] == b["by_city"]

    async def test_gender_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) genders verilince: total daralir (male=2437 < 5000), dagilim tek cinsiyet."""
        r = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "genders": ["male"]}
        )
        assert r.status_code == 200
        d = r.json()["data"]
        total = int(_kpi_value(d, "total_customers"))
        assert 0 < total < 5000
        genders = {row["label"] for row in d["by_gender"]}
        assert genders <= {"male"}

    async def test_age_group_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) age_groups verilince: total daralir, dagilim tek yas grubu."""
        r = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "age_groups": ["25-34"]}
        )
        assert r.status_code == 200
        d = r.json()["data"]
        total = int(_kpi_value(d, "total_customers"))
        assert 0 < total < 5000
        ages = {row["label"] for row in d["by_age_group"]}
        assert ages <= {"25-34"}

    async def test_city_filter_narrows(self, client: AsyncClient, admin_headers: dict) -> None:
        """(a) cities verilince: total daralir, sehir dagilimi tek sehir."""
        r = await client.get(
            self.URL, headers=admin_headers, params={**self.BASE, "cities": ["Istanbul"]}
        )
        assert r.status_code == 200
        d = r.json()["data"]
        total = int(_kpi_value(d, "total_customers"))
        assert 0 < total < 5000
        cities = {row["label"] for row in d["by_city"]}
        assert cities <= {"Istanbul"}

    async def test_unauthorized(self, client: AsyncClient, low_perm_token: str) -> None:
        """(c) Izinsiz kullanici → 403 PERMISSION_DENIED."""
        r = await client.get(
            self.URL,
            headers={"Authorization": f"Bearer {low_perm_token}"},
            params=self.BASE,
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "PERMISSION_DENIED"
