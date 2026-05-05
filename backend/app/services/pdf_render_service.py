"""PDF rapor render motoru — Jinja2 ile HTML compose, WeasyPrint ile PDF üret.

Tek public fonksiyon: `render_report_pdf(...)`. Veri toplama (`gather_*`)
ayrı bir servis tarafından yapılır; bu modül sadece "veri → PDF byte" işine
odaklanır. Test edilirken HTML içeriğine erişim için
`render_report_html(...)` ayrı tutuldu.
"""
from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "reports"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


# --------------------------------------------------------------------------- #
# i18n strings (hem TR hem EN — backend bağımlılığı i18next yerine inline)
# --------------------------------------------------------------------------- #

_LABELS: dict[str, dict[str, str]] = {
    "tr": {
        "report_title": "Pazarlama ve E-Ticaret Raporu",
        "subtitle": "Sporthink dashboard verileriyle hazırlanmıştır.",
        "footer": "Sporthink · Pazarlama ve E-Ticaret Raporu",
        "prepared_by": "Hazırlayan",
        "generated_at": "Üretim Zamanı",
        "sections": "Bölümler",
        "overview": "Genel Özet",
        "overview_desc": "Seçilen tarih aralığındaki temel performans göstergeleri.",
        "ga4": "GA4 Trafik",
        "ga4_desc": "Kanal kırılımında oturum, dönüşüm ve gelir.",
        "ads": "Reklam Performansı",
        "ads_desc": "Meta + Google Ads birleşik metrikleri.",
        "ecommerce": "E-Ticaret",
        "ecommerce_desc": "Satışlar, sepet ortalaması ve müşteri metrikleri.",
        "funnel": "Dönüşüm Hunisi",
        "funnel_desc": "Ürün görüntüleme → satın alma yolundaki adım kayıpları.",
        "top": "Top Performans",
        "top_desc": "En çok satan ürünler ve en değerli müşteriler.",
        "daily_revenue_trend": "Günlük Gelir Trendi",
        "channel": "Kanal",
        "sessions": "Oturum",
        "orders": "Sipariş",
        "revenue": "Gelir",
        "conv_rate": "Dönüşüm",
        "step": "Adım",
        "count": "Adet",
        "drop": "Önceki Adıma Göre",
        "top_products": "En Çok Satan Ürünler",
        "top_customers": "En Değerli Müşteriler",
        "sku": "SKU",
        "product": "Ürün",
        "units": "Adet",
        "customer": "Müşteri",
        "city": "Şehir",
        "no_data": "Bu dönem için veri yok.",
    },
    "en": {
        "report_title": "Marketing & E-commerce Report",
        "subtitle": "Compiled from the Sporthink dashboard.",
        "footer": "Sporthink · Marketing & E-commerce Report",
        "prepared_by": "Prepared by",
        "generated_at": "Generated at",
        "sections": "Sections",
        "overview": "Overview",
        "overview_desc": "Top-line performance metrics for the selected period.",
        "ga4": "GA4 Traffic",
        "ga4_desc": "Sessions, orders and revenue by channel.",
        "ads": "Advertising",
        "ads_desc": "Combined Meta + Google Ads performance.",
        "ecommerce": "E-commerce",
        "ecommerce_desc": "Orders, AOV and customer metrics.",
        "funnel": "Conversion Funnel",
        "funnel_desc": "Drop-offs from product view to purchase.",
        "top": "Top Performers",
        "top_desc": "Best-selling products and most valuable customers.",
        "daily_revenue_trend": "Daily Revenue Trend",
        "channel": "Channel",
        "sessions": "Sessions",
        "orders": "Orders",
        "revenue": "Revenue",
        "conv_rate": "Conv. Rate",
        "step": "Step",
        "count": "Count",
        "drop": "Drop vs prev.",
        "top_products": "Best-Selling Products",
        "top_customers": "Top Customers",
        "sku": "SKU",
        "product": "Product",
        "units": "Units",
        "customer": "Customer",
        "city": "City",
        "no_data": "No data for this period.",
    },
}


_SECTION_LABELS: dict[str, dict[str, str]] = {
    "tr": {
        "overview": "Genel Özet",
        "ga4": "GA4 Trafik",
        "ads": "Reklam",
        "ecommerce": "E-Ticaret",
        "funnel": "Dönüşüm Hunisi",
        "top": "Top Performans",
    },
    "en": {
        "overview": "Overview",
        "ga4": "GA4 Traffic",
        "ads": "Advertising",
        "ecommerce": "E-commerce",
        "funnel": "Funnel",
        "top": "Top Performers",
    },
}


# --------------------------------------------------------------------------- #
# Formatters
# --------------------------------------------------------------------------- #


def _fmt_currency(value: Decimal | None, lang: str) -> str:
    if value is None:
        return "—"
    n = Decimal(value)
    sign = "-" if n < 0 else ""
    n = abs(n)
    int_part, _, frac = f"{n:.2f}".partition(".")
    grouped = ""
    while len(int_part) > 3:
        grouped = "." + int_part[-3:] + grouped if lang == "tr" else "," + int_part[-3:] + grouped
        int_part = int_part[:-3]
    grouped = int_part + grouped
    sep = "," if lang == "tr" else "."
    if lang == "tr":
        return f"{sign}{grouped}{sep}{frac} ₺"
    return f"{sign}₺{grouped}{sep}{frac}"


