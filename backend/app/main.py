from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.config import settings
from app.core.exceptions import register_exception_handlers

API_DESCRIPTION = """
Sporthink Pazarlama ve E-Ticaret KPI Dashboard'unun backend REST API'sidir.
GA4, Meta Ads, Google Ads ve e-ticaret verilerini tek noktada toplar; 31 KPI
ile pazarlama ve satis performansini ozetler.

## Genel Kurallar

* **Versiyonlama:** Tum is endpoint'leri `/api/v1` altinda gruplanir.
* **Yanit zarfi:** Basarili yanitlar `{ "success": true, "data": ... }`,
  hatalar `{ "success": false, "error": { "code", "message", ... } }`
  bicimindedir. Sayfali listelerde ek olarak `pagination` alani doner.
* **Kimlik dogrulama:** Endpoint'lerin buyuk cogunlugu `Authorization: Bearer
  <access_token>` basligi ister. Refresh token httpOnly cookie ile yonetilir,
  yanit govdesinde yer almaz.
* **Yetkilendirme:** Her korumali endpoint, rol bazli izin (RBAC) kontrolunden
  gecer. Yetersiz izin 403 (`PERMISSION_DENIED`) ile sonuclanir.
* **Para birimi:** Tum tutarlar TRY cinsindendir.
* **Zaman:** Tarih ve saatler API'de UTC ve ISO 8601 bicimindedir
  (ornek: `2026-05-03T14:30:00Z`).
"""


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Upload klasörünü yoksa oluştur (avatar gibi alt klasörler runtime'da
    # üretilir, ama parent dir mount sırasında var olmalı)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


# OpenAPI etiket (tag) aciklamalari. Her grup Swagger ve ReDoc'ta bu sirayla
# ve bu aciklamalarla listelenir.
TAGS_METADATA = [
    {
        "name": "auth",
        "description": (
            "Kimlik dogrulama ve oturum yonetimi: giris, token yenileme, cikis, "
            "profil bilgileri, sifre degistirme, sifre sifirlama ve davet akisi."
        ),
    },
    {
        "name": "dashboard",
        "description": (
            "Dashboard sayfalari icin KPI, grafik ve tablo verisi. Genel ozet, "
            "trafik, reklam (Meta/Google), e-ticaret, kampanya, funnel, kohort, "
            "urun, musteri ve kanal analizi endpoint'lerini icerir. Tum sorgular "
            "tarih araligi ve karsilastirma periyodu parametresi alir."
        ),
    },
    {
        "name": "filters",
        "description": (
            "Cok secimli filtre ve segment kutulari icin referans listeler: "
            "kanal, cihaz, sehir, kategori, marka, odeme yontemi ve siparis durumu."
        ),
    },
    {
        "name": "imports",
        "description": (
            "CSV veri yukleme akisi: desteklenen veri kaynaklari, on izleme, "
            "yukleme/isleme, gecmis listesi, detay ve hata raporu indirme."
        ),
    },
    {
        "name": "reports",
        "description": (
            "PDF rapor uretimi: secilebilir bolumler, async uretim istegi "
            "(Celery), gecmis raporlar, durum sorgulama ve dosya indirme."
        ),
    },
    {
        "name": "users",
        "description": (
            "Kullanici yonetimi: listeleme, detay, davet ile olusturma, "
            "guncelleme, silme ve admin tarafindan sifre sifirlama."
        ),
    },
    {
        "name": "roles",
        "description": (
            "Rol ve izin (RBAC) yonetimi: rol CRUD islemleri ve 43 iznin "
            "4 kategori altinda gruplu listesi."
        ),
    },
    {
        "name": "saved-views",
        "description": (
            "Kullaniciya ozel kayitli gorunumler: bir dashboard sayfasinin "
            "filtre ve segment kombinasyonunu kaydetme, listeleme ve yonetme."
        ),
    },
    {
        "name": "admin",
        "description": (
            "Yonetimsel islemler: denetim (audit) kayitlari, kanal eslestirmeleri, "
            "aggregation tablolarinin yeniden hesaplanmasi ve veri disa aktarimi."
        ),
    },
    {
        "name": "notifications",
        "description": (
            "Oturum acan kullanicinin bildirim merkezi: listeleme, okunmamis "
            "sayisi, okundu isaretleme ve silme. Ek izin gerektirmez."
        ),
    },
    {
        "name": "meta",
        "description": (
            "Servis seviyesi yardimci uclar: saglik kontrolu (health) ve "
            "kok bilgi. Kimlik dogrulama gerektirmez."
        ),
    },
]


app = FastAPI(
    title="Sporthink KPI Dashboard API",
    version="1.0.0",
    description=API_DESCRIPTION,
    summary="Pazarlama ve e-ticaret KPI gostergelerini tek noktada sunan REST API.",
    openapi_tags=TAGS_METADATA,
    docs_url="/api/docs",
    # FastAPI default ReDoc CDN URL'i (redoc@next) jsdelivr'de 404 dönüyor.
    # Default'u kapatıp aşağıda Redocly'nin resmi CDN'i ile manuel serve.
    redoc_url=None,
    openapi_url="/api/openapi.json",
    contact={
        "name": "Sporthink KPI Dashboard",
        "url": "https://www.sporthink.com.tr",
    },
    license_info={"name": "Tum haklari saklidir"},
    lifespan=lifespan,
)


@app.get("/api/redoc", include_in_schema=False, response_class=HTMLResponse)
async def custom_redoc_html() -> HTMLResponse:
    return get_redoc_html(
        openapi_url="/api/openapi.json",
        title=f"{app.title} - API Dokumantasyonu",
        redoc_js_url="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js",
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Avatar ve diğer kullanıcı upload'ları statik servis edilir.
# `/uploads/...` altında dosyalar; cookie/auth gerektirmez (avatar URL'leri
# zaten kullanıcı bilgisinden gelir).
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount(
    "/uploads",
    StaticFiles(directory=settings.upload_dir),
    name="uploads",
)

app.include_router(api_router)


@app.get(
    "/health",
    tags=["meta"],
    summary="Saglik kontrolu",
    description=(
        "Servisin ayakta olup olmadigini bildirir. Yuk dengeleyici ve izleme "
        "araclari tarafindan kullanilir. Calisma ortami bilgisini de doner."
    ),
)
async def health() -> dict[str, str]:
    return {"status": "healthy", "env": settings.app_env}


@app.get(
    "/",
    tags=["meta"],
    summary="Kok bilgi",
    description="API'nin adini ve dokumantasyon adresini doner. Hizli erisim noktasidir.",
)
async def root() -> dict[str, str]:
    return {"name": "sporthink-api", "docs": "/api/docs"}
