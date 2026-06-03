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
  objective: string | null;
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

export interface FunnelGroup {
  key: string;
  label_tr: string;
  steps: FunnelStep[];
}

export interface FunnelDropoffPoint {
  date: string;
  view_to_cart_pct: string | null;
  cart_to_checkout_pct: string | null;
  checkout_to_purchase_pct: string | null;
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

export interface GeoCityMetric {
  city: string;
  revenue: string;
  orders: number;
}

export interface OverviewResponse {
  summary: KPISummary;
  channels: ChannelMetric[];
  daily_series: DailySeriesPoint[];
  new_vs_returning: CustomerTypeRevenue[];
  funnel: FunnelStep[];
  top_products: TopProductRow[];
  geo: GeoCityMetric[];
}

export interface TrafficDailyPoint {
  date: string;
  sessions: number;
  users: number;
  new_users: number;
}

export interface LandingPageRow {
  page_path: string;
  sessions: number;
  users: number;
  /** 0-100 yüzde, null = veri yok. */
  bounce_rate: string | null;
  /** Saniye. */
  avg_session_duration: string | null;
  /** 0-100 yüzde, null = veri yok. */
  conversion_rate: string | null;
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
  daily_series: TrafficDailyPoint[];
  by_channel: DimensionBreakdown[];
  by_device: DimensionBreakdown[];
  by_city: DimensionBreakdown[];
  landing_pages: LandingPageRow[];
}

export interface TrafficQuery {
  date_from: string;
  date_to: string;
  comparison_mode?: ComparisonMode;
  channels?: string[];
  devices?: string[];
  cities?: string[];
}

export interface MetaAdsResponse {
  date_range: DateRange;
  ad_spend: KPIResult;
  impressions: KPIResult;
  clicks: KPIResult;
  ctr: KPIResult;
  cpc: KPIResult;
  cpm: KPIResult;
  ad_conversions: KPIResult;
  cost_per_conversion: KPIResult;
  roas: KPIResult;
  frequency: KPIResult;
  campaigns: CampaignMetric[];
  daily_series: DailySeriesPoint[];
}

export type GoogleChannelType =
  | "search"
  | "shopping"
  | "performance_max"
  | "display"
  | "video";

export interface GoogleCampaignMetric extends CampaignMetric {
  channel_type: GoogleChannelType | string | null;
}

export interface GoogleChannelTypeBreakdown {
  channel_type: GoogleChannelType | string | null;
  spend: string;
  impressions: number;
  clicks: number;
  conversions: string;
  conversions_value: string;
}

export interface GoogleKeywordRow {
  keyword: string;
  match_type: "exact" | "phrase" | "broad" | string | null;
  clicks: number;
  impressions: number;
  ctr: string | null;
  cpc: string | null;
  conversions: string;
  roas: string | null;
}

export interface GoogleProductRow {
  product_id: string;
  product_name: string | null;
  impressions: number;
  clicks: number;
  conversions: string;
  spend: string;
  conversions_value: string;
  roas: string | null;
}

export interface GoogleAdsResponse {
  date_range: DateRange;
  ad_spend: KPIResult;
  impressions: KPIResult;
  clicks: KPIResult;
  ctr: KPIResult;
  cpc: KPIResult;
  cpm: KPIResult;
  ad_conversions: KPIResult;
  cost_per_conversion: KPIResult;
  roas: KPIResult;
  campaigns: GoogleCampaignMetric[];
  top_campaigns_by_roas: GoogleCampaignMetric[];
  channel_breakdown: GoogleChannelTypeBreakdown[];
  keywords: GoogleKeywordRow[];
  products: GoogleProductRow[];
  daily_series: DailySeriesPoint[];
}

export interface OrderListRow {
  order_pk_id: number;
  order_id: string;
  order_date: string; // ISO date
  customer_id: string;
  customer_name: string | null;
  net_revenue: string;
  order_status: string;
  payment_method: string;
}

export interface OrderLineItem {
  sku: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface OrderDetailCustomer {
  customer_id: string;
  customer_name: string | null;
  city: string | null;
  gender: string | null;
  age_group: string | null;
  is_newsletter_subscriber: boolean;
  total_orders: number;
  total_revenue: string;
}

export interface OrderDetailResponse {
  order_pk_id: number;
  order_id: string;
  order_date: string;
  city: string;
  device: string;
  channel: string;
  source: string | null;
  medium: string | null;
  campaign_name: string | null;
  coupon_code: string | null;
  order_status: string;
  payment_method: string;
  order_revenue: string;
  shipping_cost: string;
  discount_amount: string;
  refund_amount: string;
  net_revenue: string;
  line_items: OrderLineItem[];
  customer: OrderDetailCustomer;
}

export interface EcommerceQuery {
  date_from: string;
  date_to: string;
  comparison_mode?: ComparisonMode;
  categories?: string[];
  brands?: string[];
  statuses?: string[];
  payment_methods?: string[];
  cities?: string[];
  devices?: string[];
  orders_limit?: number;
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
  by_category: DimensionBreakdown[];
  by_device: DimensionBreakdown[];
  by_city: DimensionBreakdown[];
  by_payment_method: DimensionBreakdown[];
  new_vs_returning: CustomerTypeRevenue[];
  top_products: TopProductRow[];
  top_customers: TopCustomerRow[];
  orders_list: OrderListRow[];
  orders_total: number;
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
  total_sessions: number;
  by_device: FunnelGroup[];
  by_channel: FunnelGroup[];
  dropoff_series: FunnelDropoffPoint[];
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

// --- Channel Analysis ---

export interface ChannelPerformanceRow {
  channel: string;
  revenue: string;
  orders: number;
  sessions: number;
  conversion_rate: string | null;
  ad_spend: string;
  ad_revenue: string;
  roas: string | null;
  customers: number;
  aov: string | null;
}

export interface ChannelDailyPoint {
  date: string;
  channel: string;
  revenue: string;
}

export interface ChannelAnalysisResponse {
  date_range: DateRange;
  active_channels: KPIResult;
  top_channel_revenue: KPIResult;
  avg_roas: KPIResult;
  avg_conversion_rate: KPIResult;
  channels: ChannelPerformanceRow[];
  revenue_distribution: DimensionBreakdown[];
  roas_by_channel: DimensionBreakdown[];
  conversion_by_channel: DimensionBreakdown[];
  daily_revenue_trend: ChannelDailyPoint[];
}

// --- Customers ---

export interface CustomerOverviewRow {
  customer_id: string;
  customer_name: string | null;
  city: string | null;
  gender: string | null;
  age_group: string | null;
  total_orders: number;
  total_revenue: string;
  last_order_date: string | null;
}

export interface CustomerFreqBucket {
  bucket: string; // "1" | "2" | "3" | "4" | "5-9" | "10+"
  customer_count: number;
}

export interface NewsletterCompare {
  is_subscriber: boolean;
  customer_count: number;
  avg_orders: string;
  avg_revenue: string;
}

export interface CustomerDailyPoint {
  date: string;
  new_customers: number;
}

export interface CustomersResponse {
  date_range: DateRange;
  total_customers: KPIResult;
  new_customers: KPIResult;
  repeat_rate: KPIResult;
  avg_customer_value: KPIResult;
  avg_orders_per_customer: KPIResult;
  newsletter_subscription_rate: KPIResult;
  by_gender: DimensionBreakdown[];
  by_age_group: DimensionBreakdown[];
  by_city: DimensionBreakdown[];
  order_frequency: CustomerFreqBucket[];
  newsletter_comparison: NewsletterCompare[];
  daily_new_customers: CustomerDailyPoint[];
  top_customers: CustomerOverviewRow[];
}

// --- Query params ---

export interface DashboardQuery {
  date_from: string;
  date_to: string;
  comparison_mode?: ComparisonMode;
  /** Cross-filter — kanal/cihaz çoklu seçim. */
  channels?: string[];
  devices?: string[];
}

/** Ürünler endpoint'i — kategori/marka boyut filtreleri (backend: products). */
export interface ProductsQuery {
  date_from: string;
  date_to: string;
  comparison_mode?: ComparisonMode;
  categories?: string[];
  brands?: string[];
}

/** Müşteriler endpoint'i — demografi boyut filtreleri (backend: customers). */
export interface CustomersQuery {
  date_from: string;
  date_to: string;
  comparison_mode?: ComparisonMode;
  genders?: string[];
  age_groups?: string[];
  cities?: string[];
}

/** Kohort endpoint'i — demografi boyut filtreleri (backend: cohort). */
export interface CohortQuery {
  date_from: string;
  date_to: string;
  genders?: string[];
  age_groups?: string[];
  cities?: string[];
}
