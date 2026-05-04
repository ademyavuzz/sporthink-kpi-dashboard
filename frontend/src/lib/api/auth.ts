import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  AvatarResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  MeResponse,
  MeUpdateRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  TokenResponse,
  User,
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

  async updateMe(payload: MeUpdateRequest): Promise<User> {
    const r = await apiClient.patch<ApiEnvelope<User>>("/auth/me", payload);
    return unwrap(r);
  },

  async uploadAvatar(file: File): Promise<AvatarResponse> {
    const form = new FormData();
    form.append("file", file);
    const r = await apiClient.post<ApiEnvelope<AvatarResponse>>(
      "/auth/me/avatar",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return unwrap(r);
  },

  async removeAvatar(): Promise<AvatarResponse> {
    const r = await apiClient.delete<ApiEnvelope<AvatarResponse>>(
      "/auth/me/avatar",
    );
    return unwrap(r);
  },

  async changePassword(payload: ChangePasswordRequest): Promise<{ success: boolean }> {
    const r = await apiClient.post<ApiEnvelope<{ success: boolean }>>(
      "/auth/me/change-password",
      payload,
    );
    return unwrap(r);
  },
};
