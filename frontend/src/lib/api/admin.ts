import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope, PaginatedApiEnvelope } from "@/types/api";
import type {
  AdminPasswordResetResponse,
  AuditLogItem,
  ChannelMappingCreate,
  ChannelMappingItem,
  ChannelMappingUpdate,
  PermissionsGrouped,
  RFMResponse,
  RoleCreate,
  RoleDetail,
  RoleListItem,
  RoleUpdate,
  SavedViewCreate,
  SavedViewItem,
  SavedViewUpdate,
  SegmentCreate,
  SegmentItem,
  SegmentPreviewResponse,
  SegmentUpdate,
  UserCreate,
  UserCreateResponse,
  UserListItem,
  UserUpdate,
} from "@/types/admin";

/**
 * Admin API — `/api/v1/{filters,admin,users,segments,saved-views,export}`.
 */
export const adminApi = {
  // Filters
  async filterChannels(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/channels");
    return unwrap(r);
  },
  async filterDevices(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/devices");
    return unwrap(r);
  },
  async filterCities(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/cities");
    return unwrap(r);
  },
  async filterCategories(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/categories");
    return unwrap(r);
  },
  async filterBrands(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/brands");
    return unwrap(r);
  },
  async filterPaymentMethods(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/payment-methods");
    return unwrap(r);
  },
  async filterOrderStatuses(): Promise<string[]> {
    const r = await apiClient.get<ApiEnvelope<string[]>>("/filters/order-statuses");
    return unwrap(r);
  },

  // Users
  async listUsers(includeDeleted = false): Promise<UserListItem[]> {
    // Backend artık sayfalı (max page_size=200). UI'da henüz pagination
    // kontrolü yok — geçici olarak tek sayfada 200 satır çekiyoruz; gerçek
    // pagination UI'ı eklendiğinde page parametresi de geçilecek.
    const r = await apiClient.get<ApiEnvelope<UserListItem[]>>(
      `/users?page=1&page_size=200&include_deleted=${includeDeleted}`,
    );
    return unwrap(r);
  },
  async createUser(payload: UserCreate): Promise<UserCreateResponse> {
    const r = await apiClient.post<ApiEnvelope<UserCreateResponse>>("/users", payload);
    return unwrap(r);
  },
  async updateUser(id: number, payload: UserUpdate): Promise<UserListItem> {
    const r = await apiClient.patch<ApiEnvelope<UserListItem>>(`/users/${id}`, payload);
    return unwrap(r);
  },
  async deleteUser(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`/users/${id}`);
  },
  async resetUserPassword(id: number): Promise<AdminPasswordResetResponse> {
    const r = await apiClient.post<ApiEnvelope<AdminPasswordResetResponse>>(
      `/users/${id}/reset-password`,
    );
    return unwrap(r);
  },
  // Pattern C: son Super Admin guard'ı için aktif Super Admin sayısı.
  async getSuperAdminCount(): Promise<number> {
    const r = await apiClient.get<ApiEnvelope<{ count: number }>>(
      "/users/super-admins/count",
    );
    return unwrap(r).count;
  },

  // Roles
  async listRoles(): Promise<RoleListItem[]> {
    // Backend artık sayfalı (max page_size=200). UI'da pagination yok.
    const r = await apiClient.get<ApiEnvelope<RoleListItem[]>>(
      "/roles?page=1&page_size=200",
    );
    return unwrap(r);
  },
  async getRole(id: number): Promise<RoleDetail> {
    const r = await apiClient.get<ApiEnvelope<RoleDetail>>(`/roles/${id}`);
    return unwrap(r);
  },
  async createRole(payload: RoleCreate): Promise<RoleDetail> {
    const r = await apiClient.post<ApiEnvelope<RoleDetail>>("/roles", payload);
    return unwrap(r);
  },
  async updateRole(id: number, payload: RoleUpdate): Promise<RoleDetail> {
    const r = await apiClient.patch<ApiEnvelope<RoleDetail>>(`/roles/${id}`, payload);
    return unwrap(r);
  },
  async deleteRole(id: number): Promise<{ deleted: boolean; deactivated_users: number }> {
    const r = await apiClient.delete<
      ApiEnvelope<{ deleted: boolean; deactivated_users: number; role_id: number }>
    >(`/roles/${id}`);
    return unwrap(r);
  },

  // Permissions
  async listPermissions(): Promise<PermissionsGrouped> {
    const r = await apiClient.get<ApiEnvelope<PermissionsGrouped>>("/permissions");
    return unwrap(r);
  },

  // Audit logs
  async listAuditLogs(limit = 100, action?: string): Promise<AuditLogItem[]> {
    // Backend artık sayfalı (max page_size=200). Bu helper backward-compat
    // amaçlıdır — yeni kullanım için listAuditLogsPaginated tercih edin.
    const pageSize = Math.min(Math.max(limit, 1), 200);
    const params = new URLSearchParams({
      page: "1",
      page_size: String(pageSize),
    });
    if (action) params.set("action", action);
    const r = await apiClient.get<ApiEnvelope<AuditLogItem[]>>(
      `/admin/audit-logs?${params}`,
    );
    return unwrap(r);
  },
  /**
   * Pagination meta'sı ile birlikte audit log listesi.
   * UI'da Pagination component'iyle birlikte kullanılır.
   */
  async listAuditLogsPaginated(
    page: number,
    pageSize: number,
    action?: string,
  ): Promise<{ items: AuditLogItem[]; total: number; page: number; pageSize: number }> {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (action) params.set("action", action);
    const r = await apiClient.get<PaginatedApiEnvelope<AuditLogItem>>(
      `/admin/audit-logs?${params}`,
    );
    if (!r.data.success) {
      throw new Error(r.data.error.message);
    }
    return {
      items: r.data.data,
      total: r.data.pagination.total,
      page: r.data.pagination.page,
      pageSize: r.data.pagination.page_size,
    };
  },

  // Channel mappings
  async listChannelMappings(): Promise<ChannelMappingItem[]> {
    const r = await apiClient.get<ApiEnvelope<ChannelMappingItem[]>>(
      "/admin/channel-mappings?page=1&page_size=200",
    );
    return unwrap(r);
  },
  async createChannelMapping(p: ChannelMappingCreate): Promise<ChannelMappingItem> {
    const r = await apiClient.post<ApiEnvelope<ChannelMappingItem>>(
      "/admin/channel-mappings",
      p,
    );
    return unwrap(r);
  },
  async updateChannelMapping(id: number, p: ChannelMappingUpdate): Promise<ChannelMappingItem> {
    const r = await apiClient.patch<ApiEnvelope<ChannelMappingItem>>(
      `/admin/channel-mappings/${id}`,
      p,
    );
    return unwrap(r);
  },
  async deleteChannelMapping(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(
      `/admin/channel-mappings/${id}`,
    );
  },

  // Aggregations rebuild
  async rebuildAggregations(date_from: string, date_to: string): Promise<unknown> {
    const r = await apiClient.post<ApiEnvelope<unknown>>(
      "/admin/aggregations/rebuild",
      { date_from, date_to },
    );
    return unwrap(r);
  },

  // Segments
  async listSegments(): Promise<SegmentItem[]> {
    const r = await apiClient.get<ApiEnvelope<SegmentItem[]>>(
      "/segments?page=1&page_size=200",
    );
    return unwrap(r);
  },
  async previewSegment(p: SegmentCreate): Promise<SegmentPreviewResponse> {
    const r = await apiClient.post<ApiEnvelope<SegmentPreviewResponse>>(
      "/segments/preview",
      p,
    );
    return unwrap(r);
  },
  async createSegment(p: SegmentCreate): Promise<SegmentItem> {
    const r = await apiClient.post<ApiEnvelope<SegmentItem>>("/segments", p);
    return unwrap(r);
  },
  async updateSegment(id: number, p: SegmentUpdate): Promise<SegmentItem> {
    const r = await apiClient.patch<ApiEnvelope<SegmentItem>>(`/segments/${id}`, p);
    return unwrap(r);
  },
  async deleteSegment(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`/segments/${id}`);
  },
  async getRFM(referenceDate?: string): Promise<RFMResponse> {
    const url = referenceDate
      ? `/segments/rfm?reference_date=${referenceDate}`
      : "/segments/rfm";
    const r = await apiClient.get<ApiEnvelope<RFMResponse>>(url);
    return unwrap(r);
  },

  // Saved views
  async listSavedViews(pageName?: string): Promise<SavedViewItem[]> {
    // Backend `page` query parametresi pagination için ayrıldı; sayfa adı
    // filtresi artık `page_name` (alias).
    const params = new URLSearchParams({ page: "1", page_size: "200" });
    if (pageName) params.set("page_name", pageName);
    const r = await apiClient.get<ApiEnvelope<SavedViewItem[]>>(
      `/saved-views?${params}`,
    );
    return unwrap(r);
  },
  async createSavedView(p: SavedViewCreate): Promise<SavedViewItem> {
    const r = await apiClient.post<ApiEnvelope<SavedViewItem>>("/saved-views", p);
    return unwrap(r);
  },
  async updateSavedView(id: number, p: SavedViewUpdate): Promise<SavedViewItem> {
    const r = await apiClient.patch<ApiEnvelope<SavedViewItem>>(`/saved-views/${id}`, p);
    return unwrap(r);
  },
  async deleteSavedView(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`/saved-views/${id}`);
  },

  // Export
  async download(
    kind: "products" | "customers" | "orders" | "campaigns" | "audit_logs" | "channel_mappings",
    fmt: "csv" | "json" | "xlsx" = "csv",
  ): Promise<Blob> {
    const r = await apiClient.get(`/export/${kind}?fmt=${fmt}`, {
      responseType: "blob",
    });
    return r.data as Blob;
  },
};
