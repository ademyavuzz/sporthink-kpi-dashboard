/**
 * Dashboard endpoint tipleri — backend `app/schemas/dashboard.py` ve
 * `app/schemas/kpi.py` ile birebir.
 */

export type KPIUnit =
  | "currency"
  | "percent"
  | "count"
  | "multiplier"
  | "duration_seconds";

export type TrendDirection = "up" | "down" | "flat";
export type ComparisonMode = "sequential" | "yoy";

export interface KPIResult {
  kpi_id: string;
  label_tr: string;
  /** API string olarak Decimal döner — UI'da Number()/parseFloat ile dönüşüm. */
  value: string | null;
  previous_value: string | null;
  change_percentage: string | null;
  direction: TrendDirection;
  is_positive: boolean;
  unit: KPIUnit;
  trend_direction_positive: "up" | "down";
}

export interface DateRange {
  date_from: string; // 'YYYY-MM-DD'
  date_to: string;
  comparison_from: string | null;
  comparison_to: string | null;
  comparison_mode: ComparisonMode;
}

export interface KPISummary {
  date_range: DateRange;
  revenue: KPIResult;
  orders: KPIResult;
  aov: KPIResult;
  sessions: KPIResult;
  users: KPIResult;
  conversion_rate: KPIResult;
  bounce_rate: KPIResult;
  ad_spend: KPIResult;
  roas: KPIResult;
}

export interface ChannelMetric {
  channel: string | null;
  revenue: string;
  orders: number;
  sessions: number;
  conversion_rate: string | null;
}

export interface CampaignMetric {
  campaign_id: number;
  campaign_name: string | null;
  platform: string | null;
  impressions: number;
  clicks: number;
  spend: string;
  conversions: string;
  conversions_value: string;
  ctr: string | null;
  cpc: string | null;
  roas: string | null;
}

export interface DailySeriesPoint {
  date: string;
  revenue: string;
  orders: number;
  sessions: number;
  spend: string;
}

export interface FunnelStep {
  step: "view" | "add_to_cart" | "checkout" | "purchase";
  label_tr: string;
  count: number;
  drop_from_previous_pct: string | null;
}

export interface CustomerTypeRevenue {
  customer_type: "new" | "returning";
  revenue: string;
  orders: number;
}

export interface TopProductRow {
  sku: string;
  product_name: string | null;
  brand: string | null;
  units_sold: number;
  revenue: string;
}

export interface TopCustomerRow {
  customer_id: string;
  customer_name: string | null;
  city: string | null;
  gender: string | null;
  age_group: string | null;
  revenue: string;
  order_count: number;
}

export interface DimensionBreakdown {
  label: string | null;
  value: string;
}

// --- Page response types ---

export interface OverviewResponse {
  summary: KPISummary;
  channels: ChannelMetric[];
  daily_series: DailySeriesPoint[];
  new_vs_returning: CustomerTypeRevenue[];
  funnel: FunnelStep[];
  top_products: TopProductRow[];
}

export interface TrafficResponse {
  date_range: DateRange;
  sessions: KPIResult;
  users: KPIResult;
  new_users: KPIResult;
  bounce_rate: KPIResult;
  pages_per_session: KPIResult;
  avg_session_duration: KPIResult;
  conversion_rate: KPIResult;
  daily_series: DailySeriesPoint[];
  by_channel: DimensionBreakdown[];
  by_device: DimensionBreakdown[];
  by_city: DimensionBreakdown[];
}

export interface MetaAdsResponse {
  date_range: DateRange;
  ad_spend: KPIResult;
  impressions: KPIResult;
  clicks: KPIResult;
  ctr: KPIResult;
  cpc: KPIResult;
  ad_conversions: KPIResult;
  roas: KPIResult;
  frequency: KPIResult;
  campaigns: CampaignMetric[];
  daily_series: DailySeriesPoint[];
}

export interface GoogleAdsResponse {
  date_range: DateRange;
  ad_spend: KPIResult;
  impressions: KPIResult;
  clicks: KPIResult;
  ctr: KPIResult;
  cpc: KPIResult;
  ad_conversions: KPIResult;
  cost_per_conversion: KPIResult;
  roas: KPIResult;
  campaigns: CampaignMetric[];
  daily_series: DailySeriesPoint[];
}

export interface EcommerceResponse {
  date_range: DateRange;
  revenue: KPIResult;
  orders: KPIResult;
  aov: KPIResult;
  items_sold: KPIResult;
  refund_rate: KPIResult;
  repeat_purchase_rate: KPIResult;
  revenue_per_user: KPIResult;
  daily_series: DailySeriesPoint[];
  by_channel: ChannelMetric[];
  new_vs_returning: CustomerTypeRevenue[];
  top_customers: TopCustomerRow[];
}

export interface CampaignAnalysisResponse {
  date_range: DateRange;
  total_spend: KPIResult;
  total_revenue: KPIResult;
  overall_roas: KPIResult;
  campaigns: CampaignMetric[];
}

export interface FunnelResponse {
  date_range: DateRange;
  steps: FunnelStep[];
}

export interface CohortCell {
  cohort_month: string;
  month_offset: number;
  customer_count: number;
  retention_pct: string | null;
}

export interface CohortResponse {
  date_range: DateRange;
  cells: CohortCell[];
}

export interface ProductsResponse {
  date_range: DateRange;
  items_sold: KPIResult;
  top_products: TopProductRow[];
  by_category: DimensionBreakdown[];
  by_brand: DimensionBreakdown[];
}

// --- Campaign drill-down ---

export interface CampaignAdMetrics {
  impressions: string;
  clicks: string;
  spend: string;
  conversions: string;
  conversions_value: string;
}

export interface CampaignEcomSummary {
  orders: number;
  revenue: string;
  items_sold: number;
  aov: string | null;
}

export interface CampaignTopProduct {
  sku: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  units_sold: number;
  revenue: string;
  orders: number;
}

export interface CampaignDailyPoint {
  date: string;
  revenue: string;
  orders: number;
  spend: string;
}

export interface CampaignDetailResponse {
  campaign_pk_id: number | null;
  campaign_name: string | null;
  platform: string | null;
  date_from: string;
  date_to: string;
  ad_metrics: CampaignAdMetrics;
  ecom_summary: CampaignEcomSummary;
  top_products: CampaignTopProduct[];
  daily_series: CampaignDailyPoint[];
}

// --- Query params ---

export interface DashboardQuery {
  date_from: string;
  date_to: string;
  comparison_mode?: ComparisonMode;
}
