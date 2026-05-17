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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Upload klasörünü yoksa oluştur (avatar gibi alt klasörler runtime'da
    # üretilir, ama parent dir mount sırasında var olmalı)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Sporthink KPI Dashboard API",
    version="0.1.0",
    docs_url="/api/docs",
    # FastAPI default ReDoc CDN URL'i (redoc@next) jsdelivr'de 404 dönüyor.
    # Default'u kapatıp aşağıda Redocly'nin resmi CDN'i ile manuel serve.
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


@app.get("/api/redoc", include_in_schema=False, response_class=HTMLResponse)
async def custom_redoc_html() -> HTMLResponse:
    return get_redoc_html(
        openapi_url="/api/openapi.json",
        title=f"{app.title} - ReDoc",
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


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "healthy", "env": settings.app_env}


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"name": "sporthink-api", "docs": "/api/docs"}
