import { toast } from "sonner";

import type { NotificationType } from "@/types/notifications";

interface NotifyOptions {
  type?: NotificationType;
  title: string;
  message?: string;
}

/**
 * Anlık geri bildirim için sonner toast wrapper'ı.
 *
 * NOT: Eskiden client-side bildirim store'una da yazıyordu. Şimdi bildirim
 * merkezi backend-driven (`notification_service.create_for_user`) —
 * "Şifre güncellendi" gibi transient onaylar **sadece** toast olarak
 * gösterilir, kalıcı bildirim merkezine girmez.
 *
 * Kullanım:
 *   notify({ type: 'success', title: 'Profil güncellendi' });
 *   notify({ type: 'error', title: 'İşlem başarısız', message: '...' });
 */
export function notify(options: NotifyOptions): void {
  const { type = "info", title, message } = options;
  const fn =
    type === "success"
      ? toast.success
      : type === "warning"
        ? toast.warning
        : type === "error"
          ? toast.error
          : toast.info;
  fn(title, { description: message });
}
