/**
 * Notifications API client — backend `/api/v1/notifications/*` ile birebir.
 *
 * - listNotifications: sayfalı; UI bell + NotificationsPage tarafından
 * - getUnreadCount: TopBar rozeti için sayım-only (hafif)
 * - markRead / markAllRead / deleteNotification: kullanıcı eylemleri
 */

import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope, PaginatedApiEnvelope } from "@/types/api";
import type { Notification } from "@/types/notifications";

interface UnreadCountResponse {
  count: number;
}

interface MarkAllReadResponse {
  updated: number;
}

export const notificationsApi = {
  /**
   * Sayfalı bildirim listesi. Default page=1, page_size=50, max=200.
   * Pagination meta `{page, page_size, total}` döner.
   */
  async list(
    page = 1,
    pageSize = 50,
  ): Promise<{ items: Notification[]; total: number; page: number; pageSize: number }> {
    const r = await apiClient.get<PaginatedApiEnvelope<Notification>>(
      `/notifications?page=${page}&page_size=${pageSize}`,
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

  async unreadCount(): Promise<number> {
    const r = await apiClient.get<ApiEnvelope<UnreadCountResponse>>(
      "/notifications/unread-count",
    );
    return unwrap(r).count;
  },

  async markRead(id: number): Promise<Notification> {
    const r = await apiClient.patch<ApiEnvelope<Notification>>(
      `/notifications/${id}/read`,
    );
    return unwrap(r);
  },

  async markAllRead(): Promise<number> {
    const r = await apiClient.post<ApiEnvelope<MarkAllReadResponse>>(
      "/notifications/mark-all-read",
    );
    return unwrap(r).updated;
  },

  async deleteOne(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(
      `/notifications/${id}`,
    );
  },
};
