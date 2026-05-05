"""`orders.csv` parser config.

CSV başlıkları:
    order_id,order_date,customer_id,city,device,channel,source,medium,
    campaign_name,coupon_code,product_count,order_revenue,shipping_cost,
    discount_amount,refund_amount,net_revenue,order_status,payment_method

Notlar:
- `net_revenue` DB'de STORED GENERATED — CSV'den okunsa da INSERT'e dahil edilemez.
- `customer_id` (string) → `customer_pk_id` (BIGINT FK) lookup gerekiyor;
  servis layer'ı `customers` tablosundan id'yi çeker.
"""

from __future__ import annotations

from app.parsers.types import ColumnSpec, FKLookup, SourceConfig

CONFIG = SourceConfig(
    name="orders",
    target_table="orders",
    columns=[
        ColumnSpec("order_id", "order_id", "str", required=True),
        ColumnSpec("order_date", "order_date", "datetime_iso", required=True),
        ColumnSpec("customer_id", "customer_id", "str", required=True),
        ColumnSpec("city", "city", "str", required=True),
        ColumnSpec(
            "device",
            "device",
            "enum_str",
            required=True,
            allowed_values=frozenset({"mobile", "desktop", "tablet"}),
        ),
        ColumnSpec("channel", "channel", "str", required=True),
        ColumnSpec("source", "source", "str", required=False),
        ColumnSpec("medium", "medium", "str", required=False),
        ColumnSpec("campaign_name", "campaign_name", "str", required=False),
        ColumnSpec("coupon_code", "coupon_code", "str", required=False),
        ColumnSpec("product_count", "product_count", "int", required=False, default=0),
        ColumnSpec("order_revenue", "order_revenue", "decimal", required=True),
        ColumnSpec("shipping_cost", "shipping_cost", "decimal", required=False, default=0),
        ColumnSpec("discount_amount", "discount_amount", "decimal", required=False, default=0),
        ColumnSpec("refund_amount", "refund_amount", "decimal", required=False, default=0),
        ColumnSpec(
            "order_status",
            "order_status",
            "enum_str",
            required=True,
            allowed_values=frozenset({"completed", "cancelled", "refunded", "pending", "shipped"}),
        ),
        ColumnSpec(
            "payment_method",
            "payment_method",
            "enum_str",
            required=True,
            allowed_values=frozenset({"credit_card", "debit_card", "bank_transfer", "pay_at_door"}),
        ),
    ],
    dedup_keys=["order_id"],
    fk_lookups=[
        FKLookup(
            pk_column="customer_pk_id",
            external_id_column="customer_id",
            lookup_table="customers",
            lookup_column="customer_id",
            required=True,
        ),
    ],
    # CSV'de var ama DB'de STORED GENERATED — okunmasın.
    drop_columns=frozenset({"net_revenue"}),
)
