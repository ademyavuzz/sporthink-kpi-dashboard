"""`order_items.csv` parser config.

CSV başlıkları:
    order_id,line_id,item_id,item_name,item_category,item_category2,
    item_brand,quantity,unit_price,line_total,discount_amount,refund_amount

Notlar:
- `order_id` (string) → `order_pk_id` (BIGINT FK) — `orders` tablosundan lookup.
- `item_id` (sku-like string) → `product_pk_id` (BIGINT FK, **nullable**) —
  `products` tablosundan lookup; eşleşme yoksa NULL kalır (FK yok demektir,
  ürün katalogda olmayan sipariş satırı). `required=False`.
"""

from __future__ import annotations

from app.parsers.types import ColumnSpec, FKLookup, SourceConfig

CONFIG = SourceConfig(
    name="order_items",
    target_table="order_items",
    columns=[
        ColumnSpec("order_id", "order_id", "str", required=True),
        ColumnSpec("line_id", "line_id", "int", required=True),
        ColumnSpec("item_id", "item_id", "str", required=True),
        ColumnSpec("item_name", "item_name", "str", required=False),
        ColumnSpec("item_category", "item_category", "str", required=False),
        ColumnSpec("item_category2", "item_category2", "str", required=False),
        ColumnSpec("item_brand", "item_brand", "str", required=False),
        ColumnSpec("quantity", "quantity", "int", required=True),
        ColumnSpec("unit_price", "unit_price", "decimal", required=True),
        ColumnSpec("line_total", "line_total", "decimal", required=True),
        ColumnSpec("discount_amount", "discount_amount", "decimal", required=False, default=0),
        ColumnSpec("refund_amount", "refund_amount", "decimal", required=False, default=0),
    ],
    dedup_keys=["order_id", "line_id"],
    fk_lookups=[
        FKLookup(
            pk_column="order_pk_id",
            external_id_column="order_id",
            lookup_table="orders",
            lookup_column="order_id",
            required=True,
        ),
        FKLookup(
            pk_column="product_pk_id",
            external_id_column="item_id",
            lookup_table="products",
            lookup_column="sku",
            required=False,  # Katalogda olmayan ürünler için NULL OK
        ),
    ],
)
