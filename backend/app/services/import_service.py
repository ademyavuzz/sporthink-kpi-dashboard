"""Import iş mantığı — parser çıktısını DB'ye taşıyan orkestratör.

Pipeline (sync, Faz 1):
    1. Dosyayı upload klasörüne kaydet, `imports` satırı oluştur (PENDING).
    2. Parser CSV'yi okur → ParsedRow / ParseError yield eder.
    3. ParseError'ları biriktir → `import_errors` tablosuna yaz.
    4. Geçerli satırlardan FK lookup için external_id setleri çıkar, batch
       SELECT ile pk_map çek; eksik FK varsa satır hata yapılır.
    5. Dedup: hedef tabloda zaten var olan satırlar `skipped_rows`'a sayılır
       (Faz 1 stratejisi: SKIP).
    6. Kalan satırları bulk INSERT et.
    7. `imports` satırını güncelle (counts + status=COMPLETED veya FAILED).

Hata akışı:
    - Header eksikse veya source unknown ise → tüm dosya FAILED, error_message set.
    - Satır seviyesi hatalar → `import_errors` tablosuna; pipeline devam eder
      (skip strategy). 0 valid satır kalırsa COMPLETED + 0 inserted.
"""

from __future__ import annotations

import io
import logging
import os
import time
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, BinaryIO

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ResourceNotFoundError, SporthinkException
from app.models import (
    Campaign,
    Customer,
    GA4ItemEngagement,
    GA4Traffic,
    GoogleAds,
    Import,
    ImportDataType,
    ImportFileFormat,
    ImportStatus,
    MetaAds,
    MetaAdsBreakdowns,
    Order,
    OrderItem,
    Product,
)
from app.parsers.csv_parser import parse_csv
from app.parsers.sources import REGISTRY, get_config
from app.parsers.types import ParsedRow, ParseError, SourceConfig
from app.repositories import audit_log_repository, data_writer, import_repository

logger = logging.getLogger(__name__)


# Wizard 1. adımdaki dropdown ve 2. adımdaki header doğrulaması için kullanılan
# kullanıcıya görünür Türkçe etiketler. Frontend isterse bu etiketleri kullanır,
# isterse `data_type` üzerinden kendi i18n key'lerini map'ler.
_DATA_TYPE_LABELS_TR: dict[str, str] = {
    "products": "Ürünler",
    "customers": "Müşteriler",
    "campaigns": "Kampanyalar",
    "orders": "Siparişler",
    "order_items": "Sipariş Kalemleri",
    "ga4_traffic": "GA4 Trafik",
    "ga4_items": "GA4 Ürün Etkileşimleri",
    "meta_ads": "Meta Ads Performans",
    "meta_breakdowns": "Meta Ads Kırılımları",
    "google_ads": "Google Ads Performans",
}


# Hedef tablo adı → ORM model class
_MODEL_BY_TABLE: dict[str, type] = {
    "products": Product,
    "customers": Customer,
    "orders": Order,
    "order_items": OrderItem,
    "campaigns": Campaign,
    "ga4_traffic": GA4Traffic,
    "ga4_item_engagement": GA4ItemEngagement,
    "meta_ads": MetaAds,
    "meta_ads_breakdowns": MetaAdsBreakdowns,
    "google_ads": GoogleAds,
}


# Aggregate rebuild'i etkileyen veri tipleri — bunların import'undan sonra
# `kpi_*_aggregates` yenilenmeli. Müşteri/ürün/kampanya import'u sayıları
# değiştirmediği için yeniden hesaplama gerekmez.
_AGGREGATE_TRIGGERING_TYPES: frozenset[ImportDataType] = frozenset(
    {
        ImportDataType.GA4_TRAFFIC,
        ImportDataType.META_ADS,
        ImportDataType.GOOGLE_ADS,
        ImportDataType.ORDERS,
    }
)


# data_type → o tabloda min/max çekeceğimiz tarih kolonu adı.
_DATE_COLUMN_BY_TYPE: dict[ImportDataType, str] = {
    ImportDataType.GA4_TRAFFIC: "date",
    ImportDataType.META_ADS: "date_start",
    ImportDataType.GOOGLE_ADS: "date",
    ImportDataType.ORDERS: "order_date",
}


