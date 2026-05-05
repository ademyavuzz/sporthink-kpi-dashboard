"""Rapor üretim Celery task'ı.

`POST /reports` endpoint'inden enqueue edilir. `report_service.generate_report_pdf`
veriyi toplar, PDF render eder, dosyayı yazar, status'u günceller. Bu modül
sadece sync→async köprüsü kurar.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy.exc import SQLAlchemyError

from app.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.services import report_service

logger = logging.getLogger(__name__)


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("loop closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(
    name="reports.generate",
    bind=True,
    autoretry_for=(SQLAlchemyError, ConnectionError),
    retry_kwargs={"max_retries": 2, "countdown": 30},
    acks_late=True,
)
def generate_report_task(self, report_id: int) -> dict:
    """Tek argüman: report_id. Worker DB'den kaydı çeker; büyük objeler
    argument olarak geçirilmez (CLAUDE §8.2).
    """

    async def _job():
        async with AsyncSessionLocal() as db:
            await report_service.generate_report_pdf(db, report_id)

    _run_async(_job())
    logger.info("report_task_done report_id=%d", report_id)
    return {"report_id": report_id, "status": "done"}
