"""`ga4_item_interactions.csv` parser config (target: `ga4_item_engagement`).

CSV başlıkları:
    date, itemId, itemName, itemCategory, itemCategory2, itemBrand,
    itemsViewed, itemsAddedToCart, itemsCheckedOut, itemsPurchased,
    itemRevenue, itemListViews, itemListClicks, cartToViewRate

Notlar:
- `cartToViewRate` DB'de STORED GENERATED — drop edilir.
- `itemId` SKU → `product_pk_id` FK lookup (opsiyonel; bulunamazsa NULL).
- Natural unique key yok; dedup boş, rollback için import sil.
"""

from __future__ import annotations

from app.parsers.types import ColumnSpec, FKLookup, SourceConfig

CONFIG = SourceConfig(
    name="ga4_items",
    target_table="ga4_item_engagement",
    columns=[
        ColumnSpec("date", "date", "date_yyyymmdd", required=True),
        ColumnSpec("item_id", "itemId", "str", required=True),
        ColumnSpec("item_name", "itemName", "str", required=False),
        ColumnSpec("item_category", "itemCategory", "str", required=False),
        ColumnSpec("item_category2", "itemCategory2", "str", required=False),
        ColumnSpec("item_brand", "itemBrand", "str", required=False),
        ColumnSpec("items_viewed", "itemsViewed", "int", required=False, default=0),
        ColumnSpec("items_added_to_cart", "itemsAddedToCart", "int", required=False, default=0),
        ColumnSpec("items_checked_out", "itemsCheckedOut", "int", required=False, default=0),
        ColumnSpec("items_purchased", "itemsPurchased", "int", required=False, default=0),
        ColumnSpec("item_revenue", "itemRevenue", "decimal", required=False, default=0),
        ColumnSpec("item_list_views", "itemListViews", "int", required=False, default=0),
        ColumnSpec("item_list_clicks", "itemListClicks", "int", required=False, default=0),
    ],
    dedup_keys=[],
    fk_lookups=[
        FKLookup(
            pk_column="product_pk_id",
            external_id_column="item_id",
            lookup_table="products",
            lookup_column="sku",
            required=False,
        ),
    ],
    drop_columns=frozenset({"cartToViewRate"}),
)