def _trigger_aggregate_rebuild(rows: list[dict[str, Any]], data_type: ImportDataType) -> None:
    """Import sonrası aggregate'leri yenilemek için Celery task'ı tetikler.

    `rows` içinden tarih min/max'ı çıkarır ve sadece o pencere için rebuild
    yapar — full-history rebuild gereksiz pahalı.
    """
    if data_type not in _AGGREGATE_TRIGGERING_TYPES or not rows:
        return
    col = _DATE_COLUMN_BY_TYPE.get(data_type)
    if col is None:
        return
    dates: list[date] = []
    for r in rows:
        v = r.get(col)
        if isinstance(v, datetime):
            dates.append(v.date())
        elif isinstance(v, date):
            dates.append(v)
    if not dates:
        return
    d_from, d_to = min(dates), max(dates)
    try:
        from app.tasks.aggregation_tasks import rebuild_all_task

        rebuild_all_task.delay(d_from.isoformat(), d_to.isoformat())
        logger.info(
            "aggregate_rebuild_enqueued data_type=%s from=%s to=%s",
            data_type.value,
            d_from,
            d_to,
        )
    except Exception:
        # Celery broker erişilemezse bile import başarılı sayılır;
        # admin manuel rebuild'i tetikleyebilir.
        logger.exception("aggregate_rebuild_enqueue_failed data_type=%s", data_type.value)


# Sonuç panelinde gösterilecek max örnek hata sayısı
_SAMPLE_ERRORS_LIMIT = 50


class UnsupportedSourceError(SporthinkException):
    code = "UNSUPPORTED_SOURCE"
    status_code = 400
    message = "Selected data source is not supported in this slice"


class FileTooLargeError(SporthinkException):
    code = "FILE_TOO_LARGE"
    status_code = 413
    message = "Uploaded file exceeds maximum size"


class InvalidFileFormatError(SporthinkException):
    code = "INVALID_FILE_FORMAT"
    status_code = 422
    message = "Only CSV files are supported in this slice"


def _save_uploaded_file(file: BinaryIO, original_name: str) -> tuple[str, int]:
    """Upload klasörüne kaydet, (path, size) döner. Boyut limiti aşılırsa
    `FileTooLargeError` raise eder."""
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in original_name)
    dest_path = os.path.join(settings.upload_dir, f"{timestamp}_{safe_name}")

    max_bytes = settings.import_max_file_size_mb * 1024 * 1024
    written = 0
    with open(dest_path, "wb") as out:
        while True:
            chunk = file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > max_bytes:
                out.close()
                os.remove(dest_path)
                raise FileTooLargeError(params={"max_mb": settings.import_max_file_size_mb})
            out.write(chunk)
    return dest_path, written


def _jsonify(value: Any) -> Any:
    """`row_data` JSON kolonuna yazılmadan önce Python tiplerini primitif'e çevir.

    Decimal → str, date/datetime → ISO 8601, dict/list recursive.
    """
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date | datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _jsonify(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonify(v) for v in value]
    return value


def _parse_error_to_dict(err: ParseError) -> dict[str, Any]:
    return {
        "source_row_number": err.source_row_number,
        "field_name": err.field_name,
        "error_code": err.error_code,
        "error_message": err.error_message,
        "row_data": _jsonify(err.row_data),
    }


