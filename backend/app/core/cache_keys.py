"""Cache anahtarı üreticileri — TÜM Redis key'leri burada üretilir.

Endpoint'lerde string concat ile key kurmak yasak (`backend/CLAUDE.md` §9.1).
TTL standartları (§9.2):
- KPI summary / chart sonuçları: 5 dakika
- Kullanıcı izinleri: 5 dakika
- Filter dropdown listeleri: 30 dakika
- Statik referanslar (rol, channel_mapping): 1 saat

Invalidasyon: yeni import sonrası `kpi:*`, role değişiminde `user_perms:*`.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date
from typing import Any


def _hash(payload: Any) -> str:
    """Filter / parametre kombinasyonu için kısa hash (lookup için stabil)."""
    raw = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha1(raw).hexdigest()[:12]


# --- TTL'ler (saniye) ---
TTL_KPI = 5 * 60  # 5 dk
TTL_USER_PERMS = 5 * 60  # 5 dk
TTL_FILTERS = 30 * 60  # 30 dk
TTL_STATIC = 60 * 60  # 1 saat


# --- KPI summary / dashboard sonuçları ---


def kpi_summary(
    *,
    date_from: date,
    date_to: date,
    comparison_mode: str = "sequential",
    extra_filters: dict[str, Any] | None = None,
) -> str:
    """`/dashboard/overview` cevabı."""
    payload = {
        "from": str(date_from),
        "to": str(date_to),
        "cmp": comparison_mode,
        "f": extra_filters or {},
    }
    return f"kpi:summary:{_hash(payload)}"


def kpi_dashboard(
    page: str,
    *,
    date_from: date,
    date_to: date,
    extra_filters: dict[str, Any] | None = None,
) -> str:
    """`/dashboard/{page}` (traffic, meta, google, ecom, campaign, ...) cevabı."""
    payload = {
        "page": page,
        "from": str(date_from),
        "to": str(date_to),
        "f": extra_filters or {},
    }
    return f"kpi:page:{page}:{_hash(payload)}"


def kpi_chart(
    chart: str,
    *,
    date_from: date,
    date_to: date,
    extra_filters: dict[str, Any] | None = None,
) -> str:
    """Tek bir chart endpoint'i (revenue_by_channel, daily_series, funnel, ...)."""
    payload = {
        "from": str(date_from),
        "to": str(date_to),
        "f": extra_filters or {},
    }
    return f"kpi:chart:{chart}:{_hash(payload)}"


def kpi_invalidation_pattern() -> str:
    """Tüm KPI cache'lerini düşürmek için pattern (import sonrası)."""
    return "kpi:*"


# --- Permission cache ---


def user_perms(user_id: int) -> str:
    return f"user_perms:{user_id}"


def role_perms(role_id: int) -> str:
    return f"role_perms:{role_id}"


# --- Filter dropdown'ları ---


def filter_channels() -> str:
    return "filters:channels"


def filter_devices() -> str:
    return "filters:devices"


def filter_cities() -> str:
    return "filters:cities"


def filter_categories() -> str:
    return "filters:categories"


def filter_brands() -> str:
    return "filters:brands"


def filter_payment_methods() -> str:
    return "filters:payment_methods"


def filter_order_statuses() -> str:
    return "filters:order_statuses"


# --- Statik ---


def channel_mapping_list() -> str:
    return "static:channel_mapping"
