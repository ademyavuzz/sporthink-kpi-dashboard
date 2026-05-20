/**
 * Admin endpoint tipleri — backend `app/schemas/admin.py` ile birebir.
 */

export interface RoleSummaryAdmin {
  id: number;
  name: string;
  is_system: boolean;
  color?: string | null;
}

export interface UserListItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
  role: RoleSummaryAdmin | null;
  is_active: boolean;
  avatar_url?: string | null;
  last_login_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface UserCreate {
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  role_id?: number;
  is_active?: boolean;
}

export interface UserCreateResponse extends UserListItem {
  invitation_sent: boolean;
}

export interface AuditLogItem {
  id: number;
  action: string;
  user_id: number | null;
  user_email: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
}

// --- Saved Views ---

export interface SavedViewItem {
  id: number;
  page: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  is_default: boolean;
  user_id: number;
  created_at: string;
}

export interface SavedViewCreate {
  page: string;
  name: string;
  description?: string | null;
  filters: Record<string, unknown>;
  is_default?: boolean;
}

export interface SavedViewUpdate {
  name?: string | null;
  description?: string | null;
  filters?: Record<string, unknown> | null;
  is_default?: boolean | null;
}

// --- Roles + Permissions ---

export interface RoleItem {
  id: number;
  name: string;
  is_system: boolean;
}

export interface RoleListItem {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  user_count: number;
  permission_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  permissions: string[]; // permission codes
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoleCreate {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  permissions: string[];
}

export interface RoleUpdate {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  permissions?: string[];
}

export interface PermissionItem {
  code: string;
  module: string;
  action: string;
  description: string | null;
  category: string;
  category_label: string;
}

export type PermissionsGrouped = Record<string, PermissionItem[]>;

export interface AdminPasswordResetResponse {
  user_id: number;
  email: string;
  reset_email_sent: boolean;
}
