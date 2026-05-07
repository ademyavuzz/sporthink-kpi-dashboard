"""`imports` ve `import_errors` tablolarına erişim."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, delete, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Import,
    ImportDataType,
    ImportFileFormat,
    ImportRowError,
    ImportStatus,
)

# Aktif (henüz tamamlanmamış) import'ları sayarken bakılan status'lar.
# `pending → parsing → validating → committing` Faz 1 sync akışında bile
# DB'de yarım kalmış (örn. process kill) bir kayıt olabilir.
_ACTIVE_STATUSES: frozenset[ImportStatus] = frozenset(
    {
        ImportStatus.PENDING,
        ImportStatus.PARSING,
        ImportStatus.VALIDATING,
        ImportStatus.COMMITTING,
    }
)


async def create(
    db: AsyncSession,
    *,
    user_id: int,
    file_name: str,
    file_path: str,
    file_size: int,
    file_format: ImportFileFormat,
    data_type: ImportDataType,
) -> Import:
    row = Import(
        user_id=user_id,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
        file_format=file_format,
        data_type=data_type,
        status=ImportStatus.PENDING,
        progress_percentage=0,
        started_at=datetime.now(UTC),
    )
    db.add(row)
    await db.flush()
    return row


async def update_status(
    db: AsyncSession,
    import_id: int,
    *,
    status: ImportStatus,
    progress_percentage: int | None = None,
    error_message: str | None = None,
) -> None:
    values: dict[str, Any] = {"status": status}
    if progress_percentage is not None:
        values["progress_percentage"] = progress_percentage
    if error_message is not None:
        values["error_message"] = error_message
    if status in {ImportStatus.COMPLETED, ImportStatus.FAILED, ImportStatus.CANCELLED}:
        values["completed_at"] = datetime.now(UTC)
    await db.execute(update(Import).where(Import.id == import_id).values(**values))


async def update_counts(
    db: AsyncSession,
    import_id: int,
    *,
    total_rows: int | None = None,
    valid_rows: int | None = None,
    invalid_rows: int | None = None,
    skipped_rows: int | None = None,
    inserted_rows: int | None = None,
    duration_seconds: int | None = None,
) -> None:
    values: dict[str, Any] = {}
    if total_rows is not None:
        values["total_rows"] = total_rows
    if valid_rows is not None:
        values["valid_rows"] = valid_rows
    if invalid_rows is not None:
        values["invalid_rows"] = invalid_rows
    if skipped_rows is not None:
        values["skipped_rows"] = skipped_rows
    if inserted_rows is not None:
        values["inserted_rows"] = inserted_rows
    if duration_seconds is not None:
        values["duration_seconds"] = duration_seconds
    if values:
        await db.execute(update(Import).where(Import.id == import_id).values(**values))


async def get_by_id(db: AsyncSession, import_id: int) -> Import | None:
    result = await db.execute(select(Import).where(Import.id == import_id))
    return result.scalar_one_or_none()


async def count_active_for_user(db: AsyncSession, user_id: int) -> int:
    """Belirli kullanıcı için aktif (devam eden) import sayısı.

    Eşzamanlı import kısıtı için (docs §8.11). Faz 1 sync akışında pratikte
    1 olmasa bile, kullanıcı paralel POST atarsa veya önceki istek yarım
    kalmışsa burada yakalanır.
    """
    result = await db.execute(
        select(func.count(Import.id)).where(
            and_(
                Import.user_id == user_id,
                Import.status.in_(_ACTIVE_STATUSES),
            )
        )
    )
    return int(result.scalar_one() or 0)


async def list_recent(db: AsyncSession, *, limit: int = 50) -> list[Import]:
    result = await db.execute(select(Import).order_by(desc(Import.id)).limit(limit))
    return list(result.scalars().all())


async def delete_by_id(db: AsyncSession, import_id: int) -> None:
    """Cascade ile import_errors + raw tablo satırları (FK ON DELETE CASCADE)
    otomatik silinir; sadece imports satırını sil."""
    await db.execute(delete(Import).where(Import.id == import_id))


async def add_errors(
    db: AsyncSession,
    *,
    import_id: int,
    errors: list[dict[str, Any]],
) -> None:
    """`errors` listesindeki her dict bir `import_errors` satırına eşlenir.
    Beklenen anahtarlar: `source_row_number`, `field_name`, `error_code`,
    `error_message`, `row_data`."""
    if not errors:
        return
    rows = [
        ImportRowError(
            import_id=import_id,
            source_row_number=e["source_row_number"],
            field_name=e.get("field_name"),
            error_code=e["error_code"],
            error_message=e.get("error_message"),
            row_data=e.get("row_data"),
        )
        for e in errors
    ]
    db.add_all(rows)
    await db.flush()
