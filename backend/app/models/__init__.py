"""ORM modelleri.

Yeni model eklerken hem dosyayı oluştur hem buradan re-export et — Alembic
autogenerate ve diğer modüller `app.models` üzerinden tek noktada keşfeder.
"""

from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.campaign import Campaign, CampaignPlatform, CampaignStatus
from app.models.channel_mapping import ChannelMapping
from app.models.customer import Customer, CustomerAgeGroup, CustomerGender
from app.models.ga4_item_engagement import GA4ItemEngagement
from app.models.ga4_traffic import GA4DeviceCategory, GA4NewVsReturning, GA4Traffic
from app.models.google_ads import (
    GoogleAdGroupStatus,
    GoogleAds,
    GoogleAdvertisingChannelType,
    GoogleCampaignStatus,
    GoogleDevice,
    GoogleKeywordMatchType,
)
from app.models.import_error import ImportError_ as ImportRowError
from app.models.import_run import (
    DuplicateStrategy,
    ErrorStrategy,
    Import,
    ImportDataType,
    ImportFileFormat,
    ImportStatus,
)
from app.models.kpi_aggregate import (
    KPICampaignAggregate,
    KPIDailyAggregate,
    KPIMonthlyAggregate,
    KPIPlatform,
)
from app.models.meta_ads import MetaAds
from app.models.meta_ads_breakdowns import (
    MetaAdsBreakdowns,
    MetaBreakdownAge,
    MetaBreakdownGender,
)
from app.models.notification import Notification, NotificationType
from app.models.order import (
    Order,
    OrderDevice,
    OrderPaymentMethod,
    OrderStatus,
)
from app.models.order_item import OrderItem
from app.models.password_reset_token import PasswordResetToken, TokenPurpose
from app.models.permission import Permission
from app.models.product import Product, ProductGender
from app.models.refresh_token import RefreshToken
from app.models.report import Report, ReportSection, ReportStatus
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.saved_view import SavedView
from app.models.user import User
from app.models.user_preference import UserPreference

__all__ = [
    "Base",
    "AuditLog",
    "Campaign",
    "CampaignPlatform",
    "CampaignStatus",
    "ChannelMapping",
    "Customer",
    "CustomerAgeGroup",
    "CustomerGender",
    "GA4DeviceCategory",
    "GA4ItemEngagement",
    "GA4NewVsReturning",
    "GA4Traffic",
    "GoogleAdGroupStatus",
    "GoogleAds",
    "GoogleAdvertisingChannelType",
    "GoogleCampaignStatus",
    "GoogleDevice",
    "GoogleKeywordMatchType",
    "DuplicateStrategy",
    "ErrorStrategy",
    "Import",
    "ImportDataType",
    "ImportFileFormat",
    "ImportRowError",
    "ImportStatus",
    "KPICampaignAggregate",
    "KPIDailyAggregate",
    "KPIMonthlyAggregate",
    "KPIPlatform",
    "MetaAds",
    "MetaAdsBreakdowns",
    "MetaBreakdownAge",
    "MetaBreakdownGender",
    "Notification",
    "NotificationType",
    "Order",
    "OrderDevice",
    "OrderItem",
    "OrderPaymentMethod",
    "OrderStatus",
    "PasswordResetToken",
    "TokenPurpose",
    "Permission",
    "Product",
    "ProductGender",
    "RefreshToken",
    "Report",
    "ReportSection",
    "ReportStatus",
    "Role",
    "RolePermission",
    "SavedView",
    "User",
    "UserPreference",
]
