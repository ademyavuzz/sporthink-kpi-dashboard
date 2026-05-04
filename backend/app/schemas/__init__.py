"""Pydantic API şemaları.

`models/` ORM (DB şekli), `schemas/` API contract — bu ikisi karıştırılmaz
(backend/CLAUDE.md §4).
"""

from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.common import SuccessEnvelope
from app.schemas.campaign_detail import (
    CampaignAdMetrics,
    CampaignDailyPoint,
    CampaignDetailResponse,
    CampaignEcomSummary,
    CampaignTopProduct,
)
from app.schemas.dashboard import (
    CampaignAnalysisResponse,
    CohortCell,
    CohortResponse,
    DimensionBreakdown,
    EcommerceResponse,
    FunnelResponse,
    GoogleAdsResponse,
    MetaAdsResponse,
    OverviewResponse,
    ProductsResponse,
    TrafficResponse,
)
from app.schemas.imports import (
    DataTypeColumn,
    DataTypeMeta,
    ImportDetailResponse,
    ImportListItem,
    ImportPreviewResponse,
    ImportPreviewSummary,
    ImportRunResult,
    ImportSampleError,
)
from app.schemas.kpi import (
    CampaignMetric,
    ChannelMetric,
    CustomerTypeRevenue,
    DailySeriesPoint,
    DateRange,
    FunnelStep,
    KPIResult,
    KPISummary,
    TopCustomerRow,
    TopProductRow,
)
from app.schemas.user import MeResponse, RoleSummary, UserResponse

__all__ = [
    "CampaignAdMetrics",
    "CampaignAnalysisResponse",
    "CampaignDailyPoint",
    "CampaignDetailResponse",
    "CampaignEcomSummary",
    "CampaignMetric",
    "CampaignTopProduct",
    "ChannelMetric",
    "CohortCell",
    "CohortResponse",
    "CustomerTypeRevenue",
    "DailySeriesPoint",
    "DataTypeColumn",
    "DataTypeMeta",
    "DateRange",
    "DimensionBreakdown",
    "EcommerceResponse",
    "FunnelResponse",
    "FunnelStep",
    "GoogleAdsResponse",
    "ImportDetailResponse",
    "ImportListItem",
    "ImportPreviewResponse",
    "ImportPreviewSummary",
    "ImportRunResult",
    "ImportSampleError",
    "KPIResult",
    "KPISummary",
    "LoginRequest",
    "MeResponse",
    "MetaAdsResponse",
    "OverviewResponse",
    "ProductsResponse",
    "RoleSummary",
    "SuccessEnvelope",
    "TokenResponse",
    "TopCustomerRow",
    "TopProductRow",
    "TrafficResponse",
    "UserResponse",
]
