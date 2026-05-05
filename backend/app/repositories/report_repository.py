"""`reports` tablosuna erişim — service'ten çağrılır."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Report, ReportStatus


async def create(
    db: AsyncSession,
    *,
    user_id: int,
    name: str,
    date_from: date,
    date_to: date,
    sections: list[str],
    language: str,
) -> Report:
    row = Report(
        user_id=user_id,
        name=name,
        date_from=date_from,
        date_to=date_to,
        sections=sections,
        language=language,
        status=ReportStatus.PENDING,
    )
    db.add(row)
    await db.flush()
    return row


async def get_by_id(db: AsyncSession, report_id: int) -> Report | None:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_recent(db: AsyncSession, *, limit: int = 50) -> list[Report]:
    result = await db.execute(
        select(Report)
        .where(Report.deleted_at.is_(None))
        .order_by(desc(Report.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def mark_generating(db: AsyncSession, report_id: int) -> None:
    await db.execute(
        update(Report)
        .where(Report.id == report_id)
        .values(status=ReportStatus.GENERATING, started_at=datetime.now(UTC))
    )
    await db.commit()


async def mark_completed(
    db: AsyncSession,
    report_id: int,
    *,
    file_path: str,
    file_size_bytes: int,
) -> None:
    await db.execute(
        update(Report)
        .where(Report.id == report_id)
        .values(
            status=ReportStatus.COMPLETED,
            file_path=file_path,
            file_size_bytes=file_size_bytes,
            completed_at=datetime.now(UTC),
            error_message=None,
        )
    )
    await db.commit()


async def mark_failed(db: AsyncSession, report_id: int, *, error_message: str) -> None:
    await db.execute(
        update(Report)
        .where(Report.id == report_id)
        .values(
            status=ReportStatus.FAILED,
            error_message=error_message[:2000],
            completed_at=datetime.now(UTC),
        )
    )
    await db.commit()


async def soft_delete(db: AsyncSession, report_id: int) -> None:
    await db.execute(
        update(Report).where(Report.id == report_id).values(deleted_at=datetime.now(UTC))
    )
    await db.commit()
