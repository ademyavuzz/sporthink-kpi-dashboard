from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Tüm ORM modelleri bu Base'i miras alır."""


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        echo=False,
        # pool_pre_ping, aiomysql ile birlikte bozuk: SQLAlchemy'nin pymysql
        # do_ping'i `dbapi_connection.ping()`'i argümansiz çağırıyor, ama
        # AsyncAdapt_aiomysql_connection.ping() `reconnect` argümanını zorunlu
        # kiliyor -> her havuzdan tekrar kullanımda TypeError. pool_recycle
        # bayat baglantilari zaten 1 saatte yeniliyor.
        pool_pre_ping=False,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20,
    )


AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=get_engine(),
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
