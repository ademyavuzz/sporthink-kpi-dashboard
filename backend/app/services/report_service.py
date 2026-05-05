"""Rapor üretim modülü — orkestrasyon servisi.

Sorumluluklar:
- Report kaydı oluşturma + Celery task enqueue (`create_report`)
- Listeleme, detay (`list_reports`, `get_report`)
- Soft delete + dosya temizlik (`delete_report`)
- Worker tarafından çağrılan veri toplama + PDF render (`generate_report_pdf`)

`pdf_render_service` saf render, `report_service` veri çekme + lifecycle
yönetimi yapar — bu ayrım test edilebilirliği kolaylaştırır.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ResourceNotFoundError, ValidationError
from app.models import Report, User
from app.repositories import report_repository as repo
from app.schemas.reports import ReportSectionMeta
from app.services import (
    customer_service,
    kpi_service,
    pdf_render_service,
)

logger = logging.getLogger(__name__)

ALL_SECTIONS = ["overview", "ga4", "ads", "ecommerce", "funnel", "top"]


# --------------------------------------------------------------------------- #
# Section meta — frontend section picker için
# --------------------------------------------------------------------------- #


SECTION_META: list[ReportSectionMeta] = [
    ReportSectionMeta(
        key="overview",
        label_tr="Genel Özet",
        label_en="Overview",
        description_tr="Gelir, sipariş, AOV, oturum, kullanıcı, dönüşüm, ROAS — 8 KPI + günlük trend.",
        description_en="Revenue, orders, AOV, sessions, users, conversion, ROAS — 8 KPIs + daily trend.",
    ),
    ReportSectionMeta(
        key="ga4",
        label_tr="GA4 Trafik",
        label_en="GA4 Traffic",
        description_tr="Kanal kırılımında oturum, dönüşüm ve gelir tablosu.",
        description_en="Sessions, orders and revenue by channel.",
    ),
    ReportSectionMeta(
        key="ads",
        label_tr="Reklam Performansı",
        label_en="Advertising",
        description_tr="Meta + Google Ads birleşik harcama, gösterim, tıklama, ROAS.",
        description_en="Combined Meta + Google Ads spend, impressions, clicks, ROAS.",
    ),
    ReportSectionMeta(
        key="ecommerce",
        label_tr="E-Ticaret",
        label_en="E-commerce",
        description_tr="Gelir, sipariş, AOV, refund oranı, müşteri başına gelir.",
        description_en="Revenue, orders, AOV, refund rate, revenue per user.",
    ),
    ReportSectionMeta(
        key="funnel",
        label_tr="Dönüşüm Hunisi",
        label_en="Conversion Funnel",
        description_tr="Görüntüleme → sepet → ödeme → satın alma kayıpları.",
        description_en="View → cart → checkout → purchase drop-offs.",
    ),
    ReportSectionMeta(
        key="top",
        label_tr="Top Performans",
        label_en="Top Performers",
        description_tr="En çok satan 10 ürün ve en değerli 10 müşteri.",
        description_en="Top 10 best-selling products and top 10 customers.",
    ),
]


def list_section_meta() -> list[ReportSectionMeta]:
    return SECTION_META


# --------------------------------------------------------------------------- #
# CRUD
# --------------------------------------------------------------------------- #


async def create_report(
    db: AsyncSession,
    *,
    user: User,
    name: str | None,
    date_from: date,
    date_to: date,
    sections: list[str],
    language: str,
) -> Report:
    if date_from > date_to:
        raise ValidationError("date_from must be <= date_to", field="date_from")
    if not sections:
        raise ValidationError("At least one section required", field="sections")
    invalid = [s for s in sections if s not in ALL_SECTIONS]
    if invalid:
        raise ValidationError(f"Unknown section keys: {invalid}", field="sections")

    final_name = (name or "").strip() or _default_report_name(date_from, date_to, language)

    report = await repo.create(
        db,
        user_id=user.id,
        name=final_name,
        date_from=date_from,
        date_to=date_to,
        sections=sections,
        language=language,
    )
    await db.commit()
    # `created_at` MySQL DEFAULT CURRENT_TIMESTAMP ile set ediliyor; insert sonrası
    # ORM instance'a otomatik yüklenmez. Response serialize'da lazy-load
    # tetiklenmesin diye explicit refresh.
    await db.refresh(report)

    # Celery task'ı burada enqueue ediyoruz — ImportError'u önlemek için lazy
    # import (celery_app worker'ı, FastAPI worker'ından farklı process).
    from app.tasks.report_tasks import generate_report_task

    generate_report_task.delay(report.id)
    logger.info("report_create_enqueued report_id=%d", report.id)
    return report


def _default_report_name(date_from: date, date_to: date, language: str) -> str:
    if language == "en":
        return f"Sporthink Report {date_from:%Y-%m-%d} - {date_to:%Y-%m-%d}"
    return f"Sporthink Raporu {date_from:%d.%m.%Y} - {date_to:%d.%m.%Y}"


async def list_reports(db: AsyncSession, *, limit: int = 50) -> list[Report]:
    return await repo.list_recent(db, limit=limit)


async def get_report(db: AsyncSession, report_id: int) -> Report:
    report = await repo.get_by_id(db, report_id)
    if report is None:
        raise ResourceNotFoundError(params={"report_id": report_id})
    return report


async def delete_report(db: AsyncSession, report_id: int) -> None:
    report = await repo.get_by_id(db, report_id)
    if report is None:
        raise ResourceNotFoundError(params={"report_id": report_id})
    if report.file_path:
        try:
            Path(report.file_path).unlink(missing_ok=True)
        except OSError as e:
            logger.warning("report_file_unlink_failed report_id=%d err=%s", report_id, e)
    await repo.soft_delete(db, report_id)


# --------------------------------------------------------------------------- #
# Worker side — data gathering + PDF render
# --------------------------------------------------------------------------- #


async def generate_report_pdf(db: AsyncSession, report_id: int) -> None:
    """Worker'dan çağrılır. Veri toplar, PDF render eder, dosyayı yazar,
    status'ü `completed` veya `failed` olarak günceller.
    """
    report = await repo.get_by_id(db, report_id)
    if report is None:
        logger.error("report_not_found_for_generation report_id=%d", report_id)
        return

    await repo.mark_generating(db, report_id)
    logger.info(
        "report_generation_start report_id=%d sections=%s",
        report_id,
        report.sections,
    )

    try:
        # --- Created-by name ---
        from sqlalchemy import select

        user_name = "—"
        if report.user_id:
            user = (
                await db.execute(select(User).where(User.id == report.user_id))
            ).scalar_one_or_none()
            if user is not None:
                user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email

        sections = report.sections
        lang = report.language or "tr"

        # --- Data gather ---
        overview_summary = None
        daily_revenue_points: list[dict[str, Any]] = []
        if "overview" in sections:
            overview_summary = await kpi_service.calculate_summary(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
            )
            series = await kpi_service.daily_revenue_series(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
            )
            daily_revenue_points = [
                {
                    "date": p.date.strftime("%d.%m" if lang == "tr" else "%m/%d"),
                    "revenue": p.revenue,
                }
                for p in series
            ]

        channel_rows: list[dict[str, str]] = []
        channel_bar_rows: list[dict[str, Any]] = []
        if "ga4" in sections:
            channels = await kpi_service.revenue_by_channel(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
                limit=10,
            )
            unknown_label = "(Bilinmiyor)" if lang == "tr" else "(Unknown)"
            for c in channels:
                ch_label = c.channel or unknown_label
                channel_rows.append(
                    {
                        "channel": ch_label,
                        "sessions": pdf_render_service.fmt_int(c.sessions, lang),
                        "orders": pdf_render_service.fmt_int(c.orders, lang),
                        "revenue": pdf_render_service.fmt_currency(c.revenue, lang),
                        "conv_rate": pdf_render_service.fmt_percent(c.conversion_rate, lang),
                    }
                )
                channel_bar_rows.append(
                    {
                        "channel": ch_label,
                        "revenue_float": float(c.revenue or 0),
                        "revenue_str": pdf_render_service.fmt_currency(c.revenue, lang),
                    }
                )

        # KPI fonksiyonları comparison için prev_from/prev_to bekliyor; sequential
        # mod (önceki eşit uzunluktaki dönem) raporlarda standart.
        prev_from, prev_to = kpi_service.compute_comparison_period(
            report.date_from, report.date_to, mode="sequential"
        )
        prev_kwargs = {"prev_from": prev_from, "prev_to": prev_to}

        ads_kpis: list[dict[str, Any]] = []
        if "ads" in sections:
            # 8 reklam KPI'sı — fresh çek, bazıları KPISummary'de yok.
            summary_for_ads = overview_summary or await kpi_service.calculate_summary(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
            )
            impressions_kpi = await kpi_service.kpi_impressions(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            clicks_kpi = await kpi_service.kpi_clicks(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            ctr_kpi = await kpi_service.kpi_ctr(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            cpc_kpi = await kpi_service.kpi_cpc(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            ad_conv_kpi = await kpi_service.kpi_ad_conversions(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            cost_per_conv_kpi = await kpi_service.kpi_cost_per_conversion(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            ads_lineup = [
                (summary_for_ads.ad_spend, "Reklam Harcaması", "Ad Spend", "currency"),
                (summary_for_ads.roas, "ROAS", "ROAS", "multiplier"),
                (impressions_kpi, "Gösterim", "Impressions", "count"),
                (clicks_kpi, "Tıklama", "Clicks", "count"),
                (ctr_kpi, "CTR", "CTR", "percent"),
                (cpc_kpi, "CPC", "CPC", "currency"),
                (ad_conv_kpi, "Reklam Dönüşümü", "Ad Conversions", "count"),
                (cost_per_conv_kpi, "Dönüşüm Maliyeti", "Cost / Conversion", "currency"),
            ]
            for kpi, label_tr, label_en, unit in ads_lineup:
                if kpi is None:
                    continue
                ads_kpis.append(
                    pdf_render_service.kpi_card(
                        label_tr if lang == "tr" else label_en,
                        kpi.value,
                        unit,
                        kpi.change_percentage,
                        trend_direction_positive=kpi.trend_direction_positive,
                        lang=lang,
                    )
                )

        ecom_kpis: list[dict[str, Any]] = []
        new_revenue: Decimal | None = None
        returning_revenue: Decimal | None = None
        if "ecommerce" in sections:
            summary_for_ecom = overview_summary or await kpi_service.calculate_summary(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
            )
            refund_kpi = await kpi_service.kpi_refund_rate(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            repeat_kpi = await kpi_service.kpi_repeat_purchase_rate(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            rpu_kpi = await kpi_service.kpi_revenue_per_user(
                db, date_from=report.date_from, date_to=report.date_to, **prev_kwargs
            )
            ecom_lineup = [
                (summary_for_ecom.revenue, "Gelir", "Revenue", "currency"),
                (summary_for_ecom.orders, "Sipariş", "Orders", "count"),
                (summary_for_ecom.aov, "Sepet Ortalaması", "AOV", "currency"),
                (refund_kpi, "İade Oranı", "Refund Rate", "percent"),
                (repeat_kpi, "Tekrar Satın Alma", "Repeat Purchase", "percent"),
                (rpu_kpi, "Müşteri Başına Gelir", "Revenue / User", "currency"),
            ]
            for kpi, label_tr, label_en, unit in ecom_lineup:
                if kpi is None:
                    continue
                ecom_kpis.append(
                    pdf_render_service.kpi_card(
                        label_tr if lang == "tr" else label_en,
                        kpi.value,
                        unit,
                        kpi.change_percentage,
                        trend_direction_positive=kpi.trend_direction_positive,
                        lang=lang,
                    )
                )
            # New vs returning revenue
            try:
                ctr_revenue = await kpi_service.new_vs_returning_revenue(
                    db,
                    date_from=report.date_from,
                    date_to=report.date_to,
                )
                for row in ctr_revenue:
                    if row.customer_type == "new":
                        new_revenue = row.revenue
                    elif row.customer_type == "returning":
                        returning_revenue = row.revenue
            except Exception:
                logger.exception("new_vs_returning_failed report_id=%d", report_id)

        funnel_view: list[dict[str, str]] = []
        funnel_chart_steps: list[dict[str, Any]] = []
        if "funnel" in sections:
            steps = await kpi_service.funnel_steps(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
            )
            label_map_en = {
                "view": "View",
                "add_to_cart": "Add to cart",
                "checkout": "Checkout",
                "purchase": "Purchase",
            }
            for s in steps:
                drop_str = (
                    pdf_render_service.fmt_percent(s.drop_from_previous_pct, lang)
                    if s.drop_from_previous_pct is not None
                    else "—"
                )
                step_label = s.label_tr if lang == "tr" else label_map_en[s.step]
                funnel_view.append(
                    {
                        "label": step_label,
                        "count": pdf_render_service.fmt_int(s.count, lang),
                        "drop": drop_str,
                    }
                )
                funnel_chart_steps.append(
                    {
                        "label": step_label,
                        "count_int": s.count,
                        "count_str": pdf_render_service.fmt_int(s.count, lang),
                        "drop_str": (
                            pdf_render_service.fmt_percent(s.drop_from_previous_pct, lang)
                            if s.drop_from_previous_pct is not None
                            else None
                        ),
                    }
                )

        top_products_view: list[dict[str, str]] = []
        top_customers_view: list[dict[str, str]] = []
        if "top" in sections:
            products = await kpi_service.top_products(
                db,
                date_from=report.date_from,
                date_to=report.date_to,
                limit=10,
            )
            for p in products:
                top_products_view.append(
                    {
                        "sku": p.sku,
                        "name": p.product_name or "—",
                        "units": pdf_render_service.fmt_int(p.units_sold, lang),
                        "revenue": pdf_render_service.fmt_currency(p.revenue, lang),
                    }
                )

            customers = await customer_service.top_customers(db, limit=10)
            for c in customers:
                top_customers_view.append(
                    {
                        "name": c.customer_name or c.customer_id,
                        "city": c.city or "—",
                        "orders": pdf_render_service.fmt_int(c.total_orders, lang),
                        "revenue": pdf_render_service.fmt_currency(c.total_revenue, lang),
                    }
                )

        # --- Date strings ---
        if lang == "tr":
            date_from_str = report.date_from.strftime("%d.%m.%Y")
            date_to_str = report.date_to.strftime("%d.%m.%Y")
        else:
            date_from_str = report.date_from.strftime("%Y-%m-%d")
            date_to_str = report.date_to.strftime("%Y-%m-%d")

        # --- Output path ---
        upload_root = Path(settings.upload_dir) / "reports"
        upload_root.mkdir(parents=True, exist_ok=True)
        output_path = upload_root / f"report-{report_id}.pdf"

        size = pdf_render_service.render_report_pdf(
            output_path=output_path,
            lang=lang,
            sections=sections,
            date_from_str=date_from_str,
            date_to_str=date_to_str,
            generated_at=datetime.now(UTC),
            created_by_name=user_name,
            overview_summary=overview_summary,
            daily_revenue_points=daily_revenue_points,
            channel_rows=channel_rows,
            channel_bar_rows=channel_bar_rows,
            funnel_steps_view=funnel_view,
            funnel_chart_steps=funnel_chart_steps,
            top_products=top_products_view,
            top_customers=top_customers_view,
            ads_kpis=ads_kpis,
            ecom_kpis=ecom_kpis,
            new_revenue=new_revenue,
            returning_revenue=returning_revenue,
        )

        await repo.mark_completed(
            db,
            report_id,
            file_path=str(output_path),
            file_size_bytes=size,
        )
        logger.info("report_generation_complete report_id=%d size=%d", report_id, size)

    except Exception as e:  # noqa: BLE001 — task üst seviye guard
        logger.exception("report_generation_failed report_id=%d", report_id)
        await repo.mark_failed(db, report_id, error_message=str(e))
        raise
