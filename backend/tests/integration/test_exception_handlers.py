"""Global exception handler conformance — `core/exceptions.py`.

Beklenmeyen exception düştüğünde response CLAUDE.md §6.2 envelope formatına
uymalı (`{success: false, error: {code, message}}`). Daha önce generic
Exception handler yokken FastAPI default 'Internal Server Error' plain text
döndürüyordu — bu test regresyona karşı koruma.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.exceptions import register_exception_handlers

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


def _app_with_boom_routes() -> FastAPI:
    """Test için izole bir FastAPI app — kasten exception fırlatan route'larla."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom/value")
    async def boom_value():
        raise ValueError("simulated runtime error")

    @app.get("/boom/key")
    async def boom_key():
        d: dict = {}
        return d["missing"]  # KeyError

    @app.get("/boom/zero")
    async def boom_zero():
        return 1 / 0  # ZeroDivisionError

    return app


async def _client(app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://testserver")


async def test_unhandled_value_error_returns_envelope_500() -> None:
    app = _app_with_boom_routes()
    async with await _client(app) as ac:
        r = await ac.get("/boom/value")
    assert r.status_code == 500
    body = r.json()
    assert body == {
        "success": False,
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
        },
    }


async def test_unhandled_key_error_returns_envelope_500() -> None:
    app = _app_with_boom_routes()
    async with await _client(app) as ac:
        r = await ac.get("/boom/key")
    assert r.status_code == 500
    assert r.json()["success"] is False
    assert r.json()["error"]["code"] == "INTERNAL_ERROR"


async def test_unhandled_zerodivision_returns_envelope_500() -> None:
    app = _app_with_boom_routes()
    async with await _client(app) as ac:
        r = await ac.get("/boom/zero")
    assert r.status_code == 500
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INTERNAL_ERROR"
    # Hata mesajı sızdırılmamalı (ZeroDivisionError text'i payload'da olmamalı)
    assert "division" not in body["error"]["message"].lower()
    assert "zero" not in body["error"]["message"].lower()


async def test_handler_does_not_swallow_sporthink_exceptions() -> None:
    """Generic handler SporthinkException'ı yutmamalı — onlar üstteki dedicated
    handler'a düşer (kendi status_code'larıyla)."""
    from app.core.exceptions import ResourceNotFoundError

    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/notfound")
    async def notfound_route():
        raise ResourceNotFoundError(params={"id": 42})

    async with await _client(app) as ac:
        r = await ac.get("/notfound")
    assert r.status_code == 404
    body = r.json()
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert body["error"]["params"]["id"] == 42