def _fmt_int(value: int | Decimal | None, lang: str) -> str:
    if value is None:
        return "—"
    n = int(value)
    sign = "-" if n < 0 else ""
    s = str(abs(n))
    grouped = ""
    while len(s) > 3:
        grouped = "." + s[-3:] + grouped if lang == "tr" else "," + s[-3:] + grouped
        s = s[:-3]
    return sign + s + grouped


def _fmt_percent(value: Decimal | None, lang: str) -> str:
    if value is None:
        return "—"
    sign = "%" if lang == "tr" else "%"
    return f"%{value:.2f}".replace(".", ",") if lang == "tr" else f"{value:.2f}{sign}"


def _fmt_multiplier(value: Decimal | None) -> str:
    if value is None:
        return "—"
    return f"{value:.2f}x"


def _fmt_change(pct: Decimal | None, lang: str) -> tuple[str | None, str]:
    """Returns (formatted_string, direction). direction ∈ {positive, negative, flat}.

    Note: caller decides whether positive change is good (e.g. revenue up = good)
    or bad (e.g. bounce_rate up = bad) — we just colour by sign here, and the
    caller can override `change_dir` if needed.
    """
    if pct is None:
        return None, "flat"
    if pct > 0:
        s = f"▲ %{pct:.2f}" if lang == "tr" else f"▲ {pct:.2f}%"
        return s.replace(".", ",") if lang == "tr" else s, "positive"
    if pct < 0:
        s = f"▼ %{abs(pct):.2f}" if lang == "tr" else f"▼ {abs(pct):.2f}%"
        return s.replace(".", ",") if lang == "tr" else s, "negative"
    return ("0%", "flat")


# --------------------------------------------------------------------------- #
# KPI → card helpers
# --------------------------------------------------------------------------- #


def _kpi_card(
    label: str,
    value: Decimal | None,
    unit: str,
    change_pct: Decimal | None,
    *,
    trend_direction_positive: str,
    lang: str,
) -> dict[str, Any]:
    if unit == "currency":
        v = _fmt_currency(value, lang)
    elif unit == "percent":
        v = _fmt_percent(value, lang)
    elif unit == "multiplier":
        v = _fmt_multiplier(value)
    else:
        v = _fmt_int(value, lang)

    change_str, sign = _fmt_change(change_pct, lang)
    # if positive trend means down (e.g. bounce_rate), invert colour intent
    if change_str is not None and sign != "flat":
        if trend_direction_positive == "down":
            sign = "negative" if sign == "positive" else "positive"
    return {"label": label, "value": v, "change": change_str, "change_dir": sign}