async def _resolve_fk_lookups(
    db: AsyncSession,
    config: SourceConfig,
    rows: list[ParsedRow],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Her FK lookup için external_id'leri toplar, batch SELECT ile pk_map
    kurar, satırlara pk değerlerini iliştirir. Eksik (required) FK olan
    satırlar hata listesine taşınır.

    Returns: (valid_rows_data, fk_errors).
    """
    fk_errors: list[dict[str, Any]] = []
    if not config.fk_lookups:
        return [r.data for r in rows], fk_errors

    # Her FK için pk_map önceden çek
    pk_maps: dict[str, dict[str, int]] = {}
    for fk in config.fk_lookups:
        external_values = [
            r.data[fk.external_id_column]
            for r in rows
            if fk.external_id_column in r.data and r.data[fk.external_id_column] is not None
        ]
        pk_maps[fk.pk_column] = await data_writer.fetch_pk_map(
            db,
            table=fk.lookup_table,
            pk_column="id",
            lookup_column=fk.lookup_column,
            values=external_values,
        )

    valid: list[dict[str, Any]] = []
    for r in rows:
        row_failed = False
        for fk in config.fk_lookups:
            external_value = r.data.get(fk.external_id_column)
            if external_value is None:
                if fk.required:
                    fk_errors.append(
                        {
                            "source_row_number": r.source_row_number,
                            "field_name": fk.external_id_column,
                            "error_code": "FK_REQUIRED",
                            "error_message": f"{fk.external_id_column} is required for FK lookup",
                            "row_data": _jsonify(r.data),
                        }
                    )
                    row_failed = True
                    break
                r.data[fk.pk_column] = None
                continue

            pk = pk_maps[fk.pk_column].get(external_value)
            if pk is None:
                if fk.required:
                    fk_errors.append(
                        {
                            "source_row_number": r.source_row_number,
                            "field_name": fk.external_id_column,
                            "error_code": "FK_NOT_FOUND",
                            "error_message": (
                                f"{external_value!r} not found in "
                                f"{fk.lookup_table}.{fk.lookup_column}"
                            ),
                            "row_data": _jsonify(r.data),
                        }
                    )
                    row_failed = True
                    break
                r.data[fk.pk_column] = None
            else:
                r.data[fk.pk_column] = pk

        if not row_failed:
            valid.append(r.data)

    return valid, fk_errors


async def _filter_duplicates(
    db: AsyncSession,
    config: SourceConfig,
    rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """Hedef tabloda zaten var olan dedup_key'leri filtreler. Returns: (kept_rows, skipped_count)."""
    if not config.dedup_keys or not rows:
        return rows, 0

    existing = await data_writer.fetch_existing_keys(
        db,
        table=config.target_table,
        key_columns=config.dedup_keys,
        batch=rows,
    )
    if not existing:
        return rows, 0

    kept: list[dict[str, Any]] = []
    skipped = 0
    for r in rows:
        key = tuple(r.get(c) for c in config.dedup_keys)
        if key in existing:
            skipped += 1
        else:
            kept.append(r)
    return kept, skipped


async def run_import(
    db: AsyncSession,
    *,
    user_id: int,
    user_email: str,
    data_type: ImportDataType,
    upload_stream: BinaryIO,
    original_filename: str,
    ip: str | None,
    user_agent: str | None,
) -> Import:
    """Faz 1 sync import — uploadlandığı thread'de tamamen bitirir.

    Returns: güncellenmiş `Import` ORM kaydı (status=COMPLETED veya FAILED).
    """
    config = get_config(data_type)
    if config is None:
        raise UnsupportedSourceError(params={"data_type": data_type.value})
    if config.target_table not in _MODEL_BY_TABLE:
        raise UnsupportedSourceError(params={"data_type": data_type.value})

    # Format kontrolü — Faz 1 sadece CSV
    if not original_filename.lower().endswith(".csv"):
        raise InvalidFileFormatError(params={"filename": original_filename})

    file_path, file_size = _save_uploaded_file(upload_stream, original_filename)

    # imports satırı oluştur
    import_run = await import_repository.create(
        db,
        user_id=user_id,
        file_name=original_filename,
        file_path=file_path,
        file_size=file_size,
        file_format=ImportFileFormat.CSV,
        data_type=data_type,
    )
    await db.commit()
    import_id = import_run.id
    started_ts = time.monotonic()

    parse_errors: list[dict[str, Any]] = []
    parsed_rows: list[ParsedRow] = []

    try:
        # Parse — file'ı text mode aç, BOM-aware UTF-8 oku
        await import_repository.update_status(
            db, import_id, status=ImportStatus.PARSING, progress_percentage=10
        )
        await db.commit()

        # NOTE: Sync `open()` + streaming CSV parser. backend/CLAUDE.md §8.2
        # gereği import'ların Celery'ye taşınması planlandı; bu yapılana kadar
        # request loop bu noktada bloke olur. Dev/küçük dosyalarda kabul ediliyor.
        with open(file_path, "rb") as raw:  # noqa: ASYNC230
            text_stream = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            for item in parse_csv(text_stream, config):
                if isinstance(item, ParsedRow):
                    parsed_rows.append(item)
                elif isinstance(item, ParseError):
                    parse_errors.append(_parse_error_to_dict(item))

        # Header eksikse parse_csv tek MISSING_HEADERS hatası yield etti
        if (
            len(parsed_rows) == 0
            and len(parse_errors) == 1
            and parse_errors[0]["error_code"] == "MISSING_HEADERS"
        ):
            await import_repository.add_errors(db, import_id=import_id, errors=parse_errors)
            await import_repository.update_status(
                db,
                import_id,
                status=ImportStatus.FAILED,
                progress_percentage=100,
                error_message=parse_errors[0]["error_message"],
            )
            await db.commit()
            return await import_repository.get_by_id(db, import_id)  # type: ignore[return-value]

        # Validate (FK lookup) — Faz 1'de "validating" ile aynı
        await import_repository.update_status(
            db, import_id, status=ImportStatus.VALIDATING, progress_percentage=40
        )
        await db.commit()

        valid_rows_data, fk_errors = await _resolve_fk_lookups(db, config, parsed_rows)
        all_errors = parse_errors + fk_errors

        # Dedup
        kept_rows, skipped = await _filter_duplicates(db, config, valid_rows_data)

        # Bulk insert — `imports.id` kolonunu raw tablolara yaz (FK + rollback için)
        await import_repository.update_status(
            db, import_id, status=ImportStatus.COMMITTING, progress_percentage=70
        )
        await db.commit()

        model = _MODEL_BY_TABLE[config.target_table]
        table_columns = {c.name for c in model.__table__.columns}

        # FK lookup için tutulan ama DB'de olmayan key'ler (örn. parser
        # `campaign_name`'i lookup için kullanır, model'de yoktur) burada
        # düşer. Ayrıca varsa `import_id`'yi enjekte ederiz.
        prepared_rows: list[dict[str, Any]] = []
        attach_import_id = "import_id" in table_columns
        for r in kept_rows:
            row = {k: v for k, v in r.items() if k in table_columns}
            if attach_import_id:
                row["import_id"] = import_id
            prepared_rows.append(row)

        inserted = await data_writer.bulk_insert(db, model=model, rows=prepared_rows)

        # import_errors satırlarını yaz — ilk N + sayı yeter ama hepsini logla
        if all_errors:
            await import_repository.add_errors(db, import_id=import_id, errors=all_errors)

        duration = int(time.monotonic() - started_ts)
        await import_repository.update_counts(
            db,
            import_id,
            total_rows=len(parsed_rows) + len(parse_errors),
            valid_rows=len(valid_rows_data),
            invalid_rows=len(all_errors),
            skipped_rows=skipped,
            inserted_rows=inserted,
            duration_seconds=duration,
        )
        await import_repository.update_status(
            db, import_id, status=ImportStatus.COMPLETED, progress_percentage=100
        )

        await audit_log_repository.add(
            db,
            action="import.completed",
            user_id=user_id,
            user_email=user_email,
            resource_type="import",
            resource_id=str(import_id),
            ip_address=ip,
            user_agent=user_agent,
            details={
                "data_type": data_type.value,
                "inserted": inserted,
                "skipped": skipped,
                "errors": len(all_errors),
            },
        )
        await db.commit()

        # Aggregate rebuild — KPI tabloları artık güncel olmalı.
        # `kpi_*_aggregates` raw'dan yeniden hesaplanmazsa dashboard
        # eski sayıları gösterir; bu satıra kadar tetiklenmesi unutulmuştu.
        _trigger_aggregate_rebuild(prepared_rows, data_type)

    except SQLAlchemyError as exc:
        logger.exception("import_db_error", extra={"import_id": import_id})
        await db.rollback()
        await import_repository.update_status(
            db,
            import_id,
            status=ImportStatus.FAILED,
            progress_percentage=100,
            error_message=str(exc)[:500],
        )
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.exception("import_unexpected_error", extra={"import_id": import_id})
        await db.rollback()
        await import_repository.update_status(
            db,
            import_id,
            status=ImportStatus.FAILED,
            progress_percentage=100,
            error_message=str(exc)[:500],
        )
        await db.commit()

    final = await import_repository.get_by_id(db, import_id)
    if final is None:
        raise SporthinkException("Import record disappeared")
    return final


_PREVIEW_PARSE_LIMIT = 100  # Kaç satır parse denenir
_PREVIEW_SAMPLE_SIZE = 10  # Kaç başarılı satır frontend'e döner
_PREVIEW_ERROR_SAMPLE = 20  # Kaç hata frontend'e döner


def preview_import(
    *,
    data_type: ImportDataType,
    upload_stream: BinaryIO,
    original_filename: str,
) -> dict[str, Any]:
    """Dosyayı DB'ye yazmadan parse edip önizleme bilgisi döndürür.

    Wizard 2. adımı için:
    - Header diff (eksik zorunlu / tanınmayan kolon)
    - İlk 10 başarıyla parse edilmiş satır (DB kolon adlarıyla)
    - İlk birkaç hata (varsa)

    Performans: dosyanın tamamı parse edilmez; ilk `_PREVIEW_PARSE_LIMIT`
    satır işlenir. Büyük dosyalar (50 MB) için bile <1 sn'de döner.

    Dosya geçici olarak diske yazılır ve sonunda silinir — `import_service.run_import`
    aksine `imports` satırı oluşturulmaz, audit_log yazılmaz.
    """
    config = get_config(data_type)
    if config is None:
        raise UnsupportedSourceError(params={"data_type": data_type.value})
    if not original_filename.lower().endswith(".csv"):
        raise InvalidFileFormatError(params={"filename": original_filename})

    # Dosyayı geçici olarak yaz; size kontrolü dahil
    file_path, file_size = _save_uploaded_file(upload_stream, original_filename)

    detected_headers: list[str] = []
    sample_rows: list[dict[str, Any]] = []
    error_samples: list[dict[str, Any]] = []
    valid_count = 0
    error_count = 0
    total_processed = 0
    missing_required: list[str] = []

    try:
        with open(file_path, "rb") as raw:
            text_stream = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            # csv.DictReader kullanmak yerine parse_csv'yi kullanıyoruz; aynı
            # validation mantığı (header diff, coerce, post_coerce) burada da
            # geçerli olsun.
            import csv as _csv

            # Önce header'ları al (BOM temizliği için aynı mantık)
            reader_for_headers = _csv.reader(text_stream)
            try:
                first_row = next(reader_for_headers)
                detected_headers = [h.lstrip("﻿").strip() if h else "" for h in first_row]
            except StopIteration:
                detected_headers = []

            # Stream'i başa al
            raw.seek(0)
            text_stream = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")

            for item in parse_csv(text_stream, config):
                total_processed += 1
                if isinstance(item, ParsedRow):
                    valid_count += 1
                    if len(sample_rows) < _PREVIEW_SAMPLE_SIZE:
                        sample_rows.append(_jsonify(item.data))
                elif isinstance(item, ParseError):
                    error_count += 1
                    if item.error_code == "MISSING_HEADERS" and not missing_required:
                        # Header eksikse parse_csv tek hata yield edip durur
                        missing_required = sorted(
                            {c.csv_header for c in config.columns if c.required}
                            - set(detected_headers)
                        )
                    if len(error_samples) < _PREVIEW_ERROR_SAMPLE:
                        error_samples.append(_parse_error_to_dict(item))

                if total_processed >= _PREVIEW_PARSE_LIMIT:
                    break
    finally:
        # Geçici dosyayı temizle — preview kalıcı değil
        try:
            os.remove(file_path)
        except OSError:
            logger.warning("preview cleanup failed: %s", file_path)

    # Header diff
    # `expected`: parser ColumnSpec'lerinde tanımlı kolonlar (DB'ye yazılır)
    # `intentionally_ignored`: parser'da `drop_columns` olarak işaretli (DB'de
    #   STORED GENERATED — örn `net_revenue`, `cart_to_view_rate`); bilerek atlanır
    # `unknown`: gerçekten tanınmayan, kullanıcıya uyarı verilir
    expected_headers = {c.csv_header for c in config.columns}
    intentionally_ignored = set(config.drop_columns)
    detected_set = set(detected_headers)
    if not missing_required:
        missing_required = sorted(
            {c.csv_header for c in config.columns if c.required} - detected_set
        )
    unknown_headers = sorted(detected_set - expected_headers - intentionally_ignored)

    return {
        "data_type": data_type.value,
        "file_name": original_filename,
        "file_size_bytes": file_size,
        "detected_headers": detected_headers,
        "missing_required": missing_required,
        "unknown_headers": unknown_headers,
        "sample_rows": sample_rows,
        "sample_errors": error_samples,
        "summary": {
            "previewed_rows": total_processed,
            "valid_rows": valid_count,
            "error_rows": error_count,
        },
    }


def get_data_types_meta() -> list[dict[str, Any]]:
    """Tüm desteklenen veri kaynaklarının meta bilgisini döner.

    Frontend wizard'ı:
    - 1. adımda kullanıcıya hangi veri kaynaklarının yüklenebileceğini gösterir
      (`data_type` + `label_tr`).
    - 2. adımda yüklenen dosyanın CSV başlıklarını `csv_headers` ile karşılaştırır
      (eksik zorunlu / tanınmayan kolon uyarıları).
    """
    result: list[dict[str, Any]] = []
    for data_type, config in REGISTRY.items():
        result.append(
            {
                "data_type": data_type.value,
                "label_tr": _DATA_TYPE_LABELS_TR.get(data_type.value, data_type.value),
                "target_table": config.target_table,
                "csv_headers": [
                    {
                        "csv_header": c.csv_header,
                        "db_column": c.db_column,
                        "type": c.coerce,
                        "required": c.required,
                    }
                    for c in config.columns
                ],
                "dedup_keys": list(config.dedup_keys),
                "fk_count": len(config.fk_lookups),
            }
        )
    # Stable order for frontend rendering — master tablolar önce, transactional sonra.
    order = [
        "products",
        "customers",
        "campaigns",
        "orders",
        "order_items",
        "ga4_traffic",
        "ga4_items",
        "meta_ads",
        "meta_breakdowns",
        "google_ads",
    ]
    order_index = {dt: i for i, dt in enumerate(order)}
    result.sort(key=lambda x: order_index.get(x["data_type"], 999))
    return result


async def list_imports(db: AsyncSession, *, limit: int = 50) -> list[Import]:
    return await import_repository.list_recent(db, limit=limit)


async def get_import(db: AsyncSession, import_id: int) -> Import | None:
    return await import_repository.get_by_id(db, import_id)


async def get_sample_errors(
    db: AsyncSession, import_id: int, *, limit: int = _SAMPLE_ERRORS_LIMIT
) -> list[dict[str, Any]]:
    """Sonuç panelinde gösterilecek ilk N hata satırı."""
    from sqlalchemy import select

    from app.models import ImportRowError

    result = await db.execute(
        select(ImportRowError)
        .where(ImportRowError.import_id == import_id)
        .order_by(ImportRowError.id)
        .limit(limit)
    )
    return [
        {
            "source_row_number": e.source_row_number,
            "field_name": e.field_name,
            "error_code": e.error_code,
            "error_message": e.error_message,
        }
        for e in result.scalars().all()
    ]


async def delete_import(
    db: AsyncSession,
    *,
    import_id: int,
    user_id: int,
    user_email: str,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Import kaydını sil — raw satırları manuel cascade ile, import_errors
    DB CASCADE ile otomatik. Yüklenmiş dosya kalır (audit için).

    Pazarlama tablolarındaki FK constraint'i `ON DELETE RESTRICT` olduğu
    için önce import_id'ye bağlı raw satırları siliyoruz, sonra imports
    satırını. Master tablolarda (`products`, `customers`, `campaigns`)
    `import_id` kolonu yok → silme adımı atlanır.
    """
    existing = await import_repository.get_by_id(db, import_id)
    if existing is None:
        raise ResourceNotFoundError("Import not found")

    config = get_config(existing.data_type)
    if config is not None:
        model = _MODEL_BY_TABLE.get(config.target_table)
        if model is not None and "import_id" in {c.name for c in model.__table__.columns}:
            await db.execute(
                text(f"DELETE FROM {config.target_table} WHERE import_id = :id"),
                {"id": import_id},
            )

    await import_repository.delete_by_id(db, import_id)
    await audit_log_repository.add(
        db,
        action="import.deleted",
        user_id=user_id,
        user_email=user_email,
        resource_type="import",
        resource_id=str(import_id),
        ip_address=ip,
        user_agent=user_agent,
        details={
            "data_type": existing.data_type.value if existing.data_type else None,
            "inserted_rows": existing.inserted_rows,
        },
    )
    await db.commit()
