import { toast } from "sonner";

import { useNotificationsStore } from "@/stores/useNotificationsStore";
import type { NotificationType } from "@/types/notifications";

interface NotifyOptions {
  type?: NotificationType;
  title: string;
  message?: string;
  link?: string;
  /** True ise toast da gösterilir (anlık feedback). Default false. */
  toast?: boolean;
}

/**
 * Bildirim store'una kayıt eder ve isteğe bağlı sonner toast gösterir.
 *
 * Bell ikonunda + /notifications sayfasında görünür. Kullanım:
 *
 *   notify({ type: 'success', title: 'Şifre güncellendi', toast: true });
 *   notify({ type: 'info', title: 'Hoş geldiniz', message: 'Ayşe' });
 */
export function notify(options: NotifyOptions): string {
  const { type = "info", title, message, link, toast: showToast = false } = options;
  const id = useNotificationsStore.getState().add({ type, title, message, link });

  if (showToast) {
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
  return id;
}
