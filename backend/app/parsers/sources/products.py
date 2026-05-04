"""`products.csv` parser config.

CSV başlıkları:
    sku,product_name,category,sub_category,brand,gender,price,cost_price,
    stock_quantity,is_active,created_at,color,size_range

Notlar:
- `gender` CSV'de 'Erkek'/'Kadın'/'Unisex' geliyor olabilir → 'male'/'female'/'unisex'
  enum'una map (post_coerce).
- `created_at` CSV'den okunur ve DB'ye yazılır (DB default `CURRENT_TIMESTAMP`'i
  override eder). Eski sistemden gelen ürünlerin gerçek oluşturma tarihi korunsun.
"""
from __future__ import annotations

from typing import Any

from app.parsers.types import ColumnSpec, SourceConfig

_GENDER_MAP = {"erkek": "male", "kadın": "female", "kadin": "female", "unisex": "unisex"}


def _post_coerce(row: dict[str, Any]) -> dict[str, Any]:
    g = row.get("gender")
    if isinstance(g, str):
        row["gender"] = _GENDER_MAP.get(g.lower(), g.lower())
    return row


CONFIG = SourceConfig(
    name="products",
    target_table="products",
    columns=[
        ColumnSpec("sku", "sku", "str", required=True),
        ColumnSpec("product_name", "product_name", "str", required=True),
        ColumnSpec("category", "category", "str", required=True),
        ColumnSpec("sub_category", "sub_category", "str", required=False),
        ColumnSpec("brand", "brand", "str", required=True),
        ColumnSpec(
            "gender",
            "gender",
            "str",  # post_coerce'ta normalize ediliyor
            required=False,
        ),
        ColumnSpec("price", "price", "decimal", required=True),
        ColumnSpec("cost_price", "cost_price", "decimal", required=True),
        ColumnSpec("stock_quantity", "stock_quantity", "int", required=False, default=0),
        ColumnSpec("is_active", "is_active", "bool", required=False, default=True),
        ColumnSpec("color", "color", "str", required=False),
        ColumnSpec("size_range", "size_range", "str", required=False),
        ColumnSpec("created_at", "created_at", "datetime_iso", required=False),
    ],
    dedup_keys=["sku"],
    post_coerce=_post_coerce,
)
