"""Reports router: `/api/v1/reports/*`.

Endpoint'ler:
- GET    /reports/sections        -> bölüm meta listesi (UI checkbox grid)
- POST   /reports                  -> yeni rapor üret (Celery enqueue)
- GET    /reports                  -> geçmiş rapor listesi (en yeni 50)
- GET    /reports/{id}             -> tek rapor durumu (polling)
- GET    /reports/{id}/download    -> tamamlanmış PDF indir
- DELETE /reports/{id}             -> soft delete + dosya temizle

İzinler:
- GET   -> REPORTS_VIEW
- POST  -> REPORTS_CREATE
- DELETE -> REPORTS_DELETE
"""

from __future__ import annotations

from pathlib import Path as FsPath
from typing import cast

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError, ValidationError
from app.core.permissions import Permission
from app.dependencies import get_db, require_permission
from app.models import Report, User
from app.schemas import (
    PaginatedEnvelope,
    PaginationMeta,
    ReportCreateRequest,
    ReportDetailResponse,
    ReportListItem,
    ReportSectionKey,
    ReportSectionMeta,
    ReportStatusKey,
    SuccessEnvelope,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _to_list_item(r: Report) -> ReportListItem:
    return ReportListItem(
        id=r.id,
        name=r.name,
        date_from=r.date_from,
        date_to=r.date_to,
        sections=cast(list[ReportSectionKey], list(r.sections or [])),
        language=r.language,
        status=cast(
            ReportStatusKey, r.status.value if hasattr(r.status, "value") else str(r.status)
        ),
        file_size_bytes=r.file_size_bytes,
        error_message=r.error_message,
        started_at=r.started_at,
        completed_at=r.completed_at,
        created_at=r.created_at,
    )


@router.get(
    "/sections",
    response_model=SuccessEnvelope[list[ReportSectionMeta]],
    summary="Rapor bölümlerini listele",
    description=(
        "PDF raporuna eklenebilecek bölümlerin meta listesini döner (başlık ve "
        "anahtar). Rapor oluşturma ekranındaki bölüm seçim ızgarasını besler."
    ),
)
async def list_sections(
    _current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
) -> SuccessEnvelope[list[ReportSectionMeta]]:
    return SuccessEnvelope(data=report_service.list_section_meta())


@router.post(
    "",
    response_model=SuccessEnvelope[ReportDetailResponse],
    status_code=201,
    summary="Yeni PDF rapor oluştur",
    description=(
        "Verilen tarih aralığı, seçili bölümler ve dil ile yeni bir PDF rapor "
        "üretimi başlatır. Üretim asenkrondur; istek Celery worker'a kuyruğa "
        "alınır. Yanıt, durumu 'pending' olan rapor kaydını döner. İlerleme "
        "durum sorgusu ile takip edilir."
    ),
)
async def create_report(
    payload: ReportCreateRequest,
    current_user: User = Depends(require_permission(Permission.REPORTS_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ReportDetailResponse]:
    report = await report_service.create_report(
        db,
        user=current_user,
        name=payload.name,
        date_from=payload.date_from,
        date_to=payload.date_to,
        sections=list(payload.sections),
        language=payload.language,
    )
    return SuccessEnvelope(data=ReportDetailResponse(**_to_list_item(report).model_dump()))


@router.get(
    "",
    response_model=PaginatedEnvelope[ReportListItem],
    summary="Raporları listele",
    description=(
        "Oluşturulmuş raporları en yeniden eskiye doğru sayfalı olarak döner. "
        "Her kayıt rapor adı, tarih aralığı, durum, dosya boyutu ve zaman "
        "damgalarını içerir."
    ),
)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[ReportListItem]:
    rows, total = await report_service.list_reports_paginated(
        db, page=page, page_size=page_size
    )
    return PaginatedEnvelope(
        data=[_to_list_item(r) for r in rows],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/{report_id}",
    response_model=SuccessEnvelope[ReportDetailResponse],
    summary="Rapor durumunu getir",
    description=(
        "Tek bir raporun güncel durumunu ve detayını döner. Frontend, rapor "
        "üretimi tamamlanana kadar bu ucu düzenli aralıklarla sorgular (polling)."
    ),
)
async def get_report(
    report_id: int = Path(..., ge=1),
    _current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ReportDetailResponse]:
    report = await report_service.get_report(db, report_id)
    return SuccessEnvelope(data=ReportDetailResponse(**_to_list_item(report).model_dump()))


@router.get(
    "/{report_id}/download",
    response_class=FileResponse,
    summary="Raporu PDF olarak indir",
    description=(
        "Tamamlanmış bir raporun PDF dosyasını indirir. Rapor henüz hazır "
        "değilse 422, dosya bulunamazsa 404 döner."
    ),
)
async def download_report(
    report_id: int = Path(..., ge=1),
    _current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    report = await report_service.get_report(db, report_id)
    if report.status.value != "completed" or not report.file_path:
        raise ValidationError("Report is not ready for download", field="status")
    fp = FsPath(report.file_path)
    if not fp.exists():
        raise ResourceNotFoundError(params={"report_id": report_id})
    safe_name = f"sporthink-report-{report_id}.pdf"
    return FileResponse(
        path=str(fp),
        media_type="application/pdf",
        filename=safe_name,
    )


@router.delete(
    "/{report_id}",
    response_model=SuccessEnvelope[dict],
    summary="Raporu sil",
    description=(
        "Rapor kaydını yumuşak siler (soft delete) ve üretilmiş PDF dosyasını diskten kaldırır."
    ),
)
async def delete_report(
    report_id: int = Path(..., ge=1),
    _current_user: User = Depends(require_permission(Permission.REPORTS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await report_service.delete_report(db, report_id)
    return SuccessEnvelope(data={"deleted": True})
