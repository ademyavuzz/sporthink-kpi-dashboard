"""Imports router — `/api/v1/imports/*`.

Faz 1 (sync) endpoint'leri:
- POST /imports          → multipart upload + işlem (cevap geldiğinde tamamlanmış)
- GET  /imports          → son N import (history table)
- GET  /imports/{id}     → tek import detayı + örnek hatalar
- DELETE /imports/{id}   → import kaydını + raw satırları cascade sil

İzin kontrolleri:
- POST → IMPORTS_CREATE
- GET  → IMPORTS_VIEW
- DELETE → IMPORTS_DELETE
"""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, Form, Path, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError
from app.core.permissions import Permission
from app.dependencies import get_db, require_permission
from app.models import ImportDataType, User
from app.schemas import (
    DataTypeColumn,
    DataTypeMeta,
    ImportDetailResponse,
    ImportListItem,
    ImportPreviewResponse,
    ImportPreviewSummary,
    ImportRunResult,
    ImportSampleError,
    PaginatedEnvelope,
    PaginationMeta,
    SuccessEnvelope,
)
from app.services import import_service

router = APIRouter(prefix="/imports", tags=["imports"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get(
    "/data-types",
    response_model=SuccessEnvelope[list[DataTypeMeta]],
    summary="Desteklenen veri kaynakları + CSV başlık beklentileri",
)
async def list_data_types(
    _current_user: User = Depends(require_permission(Permission.IMPORTS_VIEW)),
) -> SuccessEnvelope[list[DataTypeMeta]]:
    """Wizard 1. adım dropdown'ı ve 2. adım header doğrulaması için meta.

    DB sorgusu yok — parser registry'den okur, ayrıca yetki gerektirmeyen bir
    endpoint olabilirdi ama RBAC bütünlüğü için `IMPORTS_VIEW` istiyoruz.
    """
    items = import_service.get_data_types_meta()
    return SuccessEnvelope(
        data=[
            DataTypeMeta(
                data_type=it["data_type"],
                label_tr=it["label_tr"],
                target_table=it["target_table"],
                csv_headers=[DataTypeColumn(**c) for c in it["csv_headers"]],
                dedup_keys=it["dedup_keys"],
                fk_count=it["fk_count"],
            )
            for it in items
        ]
    )


@router.post(
    "/preview",
    response_model=SuccessEnvelope[ImportPreviewResponse],
    summary="Dosyayı DB'ye yazmadan parse et — wizard 2. adım önizleme",
)
async def preview_import(
    file: UploadFile = File(..., description="CSV dosyası (max 50 MB)"),
    data_type: ImportDataType = Form(..., description="Hedef veri kaynağı"),
    _current_user: User = Depends(require_permission(Permission.IMPORTS_CREATE)),
) -> SuccessEnvelope[ImportPreviewResponse]:
    result = import_service.preview_import(
        data_type=data_type,
        upload_stream=file.file,
        original_filename=file.filename or "upload.csv",
    )
    return SuccessEnvelope(
        data=ImportPreviewResponse(
            data_type=result["data_type"],
            file_name=result["file_name"],
            file_size_bytes=result["file_size_bytes"],
            detected_headers=result["detected_headers"],
            missing_required=result["missing_required"],
            unknown_headers=result["unknown_headers"],
            sample_rows=result["sample_rows"],
            sample_errors=[ImportSampleError(**e) for e in result["sample_errors"]],
            summary=ImportPreviewSummary(**result["summary"]),
        )
    )


@router.post(
    "",
    response_model=SuccessEnvelope[ImportRunResult],
    summary="CSV dosyası yükle ve işle (sync)",
)
async def upload_import(
    request: Request,
    file: UploadFile = File(..., description="CSV dosyası (max 50 MB)"),
    data_type: ImportDataType = Form(..., description="Hedef veri kaynağı"),
    current_user: User = Depends(require_permission(Permission.IMPORTS_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ImportRunResult]:
    import_run = await import_service.run_import(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        data_type=data_type,
        upload_stream=file.file,
        original_filename=file.filename or "upload.csv",
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    sample = await import_service.get_sample_errors(db, import_run.id)
    return SuccessEnvelope(
        data=ImportRunResult(
            id=import_run.id,
            file_name=import_run.file_name,
            data_type=import_run.data_type.value,
            status=import_run.status.value,
            total_rows=import_run.total_rows,
            valid_rows=import_run.valid_rows,
            invalid_rows=import_run.invalid_rows,
            skipped_rows=import_run.skipped_rows,
            inserted_rows=import_run.inserted_rows,
            duration_seconds=import_run.duration_seconds,
            started_at=import_run.started_at,
            completed_at=import_run.completed_at,
            created_at=import_run.created_at,
            error_message=import_run.error_message,
            sample_errors=[ImportSampleError(**e) for e in sample],
        )
    )


@router.get(
    "",
    response_model=PaginatedEnvelope[ImportListItem],
    summary="Import işlemleri — sayfalı (en yeni → eski)",
)
async def list_imports(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _current_user: User = Depends(require_permission(Permission.IMPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[ImportListItem]:
    items, total = await import_service.list_imports_paginated(
        db, page=page, page_size=page_size
    )
    return PaginatedEnvelope(
        data=[
            ImportListItem(
                id=it.id,
                file_name=it.file_name,
                data_type=it.data_type.value,
                status=it.status.value,
                total_rows=it.total_rows,
                valid_rows=it.valid_rows,
                invalid_rows=it.invalid_rows,
                skipped_rows=it.skipped_rows,
                inserted_rows=it.inserted_rows,
                duration_seconds=it.duration_seconds,
                started_at=it.started_at,
                completed_at=it.completed_at,
                created_at=it.created_at,
            )
            for it in items
        ],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/{import_id}",
    response_model=SuccessEnvelope[ImportDetailResponse],
    summary="Import detayı + örnek hatalar",
)
async def get_import(
    import_id: int = Path(..., ge=1),
    _current_user: User = Depends(require_permission(Permission.IMPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ImportDetailResponse]:
    it = await import_service.get_import(db, import_id)
    if it is None:
        raise ResourceNotFoundError(params={"import_id": import_id})
    sample = await import_service.get_sample_errors(db, import_id)
    return SuccessEnvelope(
        data=ImportDetailResponse(
            id=it.id,
            file_name=it.file_name,
            data_type=it.data_type.value,
            status=it.status.value,
            total_rows=it.total_rows,
            valid_rows=it.valid_rows,
            invalid_rows=it.invalid_rows,
            skipped_rows=it.skipped_rows,
            inserted_rows=it.inserted_rows,
            duration_seconds=it.duration_seconds,
            started_at=it.started_at,
            completed_at=it.completed_at,
            created_at=it.created_at,
            error_message=it.error_message,
            sample_errors=[ImportSampleError(**e) for e in sample],
        )
    )


@router.get(
    "/{import_id}/errors.csv",
    response_class=StreamingResponse,
    summary="Import hatalarını CSV olarak indir",
)
async def download_import_errors(
    import_id: int = Path(..., ge=1),
    _current_user: User = Depends(require_permission(Permission.IMPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """`import_errors` tablosundaki tüm hatalı satırları CSV olarak indirir.

    Frontend wizard'ı 4. (sonuç) adımında "Hataları indir" butonu bu endpoint'i
    çağırır. UTF-8 BOM ile başlar — Excel'in TR karakterleri doğru göstermesi
    için.
    """
    it = await import_service.get_import(db, import_id)
    if it is None:
        raise ResourceNotFoundError(params={"import_id": import_id})

    rows = await import_service.list_all_errors(db, import_id)

    buffer = io.StringIO()
    # Excel için UTF-8 BOM
    buffer.write("﻿")
    writer = csv.writer(buffer)
    writer.writerow(["source_row_number", "field_name", "error_code", "error_message", "row_data"])
    for r in rows:
        # row_data zaten JSON-serializable dict; CSV için str() yeterli
        row_data_str = "" if r.row_data is None else str(r.row_data)
        writer.writerow(
            [
                r.source_row_number,
                r.field_name or "",
                r.error_code,
                r.error_message or "",
                row_data_str,
            ]
        )

    buffer.seek(0)
    safe_filename = f"import-{import_id}-errors.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


@router.delete(
    "/{import_id}",
    response_model=SuccessEnvelope[dict],
    summary="Import kaydını ve yazdığı raw satırları sil (rollback)",
)
async def delete_import(
    request: Request,
    import_id: int = Path(..., ge=1),
    current_user: User = Depends(require_permission(Permission.IMPORTS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await import_service.delete_import(
        db,
        import_id=import_id,
        user_id=current_user.id,
        user_email=current_user.email,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data={"deleted": True, "import_id": import_id})
