/**
 * Bildirim tipleri — backend `app/schemas/notification.py` ile birebir.
 *
 * Eskiden client-side Zustand store'da yaşıyordu (cihaz bazlı). Şimdi
 * backend-driven user_id bazlı; frontend TanStack Query ile polling yapar.
 */

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message?: string | null;
  link?: string | null;
  is_read: boolean;
  read_at?: string | null;
  /** Backend ISO 8601 string. dayjs.utc(...).tz(...) ile gösterilir. */
  created_at: string;
}
