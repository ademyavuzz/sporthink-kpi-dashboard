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
        "executive_summary": "Yönetici Özeti",
        "executive_summary_desc": "Bu dönemin başlık metrikleri ve dikkat çeken noktalar.",
        "wins_title": "Öne Çıkanlar",
        "concerns_title": "Dikkat Edilmesi Gerekenler",
        "no_concerns": "Negatif yönde belirgin bir hareket yok.",
        "no_wins": "Henüz öne çıkan bir gelişme yok.",
        "comparison_note": "Tüm değişimler önceki eşit uzunluktaki döneme göre hesaplanmıştır.",
        "overview": "Genel Özet",
        "overview_desc": "Seçilen tarih aralığındaki temel performans göstergeleri.",
        "ga4": "Trafik (GA4)",
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
        "revenue_by_channel": "Kanal Bazında Gelir",
        "new_vs_returning": "Yeni vs Geri Dönen Müşteri",
        "new_vs_returning_desc": "Bu dönemde gelirin yeni ve mevcut müşteriler arasındaki dağılımı.",
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
        "page_label": "Sayfa",
    },
    "en": {
        "report_title": "Marketing & E-commerce Report",
        "subtitle": "Compiled from the Sporthink dashboard.",
        "footer": "Sporthink · Marketing & E-commerce Report",
        "prepared_by": "Prepared by",
        "generated_at": "Generated at",
        "sections": "Sections",
        "executive_summary": "Executive Summary",
        "executive_summary_desc": "Headline metrics and noteworthy movements for the period.",
        "wins_title": "Highlights",
        "concerns_title": "Watch List",
        "no_concerns": "No significant negative movement.",
        "no_wins": "No standout improvement yet.",
        "comparison_note": "All changes are vs. the previous equal-length period.",
        "overview": "Overview",
        "overview_desc": "Top-line performance metrics for the selected period.",
        "ga4": "Traffic (GA4)",
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
        "revenue_by_channel": "Revenue by Channel",
        "new_vs_returning": "New vs Returning Customers",
        "new_vs_returning_desc": "How revenue splits between new and returning customers this period.",
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
        "page_label": "Page",
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
    if change_str is not None and sign != "flat" and trend_direction_positive == "down":
        sign = "negative" if sign == "positive" else "positive"
    return {"label": label, "value": v, "change": change_str, "change_dir": sign}


def _format_short_currency(value: float, lang: str) -> str:
    """Eksenler için kısa biçim — 12.345 → '12,3K ₺'."""
    if value is None:
        return ""
    abs_v = abs(value)
    if abs_v >= 1_000_000:
        n = value / 1_000_000
        suffix = "M"
    elif abs_v >= 1_000:
        n = value / 1_000
        suffix = "K"
    else:
        s = f"{value:,.0f}".replace(",", "." if lang == "tr" else ",")
        return f"{s} ₺" if lang == "tr" else f"₺{s}"
    s = f"{n:.1f}".replace(".", "," if lang == "tr" else ".")
    return f"{s}{suffix} ₺" if lang == "tr" else f"₺{s}{suffix}"


def _build_overview_chart_svg(daily_points: list[dict[str, Any]], *, lang: str) -> str | None:
    """Günlük gelir line chart — Y ekseni etiketli, max/min işaretçili minimal SVG.

    daily_points: [{date: 'DD.MM' veya 'MM/DD', revenue: Decimal}, ...]
    Boş / tek nokta gelirse None döner; template "veri yok" gösterir.
    """
    if not daily_points or len(daily_points) < 2:
        return None

    # Layout
    w = 760
    h = 240
    pad_l = 56
    pad_r = 14
    pad_t = 14
    pad_b = 30
    inner_w = w - pad_l - pad_r
    inner_h = h - pad_t - pad_b

    values = [float(p["revenue"]) for p in daily_points]
    vmax = max(values) if max(values) > 0 else 1.0

    n = len(values)
    points = []
    for i, v in enumerate(values):
        x = pad_l + (i * inner_w / (n - 1))
        y = pad_t + inner_h - (v / vmax) * inner_h
        points.append((x, y))

    path = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)
    area = (
        f"M {points[0][0]:.1f} {pad_t + inner_h:.1f} "
        + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)
        + f" L {points[-1][0]:.1f} {pad_t + inner_h:.1f} Z"
    )

    # Y ekseni — 3 kademe (0, mid, max)
    y0_label = _format_short_currency(0.0, lang)
    y_mid_label = _format_short_currency(vmax / 2, lang)
    y_max_label = _format_short_currency(vmax, lang)

    # X ekseni — başı, ortayı, sonu işaretle (gün sayısına göre)
    tick_idx = sorted({0, n // 4, n // 2, (3 * n) // 4, n - 1})
    x_ticks_svg = ""
    for i in tick_idx:
        tx = pad_l + (i * inner_w / (n - 1))
        lbl = daily_points[i]["date"]
        anchor = "start" if i == 0 else ("end" if i == n - 1 else "middle")
        x_ticks_svg += (
            f'<text x="{tx:.1f}" y="{h - 8}" font-size="9" '
            f'text-anchor="{anchor}" fill="#9ca3af">{lbl}</text>'
        )

    # Tepe ve dip noktayı işaretle
    max_i = values.index(max(values))
    min_i = values.index(min(values))
    peak_x, peak_y = points[max_i]
    trough_x, trough_y = points[min_i]
    peak_label = _format_short_currency(values[max_i], lang)

    # Yatay grid çizgileri (4 kademe)
    grid_lines_svg = ""
    for frac in (0.0, 0.25, 0.5, 0.75, 1.0):
        gy = pad_t + inner_h - frac * inner_h
        grid_lines_svg += (
            f'<line x1="{pad_l}" y1="{gy:.1f}" x2="{w - pad_r}" y2="{gy:.1f}" '
            f'stroke="#f3f4f6" stroke-width="0.6"/>'
        )

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="none">
  <defs>
    <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fb7185" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#fb7185" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff"/>
  {grid_lines_svg}
  <path d="{area}" fill="url(#rev-grad)"/>
  <path d="{path}" fill="none" stroke="#be123c" stroke-width="2"/>
  <line x1="{pad_l}" y1="{pad_t + inner_h}" x2="{w - pad_r}" y2="{pad_t + inner_h}" stroke="#e5e7eb" stroke-width="1"/>
  <!-- Y axis labels -->
  <text x="{pad_l - 6}" y="{pad_t + inner_h + 3}" font-size="8.5" text-anchor="end" fill="#9ca3af">{y0_label}</text>
  <text x="{pad_l - 6}" y="{pad_t + inner_h / 2 + 3}" font-size="8.5" text-anchor="end" fill="#9ca3af">{y_mid_label}</text>
  <text x="{pad_l - 6}" y="{pad_t + 3}" font-size="8.5" text-anchor="end" fill="#9ca3af">{y_max_label}</text>
  <!-- X axis labels -->
  {x_ticks_svg}
  <!-- Peak / trough markers -->
  <circle cx="{peak_x:.1f}" cy="{peak_y:.1f}" r="3" fill="#be123c"/>
  <circle cx="{trough_x:.1f}" cy="{trough_y:.1f}" r="2.5" fill="#9ca3af"/>
  <text x="{peak_x:.1f}" y="{max(peak_y - 6, pad_t + 8):.1f}" font-size="9" font-weight="700" text-anchor="middle" fill="#be123c">{peak_label}</text>
</svg>
""".strip()


def _build_funnel_svg(steps: list[dict[str, Any]], *, lang: str) -> str | None:
    """Yatay funnel — her adım sol-hizalı bir bar; genişlik en yüksek count'a oranlı.

    steps: [{label, count_int, count_str, drop_str (None or 'down'), retention_pct}]
    """
    if not steps:
        return None

    w = 760
    row_h = 46
    gap = 10
    h = len(steps) * row_h + (len(steps) - 1) * gap + 12
    label_w = 180
    bar_x = label_w + 14
    bar_track_w = w - bar_x - 14

    counts = [int(s["count_int"]) for s in steps]
    cmax = max(counts) if counts else 1

    rows_svg = ""
    palette = ["#be123c", "#e11d48", "#f43f5e", "#fb7185"]
    for i, s in enumerate(steps):
        y = i * (row_h + gap) + 6
        cnt = counts[i]
        bar_w = (cnt / cmax) * bar_track_w if cmax else 0
        color = palette[min(i, len(palette) - 1)]
        # Drop annotation (eğer ilk adımdan farklıysa)
        drop_anno = ""
        if s.get("drop_str"):
            drop_label_tr = "kayıp" if lang == "tr" else "drop"
            drop_anno = (
                f'<text x="{bar_x + bar_track_w}" y="{y + row_h / 2 + 4}" '
                f'font-size="9" text-anchor="end" fill="#dc2626" font-weight="600">'
                f"− {s['drop_str']} {drop_label_tr}"
                f"</text>"
            )

        # Retention badge (kümülatif vs ilk adım)
        if cmax > 0:
            ret_pct = cnt * 100.0 / cmax
            ret_label = (
                (f"{ret_pct:.1f}".replace(".", ",") + "%") if lang == "tr" else f"{ret_pct:.1f}%"
            )
        else:
            ret_label = ""

        rows_svg += f"""
  <g>
    <rect x="0" y="{y}" width="{label_w}" height="{row_h}" fill="#ffffff"/>
    <text x="0" y="{y + 18}" font-size="9.5" font-weight="700" fill="#374151">{s['label']}</text>
    <text x="0" y="{y + 34}" font-size="11" font-weight="800" fill="#111827">{s['count_str']}</text>
    <rect x="{bar_x}" y="{y + 6}" width="{bar_track_w}" height="{row_h - 12}" rx="5" ry="5" fill="#f3f4f6"/>
    <rect x="{bar_x}" y="{y + 6}" width="{bar_w:.1f}" height="{row_h - 12}" rx="5" ry="5" fill="{color}"/>
    <text x="{bar_x + 8}" y="{y + row_h / 2 + 4}" font-size="9" font-weight="700" fill="#ffffff">{ret_label}</text>
    {drop_anno}
  </g>
"""

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
  <rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff"/>
  {rows_svg}
</svg>
""".strip()


def _build_channel_bar_svg(rows: list[dict[str, Any]], *, lang: str) -> str | None:
    """Kanal × gelir yatay bar chart. rows: [{channel, revenue_float, revenue_str}].

    En çok gelir getiren ilk N kanal (zaten sıralanmış varsayılır)."""
    if not rows:
        return None

    w = 760
    row_h = 22
    gap = 6
    rows = rows[:8]  # Top 8 kanal
    h = len(rows) * row_h + (len(rows) - 1) * gap + 12
    label_w = 150
    bar_x = label_w + 10
    val_w = 120
    bar_track_w = w - bar_x - val_w - 8

    rmax = max((float(r["revenue_float"]) for r in rows), default=0.0) or 1.0

    rows_svg = ""
    for i, r in enumerate(rows):
        y = i * (row_h + gap) + 6
        v = float(r["revenue_float"])
        bw = (v / rmax) * bar_track_w
        rows_svg += f"""
  <g>
    <text x="0" y="{y + row_h / 2 + 4}" font-size="9.5" fill="#374151">{r['channel']}</text>
    <rect x="{bar_x}" y="{y + 3}" width="{bar_track_w}" height="{row_h - 6}" rx="3" ry="3" fill="#f3f4f6"/>
    <rect x="{bar_x}" y="{y + 3}" width="{bw:.1f}" height="{row_h - 6}" rx="3" ry="3" fill="#be123c"/>
    <text x="{bar_x + bar_track_w + 6}" y="{y + row_h / 2 + 4}" font-size="9.5" font-weight="700" text-anchor="start" fill="#111827">{r['revenue_str']}</text>
  </g>
"""

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
  <rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff"/>
  {rows_svg}
</svg>
""".strip()


def _build_new_returning_svg(
    new_revenue: Decimal | None,
    returning_revenue: Decimal | None,
    *,
    lang: str,
) -> str | None:
    """Yeni vs geri dönen müşteri stacked bar — tek satır, iki segment yüzde labelıyla."""
    if new_revenue is None and returning_revenue is None:
        return None
    n_v = float(new_revenue or 0)
    r_v = float(returning_revenue or 0)
    total = n_v + r_v
    if total <= 0:
        return None

    n_pct = n_v * 100.0 / total
    r_pct = 100.0 - n_pct

    new_label = "Yeni" if lang == "tr" else "New"
    ret_label = "Geri Dönen" if lang == "tr" else "Returning"

    def fmt_pct(x: float) -> str:
        if lang == "tr":
            return f"%{x:.1f}".replace(".", ",")
        return f"{x:.1f}%"

    w = 760
    h = 70
    bar_y = 10
    bar_h = 22
    bar_w = w - 20

    new_w = bar_w * n_pct / 100.0
    ret_w = bar_w * r_pct / 100.0

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
  <rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff"/>
  <rect x="10" y="{bar_y}" width="{new_w:.1f}" height="{bar_h}" rx="4" fill="#be123c"/>
  <rect x="{10 + new_w:.1f}" y="{bar_y}" width="{ret_w:.1f}" height="{bar_h}" rx="4" fill="#94a3b8"/>
  <!-- Inline percentage labels -->
  <text x="{10 + max(new_w / 2, 18):.1f}" y="{bar_y + bar_h / 2 + 4}" font-size="10" font-weight="700" text-anchor="middle" fill="#ffffff">{fmt_pct(n_pct)}</text>
  <text x="{10 + new_w + max(ret_w / 2, 18):.1f}" y="{bar_y + bar_h / 2 + 4}" font-size="10" font-weight="700" text-anchor="middle" fill="#ffffff">{fmt_pct(r_pct)}</text>
  <!-- Legend -->
  <rect x="10" y="{bar_y + bar_h + 14}" width="9" height="9" rx="2" fill="#be123c"/>
  <text x="22" y="{bar_y + bar_h + 22}" font-size="9.5" fill="#374151">{new_label}</text>
  <rect x="120" y="{bar_y + bar_h + 14}" width="9" height="9" rx="2" fill="#94a3b8"/>
  <text x="132" y="{bar_y + bar_h + 22}" font-size="9.5" fill="#374151">{ret_label}</text>
</svg>
""".strip()


# --------------------------------------------------------------------------- #
# Executive summary — KPI delta'larından otomatik içgörü üretici
# --------------------------------------------------------------------------- #


def _format_kpi_value(kpi: Any, lang: str) -> str:
    """Tek KPI'yı birim'e göre formatla (label/aciklama içine inline yazılabilir)."""
    if kpi is None or kpi.value is None:
        return "—"
    unit = kpi.unit
    if unit == "currency":
        return _fmt_currency(kpi.value, lang)
    if unit == "percent":
        return _fmt_percent(kpi.value, lang)
    if unit == "multiplier":
        return _fmt_multiplier(kpi.value)
    return _fmt_int(kpi.value, lang)


def _format_delta_signed(pct: Decimal | None, lang: str) -> str:
    if pct is None:
        return "—"
    sign = "+" if pct >= 0 else ""
    if lang == "tr":
        return f"{sign}{pct:.1f}".replace(".", ",") + "%"
    return f"{sign}{pct:.1f}%"


def build_executive_summary(
    summary: Any | None,
    *,
    lang: str,
) -> dict[str, Any]:
    """KPISummary'den anlatım + öne çıkanlar/dikkat madde listeleri üret.

    Returns dict with keys:
      - headline_kpis: 4-card list (revenue, orders, sessions, roas)
      - narrative: kısa anlatım metni
      - wins: list[str] — pozitif değişen 3 KPI cümleleri
      - concerns: list[str] — negatif yönde değişen 3 KPI cümleleri
    """
    if summary is None:
        return {"headline_kpis": [], "narrative": None, "wins": [], "concerns": []}

    labels = _LABELS.get(lang, _LABELS["tr"])

    # Headline 4 kart
    headline_kpis: list[dict[str, Any]] = []
    for attr, label_key, unit in [
        ("revenue", "revenue", "currency"),
        ("orders", "orders", "count"),
        ("sessions", "sessions", "count"),
        ("roas", "ROAS", "multiplier"),
    ]:
        kpi = getattr(summary, attr, None)
        if kpi is None:
            continue
        label = labels.get(label_key, label_key)
        headline_kpis.append(
            _kpi_card(
                label,
                kpi.value,
                unit,
                kpi.change_percentage,
                trend_direction_positive=kpi.trend_direction_positive,
                lang=lang,
            )
        )

    # Wins / concerns ayrımı: change_percentage'a göre is_positive bayrağı
    items: list[tuple[Any, str]] = []
    for attr in (
        "revenue",
        "orders",
        "aov",
        "sessions",
        "users",
        "conversion_rate",
        "bounce_rate",
        "ad_spend",
        "roas",
    ):
        kpi = getattr(summary, attr, None)
        if kpi is None or kpi.change_percentage is None or kpi.value is None:
            continue
        items.append((kpi, attr))

    def _abs_change(item: tuple[Any, str]) -> float:
        return abs(float(item[0].change_percentage))

    items.sort(key=_abs_change, reverse=True)

    wins: list[str] = []
    concerns: list[str] = []
    for kpi, _attr in items:
        line_label = kpi.label_tr if lang == "tr" else kpi.kpi_id.replace("_", " ").title()
        delta_str = _format_delta_signed(kpi.change_percentage, lang)
        value_str = _format_kpi_value(kpi, lang)
        sentence = f"{line_label}: {value_str} ({delta_str})"
        if kpi.is_positive and len(wins) < 3:
            wins.append(sentence)
        elif not kpi.is_positive and len(concerns) < 3:
            concerns.append(sentence)
        if len(wins) >= 3 and len(concerns) >= 3:
            break

    # Anlatım — top revenue + ROAS + sessions üzerinden basit cümle
    rev = getattr(summary, "revenue", None)
    orders = getattr(summary, "orders", None)
    roas = getattr(summary, "roas", None)
    if rev is not None and rev.value is not None:
        rev_str = _format_kpi_value(rev, lang)
        rev_delta = (
            _format_delta_signed(rev.change_percentage, lang)
            if rev.change_percentage is not None
            else None
        )
        if lang == "tr":
            n_parts = [f"Bu dönemde toplam gelir {rev_str}"]
            if rev_delta:
                n_parts[-1] += f" ({rev_delta})"
            if orders is not None and orders.value is not None:
                n_parts.append(f"{_format_kpi_value(orders, lang)} sipariş alındı")
            if roas is not None and roas.value is not None:
                n_parts.append(f"reklam ROAS {_format_kpi_value(roas, lang)}")
            narrative = ", ".join(n_parts) + "."
        else:
            n_parts = [f"Total revenue for the period was {rev_str}"]
            if rev_delta:
                n_parts[-1] += f" ({rev_delta})"
            if orders is not None and orders.value is not None:
                n_parts.append(f"{_format_kpi_value(orders, lang)} orders received")
            if roas is not None and roas.value is not None:
                n_parts.append(f"ad ROAS {_format_kpi_value(roas, lang)}")
            narrative = ", ".join(n_parts) + "."
    else:
        narrative = None

    return {
        "headline_kpis": headline_kpis,
        "narrative": narrative,
        "wins": wins,
        "concerns": concerns,
    }


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
    channel_bar_rows: list[dict[str, Any]] | None = None,
    funnel_steps_view: list[dict[str, str]],
    funnel_chart_steps: list[dict[str, Any]] | None = None,
    top_products: list[dict[str, str]],
    top_customers: list[dict[str, str]],
    ads_kpis: list[dict[str, Any]],
    ecom_kpis: list[dict[str, Any]],
    new_revenue: Decimal | None = None,
    returning_revenue: Decimal | None = None,
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

    channel_bar_svg = (
        _build_channel_bar_svg(channel_bar_rows or [], lang=lang) if "ga4" in sections else None
    )

    funnel_chart_svg = (
        _build_funnel_svg(funnel_chart_steps or [], lang=lang) if "funnel" in sections else None
    )

    new_returning_svg = (
        _build_new_returning_svg(new_revenue, returning_revenue, lang=lang)
        if "ecommerce" in sections
        else None
    )

    exec_summary = build_executive_summary(overview_summary, lang=lang)

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
        section_label_map=section_label_map,
        date_from_str=date_from_str,
        date_to_str=date_to_str,
        generated_at_str=generated_at.strftime("%d.%m.%Y %H:%M")
        if lang == "tr"
        else generated_at.strftime("%Y-%m-%d %H:%M"),
        created_by_name=created_by_name or "—",
        overview_kpis=overview_kpis,
        overview_chart_svg=overview_chart_svg,
        channel_rows=channel_rows,
        channel_bar_svg=channel_bar_svg,
        funnel_steps=funnel_steps_view,
        funnel_chart_svg=funnel_chart_svg,
        new_returning_svg=new_returning_svg,
        top_products=top_products,
        top_customers=top_customers,
        ads_kpis=ads_kpis,
        ecom_kpis=ecom_kpis,
        exec_summary=exec_summary,
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
    channel_bar_rows: list[dict[str, Any]] | None = None,
    funnel_steps_view: list[dict[str, str]],
    funnel_chart_steps: list[dict[str, Any]] | None = None,
    top_products: list[dict[str, str]],
    top_customers: list[dict[str, str]],
    ads_kpis: list[dict[str, Any]],
    ecom_kpis: list[dict[str, Any]],
    new_revenue: Decimal | None = None,
    returning_revenue: Decimal | None = None,
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
        channel_bar_rows=channel_bar_rows,
        funnel_steps_view=funnel_steps_view,
        funnel_chart_steps=funnel_chart_steps,
        top_products=top_products,
        top_customers=top_customers,
        ads_kpis=ads_kpis,
        ecom_kpis=ecom_kpis,
        new_revenue=new_revenue,
        returning_revenue=returning_revenue,
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
        label,
        value,
        unit,
        change_pct,
        trend_direction_positive=trend_direction_positive,
        lang=lang,
    )
