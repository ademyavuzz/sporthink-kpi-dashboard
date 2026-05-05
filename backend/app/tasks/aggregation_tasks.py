"""Aggregation rebuild Celery task'ları.

Import sonrası otomatik tetiklenir (`import_service`'te enqueue edilir) ve
admin endpoint'i üzerinden manuel de çağrılabilir.

Idempotent — aynı `date_from`/`date_to` ile birden fazla kez çağrılırsa
duplikat üretmez (UPSERT). Geniş tarih aralıkları için ~saniye sürebilir;
production'da Celery worker'da çalışır.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

from sqlalchemy.exc import SQLAlchemyError

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services import aggregation_service

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Celery worker sync; async coroutine'i event loop ile çalıştırır."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("loop closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(
    name="aggregations.rebuild_all",
    bind=True,
    autoretry_for=(SQLAlchemyError, ConnectionError),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    acks_late=True,
)
def rebuild_all_task(
    self,
    date_from_iso: str,
    date_to_iso: str,
) -> dict:
    """Tam rebuild — daily + monthly + campaign aggregate'leri.

    Args:
        date_from_iso: 'YYYY-MM-DD'
        date_to_iso:   'YYYY-MM-DD'
    """
    date_from = date.fromisoformat(date_from_iso)
    date_to = date.fromisoformat(date_to_iso)

    async def _job():
        async with AsyncSessionLocal() as db:
            return await aggregation_service.rebuild_all(db, date_from=date_from, date_to=date_to)

    result = _run_async(_job())
    logger.info("aggregation_rebuild_complete result=%s", result)
    return result
