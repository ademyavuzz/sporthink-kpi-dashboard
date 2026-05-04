"""`customers.csv` parser config.

CSV başlıkları:
    customer_id,customer_name,first_order_date,registration_date,city,gender,
    age_group,registration_source,is_newsletter_subscriber,total_orders,
    total_revenue,last_order_date

Notlar:
- `customer_name` opsiyonel — KVKK gereği zorunlu değil, ad/soyad ayrımı yok.
- `gender` CSV'de tek harf gelir: 'M'/'F' → 'male'/'female' map.
- `last_order_date` boş gelebilir (henüz sipariş vermemiş kayıtlar).
"""
from __future__ import annotations

from typing import Any

from app.parsers.types import ColumnSpec, SourceConfig

_GENDER_MAP = {"f": "female", "m": "male", "female": "female", "male": "male"}

# Dataset `55+` ile 55-64 ve 65+ ayrımını yapmıyor; granüler ayrım yapamayacağımız
# için 55-64 bucket'ına atıyoruz (kayıp: 65+ ayrımı). DB enum genişlemesi
# sonraki sprint'te değerlendirilebilir.
_AGE_GROUP_MAP = {"55+": "55-64"}


def _post_coerce(row: dict[str, Any]) -> dict[str, Any]:
    g = row.get("gender")
    if isinstance(g, str) and g:
        row["gender"] = _GENDER_MAP.get(g.lower())

    ag = row.get("age_group")
    if isinstance(ag, str) and ag in _AGE_GROUP_MAP:
        row["age_group"] = _AGE_GROUP_MAP[ag]
    return row


CONFIG = SourceConfig(
    name="customers",
    target_table="customers",
    columns=[
        ColumnSpec("customer_id", "customer_id", "str", required=True),
        ColumnSpec("customer_name", "customer_name", "str", required=False),
        ColumnSpec("first_order_date", "first_order_date", "date_iso", required=True),
        ColumnSpec("registration_date", "registration_date", "date_iso", required=True),
        ColumnSpec("city", "city", "str", required=False),
        ColumnSpec("gender", "gender", "str", required=False),
        ColumnSpec(
            "age_group",
            "age_group",
            "enum_str",
            required=False,
            # `55+` dataset-spesifik bir bucket — `_post_coerce` 55-64'e remap eder.
            allowed_values=frozenset(
                {"18-24", "25-34", "35-44", "45-54", "55-64", "65+", "55+"}
            ),
        ),
        ColumnSpec("registration_source", "registration_source", "str", required=False),
        ColumnSpec(
            "is_newsletter_subscriber",
            "is_newsletter_subscriber",
            "bool",
            required=False,
            default=False,
        ),
        ColumnSpec("total_orders", "total_orders", "int", required=False, default=0),
        ColumnSpec("total_revenue", "total_revenue", "decimal", required=False, default=0),
        ColumnSpec("last_order_date", "last_order_date", "date_iso", required=False),
    ],
    dedup_keys=["customer_id"],
    post_coerce=_post_coerce,
)
