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
        # pool_pre_ping aiomysql ile bozuk (SQLAlchemy 2.0.43'te de dogrulandi):
        # do_ping `ping()`'i argumansiz cagiriyor ama
        # AsyncAdapt_aiomysql_connection.ping() `reconnect` argumanini zorunlu
        # kiliyor -> her havuzdan tekrar kullanimda TypeError. Bu yuzden KAPALI.
        # Onun yerine pool_recycle, MySQL wait_timeout'undan (mysql/my.cnf: 600s)
        # KUCUK tutulur. Aksi halde 10dk+ bosta kalan baglantiyi MySQL kapatir,
        # sonraki sorgu "Lost connection (2013)" -> 500 verir (ozellikle az
        # trafikli dashboard'da bosluktan sonraki ilk login'de). 280s guvenli.
        pool_pre_ping=False,
        pool_recycle=280,
        pool_size=10,
        max_overflow=20,
    )


AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=get_engine(),
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
