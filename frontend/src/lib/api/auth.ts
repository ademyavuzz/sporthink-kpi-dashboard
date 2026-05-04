import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  MeResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  TokenResponse,
  VerifyResetTokenResponse,
} from "@/types/auth";

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

  async forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const r = await apiClient.post<ApiEnvelope<ForgotPasswordResponse>>(
      "/auth/forgot-password",
      payload,
    );
    return unwrap(r);
  },

  async verifyResetToken(token: string): Promise<VerifyResetTokenResponse> {
    const r = await apiClient.get<ApiEnvelope<VerifyResetTokenResponse>>(
      "/auth/verify-reset-token",
      { params: { token } },
    );
    return unwrap(r);
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const r = await apiClient.post<ApiEnvelope<ResetPasswordResponse>>(
      "/auth/reset-password",
      payload,
    );
    return unwrap(r);
  },
};