def _build_overview_chart_svg(daily_points: list[dict[str, Any]], *, lang: str) -> str | None:
    """Tek seri günlük gelir line chart — minimal inline SVG (no JS).

    daily_points: [{date: 'YYYY-MM-DD', revenue: Decimal}, ...]
    Boş / tek nokta gelirse None döner; template "veri yok" gösterir.
    """
    if not daily_points or len(daily_points) < 2:
        return None

    pad = 24
    w = 760
    h = 220
    inner_w = w - 2 * pad
    inner_h = h - 2 * pad

    values = [float(p["revenue"]) for p in daily_points]
    vmax = max(values) if max(values) > 0 else 1.0

    n = len(values)
    points = []
    for i, v in enumerate(values):
        x = pad + (i * inner_w / (n - 1))
        y = pad + inner_h - (v / vmax) * inner_h
        points.append((x, y))

    path = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)
    area = (
        f"M {points[0][0]:.1f} {pad + inner_h:.1f} "
        + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)
        + f" L {points[-1][0]:.1f} {pad + inner_h:.1f} Z"
    )

    # x-axis tick labels — first / mid / last
    first_lbl = daily_points[0]["date"]
    mid_lbl = daily_points[n // 2]["date"]
    last_lbl = daily_points[-1]["date"]

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="none">
  <defs>
    <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fb7185" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#fb7185" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff"/>
  <path d="{area}" fill="url(#rev-grad)"/>
  <path d="{path}" fill="none" stroke="#be123c" stroke-width="2"/>
  <line x1="{pad}" y1="{pad + inner_h}" x2="{w - pad}" y2="{pad + inner_h}" stroke="#e5e7eb" stroke-width="1"/>
  <text x="{pad}" y="{h - 6}" font-size="9" fill="#9ca3af">{first_lbl}</text>
  <text x="{w / 2:.0f}" y="{h - 6}" font-size="9" text-anchor="middle" fill="#9ca3af">{mid_lbl}</text>
  <text x="{w - pad}" y="{h - 6}" font-size="9" text-anchor="end" fill="#9ca3af">{last_lbl}</text>
</svg>
""".strip()


# --------------------------------------------------------------------------- #
# Public render entry points
# --------------------------------------------------------------------------- #


def render_report_html(
    *,
    lang: str,
    sections: list[str],
    date_from_str: str,
    date_to_str: str,
    generated_at: datetime,
    created_by_name: str,
    overview_summary: Any | None,
    daily_revenue_points: list[dict[str, Any]],
    channel_rows: list[dict[str, str]],
    funnel_steps_view: list[dict[str, str]],
    top_products: list[dict[str, str]],
    top_customers: list[dict[str, str]],
    ads_kpis: list[dict[str, Any]],
    ecom_kpis: list[dict[str, Any]],
) -> str:
    labels = _LABELS.get(lang, _LABELS["tr"])
    section_label_map = _SECTION_LABELS.get(lang, _SECTION_LABELS["tr"])

    # --- overview KPI cards from KPISummary ---
    overview_kpis: list[dict[str, Any]] = []
    if "overview" in sections and overview_summary is not None:
        for attr, label_key, unit in [
            ("revenue", "revenue", "currency"),
            ("orders", "orders", "count"),
            ("aov", "AOV", "currency"),
            ("sessions", "sessions", "count"),
            ("users", "users", "count"),
            ("conversion_rate", "conv_rate", "percent"),
            ("bounce_rate", "Bounce", "percent"),
            ("roas", "ROAS", "multiplier"),
        ]:
            kpi = getattr(overview_summary, attr, None)
            if kpi is None:
                continue
            label = labels.get(label_key, kpi.label_tr if lang == "tr" else label_key)
            overview_kpis.append(
                _kpi_card(
                    label,
                    kpi.value,
                    unit,
                    kpi.change_percentage,
                    trend_direction_positive=kpi.trend_direction_positive,
                    lang=lang,
                )
            )

    overview_chart_svg = (
        _build_overview_chart_svg(daily_revenue_points, lang=lang)
        if "overview" in sections
        else None
    )

    template = _env.get_template("report.html.j2")
    css = (_TEMPLATES_DIR / "report.css").read_text(encoding="utf-8")

    return template.render(
        lang=lang,
        css=css,
        report_title=labels["report_title"],
        subtitle=labels["subtitle"],
        footer_label=labels["footer"],
        labels=labels,
        sections=sections,
        section_labels=[section_label_map[s] for s in sections if s in section_label_map],
        date_from_str=date_from_str,
        date_to_str=date_to_str,
        generated_at_str=generated_at.strftime("%d.%m.%Y %H:%M") if lang == "tr" else generated_at.strftime("%Y-%m-%d %H:%M"),
        created_by_name=created_by_name or "—",
        overview_kpis=overview_kpis,
        overview_chart_svg=overview_chart_svg,
        channel_rows=channel_rows,
        funnel_steps=funnel_steps_view,
        top_products=top_products,
        top_customers=top_customers,
        ads_kpis=ads_kpis,
        ecom_kpis=ecom_kpis,
    )


def render_report_pdf(
    *,
    output_path: Path,
    lang: str,
    sections: list[str],
    date_from_str: str,
    date_to_str: str,
    generated_at: datetime,
    created_by_name: str,
    overview_summary: Any | None,
    daily_revenue_points: list[dict[str, Any]],
    channel_rows: list[dict[str, str]],
    funnel_steps_view: list[dict[str, str]],
    top_products: list[dict[str, str]],
    top_customers: list[dict[str, str]],
    ads_kpis: list[dict[str, Any]],
    ecom_kpis: list[dict[str, Any]],
) -> int:
    """Returns generated file size in bytes."""
    html = render_report_html(
        lang=lang,
        sections=sections,
        date_from_str=date_from_str,
        date_to_str=date_to_str,
        generated_at=generated_at,
        created_by_name=created_by_name,
        overview_summary=overview_summary,
        daily_revenue_points=daily_revenue_points,
        channel_rows=channel_rows,
        funnel_steps_view=funnel_steps_view,
        top_products=top_products,
        top_customers=top_customers,
        ads_kpis=ads_kpis,
        ecom_kpis=ecom_kpis,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf(target=str(output_path))
    return output_path.stat().st_size


# Helpers for the data-gathering layer (report_service) — keep formatting
# logic owned by this module so the data layer can stay decoupled.

def fmt_currency(value: Decimal | None, lang: str) -> str:
    return _fmt_currency(value, lang)


def fmt_int(value: int | Decimal | None, lang: str) -> str:
    return _fmt_int(value, lang)


def fmt_percent(value: Decimal | None, lang: str) -> str:
    return _fmt_percent(value, lang)


def fmt_multiplier(value: Decimal | None) -> str:
    return _fmt_multiplier(value)


def kpi_card(
    label: str,
    value: Decimal | None,
    unit: str,
    change_pct: Decimal | None,
    *,
    trend_direction_positive: str = "up",
    lang: str = "tr",
) -> dict[str, Any]:
    return _kpi_card(
        label, value, unit, change_pct,
        trend_direction_positive=trend_direction_positive, lang=lang,
    )
