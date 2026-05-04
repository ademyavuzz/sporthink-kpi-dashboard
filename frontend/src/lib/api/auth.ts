import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { LoginRequest, MeResponse, TokenResponse } from "@/types/auth";

/**
 * Auth API — backend `/api/v1/auth/*` ile birebir.
 *
 * Refresh token cookie ile taşınır; bu modüldeki çağrıların hiçbiri token'ı
 * body veya header'da göndermez. `apiClient` `withCredentials: true` ile
 * cookie'yi otomatik gönderir.
 */
export const authApi = {
  async login(payload: LoginRequest): Promise<TokenResponse> {
    const r = await apiClient.post<ApiEnvelope<TokenResponse>>("/auth/login", payload);
    return unwrap(r);
  },

  async refresh(): Promise<TokenResponse> {
    const r = await apiClient.post<ApiEnvelope<TokenResponse>>("/auth/refresh");
    return unwrap(r);
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiEnvelope<{ logged_out: boolean }>>("/auth/logout");
  },

  async me(): Promise<MeResponse> {
    const r = await apiClient.get<ApiEnvelope<MeResponse>>("/auth/me");
    return unwrap(r);
  },
};
