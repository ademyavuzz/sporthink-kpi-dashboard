import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  CampaignAnalysisResponse,
  CampaignDetailResponse,
  ChannelAnalysisResponse,
  CohortQuery,
  CohortResponse,
  CustomersQuery,
  CustomersResponse,
  DashboardQuery,
  EcommerceQuery,
  EcommerceResponse,
  FunnelResponse,
  GoogleAdsResponse,
  GoogleQuery,
  MetaAdsResponse,
  MetaQuery,
  OrderDetailResponse,
  OverviewResponse,
  ProductsQuery,
  ProductsResponse,
  TrafficQuery,
  TrafficResponse,
} from "@/types/dashboard";

/**
 * Dashboard API — backend `/api/v1/dashboard/*`.
 *
 * Tüm endpoint'ler GET + query string. Response 5 dakikalık Redis cache'lidir.
 * TanStack Query staleTime'ı backend cache TTL'siyle aynı (5dk).
 */
function qs(p: DashboardQuery): string {
  const params = new URLSearchParams({
    date_from: p.date_from,
    date_to: p.date_to,
  });
  if (p.comparison_mode) params.set("comparison_mode", p.comparison_mode);
  p.channels?.forEach((c) => params.append("channels", c));
  p.devices?.forEach((d) => params.append("devices", d));
  return params.toString();
}

