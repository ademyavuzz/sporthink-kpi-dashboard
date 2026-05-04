import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  CampaignAnalysisResponse,
  CampaignDetailResponse,
  CohortResponse,
  DashboardQuery,
  EcommerceResponse,
  FunnelResponse,
  GoogleAdsResponse,
  MetaAdsResponse,
  OverviewResponse,
  ProductsResponse,
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
  return params.toString();
}

export const dashboardApi = {
  async overview(p: DashboardQuery): Promise<OverviewResponse> {
    const r = await apiClient.get<ApiEnvelope<OverviewResponse>>(
      `/dashboard/overview?${qs(p)}`,
    );
    return unwrap(r);
  },
  async traffic(p: DashboardQuery): Promise<TrafficResponse> {
    const r = await apiClient.get<ApiEnvelope<TrafficResponse>>(
      `/dashboard/traffic?${qs(p)}`,
    );
    return unwrap(r);
  },
  async meta(p: DashboardQuery): Promise<MetaAdsResponse> {
    const r = await apiClient.get<ApiEnvelope<MetaAdsResponse>>(
      `/dashboard/meta?${qs(p)}`,
    );
    return unwrap(r);
  },
  async google(p: DashboardQuery): Promise<GoogleAdsResponse> {
    const r = await apiClient.get<ApiEnvelope<GoogleAdsResponse>>(
      `/dashboard/google?${qs(p)}`,
    );
    return unwrap(r);
  },
  async ecom(p: DashboardQuery): Promise<EcommerceResponse> {
    const r = await apiClient.get<ApiEnvelope<EcommerceResponse>>(
      `/dashboard/ecom?${qs(p)}`,
    );
    return unwrap(r);
  },
  async campaign(p: DashboardQuery): Promise<CampaignAnalysisResponse> {
    const r = await apiClient.get<ApiEnvelope<CampaignAnalysisResponse>>(
      `/dashboard/campaign?${qs(p)}`,
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
  async cohort(p: Pick<DashboardQuery, "date_from" | "date_to">): Promise<CohortResponse> {
    const params = new URLSearchParams({
      date_from: p.date_from,
      date_to: p.date_to,
    });
    const r = await apiClient.get<ApiEnvelope<CohortResponse>>(
      `/dashboard/cohort?${params.toString()}`,
    );
    return unwrap(r);
  },
  async products(p: DashboardQuery): Promise<ProductsResponse> {
    const r = await apiClient.get<ApiEnvelope<ProductsResponse>>(
      `/dashboard/products?${qs(p)}`,
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
