/**
 * Bildirim tipleri.
 *
 * `Notification` kaydı kullanıcıya özel localStorage'da yaşar (Zustand persist).
 * İleride backend tarafından da doldurulabilir; o aşamada `source: 'server'`
 * ayrımı eklenebilir.
 */

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  /** İsteğe bağlı tek satırlık ek metin. */
  message?: string;
  /** Unix ms — `Date.now()`. dayjs ile UI'da formatlanır. */
  createdAt: number;
  read: boolean;
  /** Tıklandığında yönlendirilecek route (opsiyonel). */
  link?: string;
  /** İleride backend kaynaklı bildirimleri ayırmak için. */
  source?: "client" | "server";
}