export const dashboardApi = {
  async overview(p: DashboardQuery): Promise<OverviewResponse> {
    const r = await apiClient.get<ApiEnvelope<OverviewResponse>>(
      `/dashboard/overview?${qs(p)}`,
    );
    return unwrap(r);
  },
  async traffic(p: TrafficQuery): Promise<TrafficResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    if (p.comparison_mode) params.set("comparison_mode", p.comparison_mode);
    p.channels?.forEach((c) => params.append("channels", c));
    p.devices?.forEach((d) => params.append("devices", d));
    p.cities?.forEach((c) => params.append("cities", c));
    const r = await apiClient.get<ApiEnvelope<TrafficResponse>>(
      `/dashboard/traffic?${params.toString()}`,
    );
    return unwrap(r);
  },
  async meta(p: MetaQuery): Promise<MetaAdsResponse> {
    const params = new URLSearchParams(qs(p));
    p.campaigns?.forEach((c) => params.append("campaigns", c));
    p.objectives?.forEach((o) => params.append("objectives", o));
    const r = await apiClient.get<ApiEnvelope<MetaAdsResponse>>(
      `/dashboard/meta?${params.toString()}`,
    );
    return unwrap(r);
  },
  async google(p: GoogleQuery): Promise<GoogleAdsResponse> {
    const params = new URLSearchParams(qs(p));
    p.campaigns?.forEach((c) => params.append("campaigns", c));
    p.channel_types?.forEach((ct) => params.append("channel_types", ct));
    const r = await apiClient.get<ApiEnvelope<GoogleAdsResponse>>(
      `/dashboard/google?${params.toString()}`,
    );
    return unwrap(r);
  },
  async ecom(p: EcommerceQuery): Promise<EcommerceResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    if (p.comparison_mode) params.set("comparison_mode", p.comparison_mode);
    p.categories?.forEach((c) => params.append("categories", c));
    p.brands?.forEach((b) => params.append("brands", b));
    p.statuses?.forEach((s) => params.append("statuses", s));
    p.payment_methods?.forEach((m) => params.append("payment_methods", m));
    p.cities?.forEach((c) => params.append("cities", c));
    p.devices?.forEach((d) => params.append("devices", d));
    if (p.orders_limit != null) params.set("orders_limit", String(p.orders_limit));
    const r = await apiClient.get<ApiEnvelope<EcommerceResponse>>(
      `/dashboard/ecom?${params.toString()}`,
    );
    return unwrap(r);
  },
  async ecomOrderDetail(orderPkId: number): Promise<OrderDetailResponse> {
    const r = await apiClient.get<ApiEnvelope<OrderDetailResponse>>(
      `/dashboard/ecom/order-detail?order_pk_id=${orderPkId}`,
    );
    return unwrap(r);
  },
  async campaign(
    p: Pick<DashboardQuery, "date_from" | "date_to" | "comparison_mode"> & {
      /** Tek platforma daraltir (meta veya google); bos ise her ikisi. */
      platform?: "meta" | "google";
    },
  ): Promise<CampaignAnalysisResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    if (p.comparison_mode) params.set("comparison_mode", p.comparison_mode);
    if (p.platform) params.set("platform", p.platform);
    const r = await apiClient.get<ApiEnvelope<CampaignAnalysisResponse>>(
      `/dashboard/campaign?${params.toString()}`,
    );
    return unwrap(r);
  },
  async funnel(p: Pick<DashboardQuery, "date_from" | "date_to">): Promise<FunnelResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    const r = await apiClient.get<ApiEnvelope<FunnelResponse>>(
      `/dashboard/funnel?${params.toString()}`,
    );
    return unwrap(r);
  },
  async cohort(p: CohortQuery): Promise<CohortResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    p.genders?.forEach((g) => params.append("genders", g));
    p.age_groups?.forEach((a) => params.append("age_groups", a));
    p.cities?.forEach((c) => params.append("cities", c));
    const r = await apiClient.get<ApiEnvelope<CohortResponse>>(
      `/dashboard/cohort?${params.toString()}`,
    );
    return unwrap(r);
  },
  async products(p: ProductsQuery): Promise<ProductsResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    if (p.comparison_mode) params.set("comparison_mode", p.comparison_mode);
    p.categories?.forEach((c) => params.append("categories", c));
    p.brands?.forEach((b) => params.append("brands", b));
    const r = await apiClient.get<ApiEnvelope<ProductsResponse>>(
      `/dashboard/products?${params.toString()}`,
    );
    return unwrap(r);
  },
  async channelAnalysis(p: {
    date_from: string;
    date_to: string;
    channels?: string[];
    devices?: string[];
    revenue_min?: number | null;
    revenue_max?: number | null;
    orders_min?: number | null;
    orders_max?: number | null;
    roas_min?: number | null;
    roas_max?: number | null;
    conversion_min?: number | null;
    conversion_max?: number | null;
  }): Promise<ChannelAnalysisResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    p.channels?.forEach((c) => params.append("channels", c));
    p.devices?.forEach((d) => params.append("devices", d));
    const ranges: Array<[string, number | null | undefined]> = [
      ["revenue_min", p.revenue_min],
      ["revenue_max", p.revenue_max],
      ["orders_min", p.orders_min],
      ["orders_max", p.orders_max],
      ["roas_min", p.roas_min],
      ["roas_max", p.roas_max],
      ["conversion_min", p.conversion_min],
      ["conversion_max", p.conversion_max],
    ];
    for (const [k, v] of ranges) {
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        params.set(k, String(v));
      }
    }
    const r = await apiClient.get<ApiEnvelope<ChannelAnalysisResponse>>(
      `/dashboard/channel-analysis?${params.toString()}`,
    );
    return unwrap(r);
  },
  async customers(p: CustomersQuery): Promise<CustomersResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    if (p.comparison_mode) params.set("comparison_mode", p.comparison_mode);
    p.genders?.forEach((g) => params.append("genders", g));
    p.age_groups?.forEach((a) => params.append("age_groups", a));
    p.cities?.forEach((c) => params.append("cities", c));
    const r = await apiClient.get<ApiEnvelope<CustomersResponse>>(
      `/dashboard/customers?${params.toString()}`,
    );
    return unwrap(r);
  },

  async campaignDetail(p: {
    date_from: string;
    date_to: string;
    campaign_name?: string;
    campaign_pk_id?: number;
    top_n?: number;
  }): Promise<CampaignDetailResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    if (p.campaign_name) params.set("campaign_name", p.campaign_name);
    if (p.campaign_pk_id) params.set("campaign_pk_id", String(p.campaign_pk_id));
    if (p.top_n) params.set("top_n", String(p.top_n));
    const r = await apiClient.get<ApiEnvelope<CampaignDetailResponse>>(
      `/dashboard/campaign-detail?${params.toString()}`,
    );
    return unwrap(r);
  },
};
