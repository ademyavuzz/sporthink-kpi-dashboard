"""Test fixture'ları.

Şimdilik dev MySQL'i hedef alıyoruz (ayrı test DB'sine geçiş ileride).
Her test öncesi super admin durumu (failed_attempts, locked_until)
sıfırlanır; her testten sonra super admin'e ait refresh token satırları
temizlenir. Süper admin email'i `.env`'deki SUPER_ADMIN_EMAIL'den okunur.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select, update

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.main import app
from app.models import RefreshToken, User


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """ASGI üzerinden FastAPI app'ine bağlı async HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture(autouse=True)
async def reset_super_admin_state() -> AsyncIterator[None]:
    """Her test öncesi super admin'i temiz duruma getir; sonrasında refresh
    token'larını sil. Diğer kullanıcı veya rol verisine dokunulmaz."""
    email = settings.super_admin_email.lower().strip()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User.id).where(User.email == email))
        sa_id = result.scalar_one()
        await db.execute(
            update(User).where(User.id == sa_id).values(failed_login_attempts=0, locked_until=None)
        )
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == sa_id))
        await db.commit()

    yield

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User.id).where(User.email == email))
        sa_id = result.scalar_one()
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == sa_id))
        await db.commit()


@pytest.fixture
def super_admin_credentials() -> dict[str, str]:
    return {
        "email": settings.super_admin_email,
        "password": settings.super_admin_password,
    }
