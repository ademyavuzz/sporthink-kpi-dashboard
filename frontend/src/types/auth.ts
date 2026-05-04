/**
 * Auth domain tipleri — backend `app/schemas/auth.py` + `app/schemas/user.py` ile birebir.
 */

import type { PermissionCode } from "@/lib/permissions";

export interface RoleSummary {
  id: number;
  name: string;
  color: string | null;
  is_system: boolean;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  role: RoleSummary | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface MeResponse {
  user: User;
  permissions: PermissionCode[];
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
  lang?: "tr" | "en";
}

export interface ForgotPasswordResponse {
  sent: boolean;
}

export type ResetTokenPurpose = "invite" | "reset";

export interface VerifyResetTokenResponse {
  valid: boolean;
  purpose: ResetTokenPurpose;
  user_email: string;
  first_name: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  email: string;
}
