import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Notification, NotificationType } from "@/types/notifications";

interface NotificationsState {
  notifications: Notification[];
  /** Yeni bildirim ekler (en yeni başa). */
  add: (n: {
    type?: NotificationType;
    title: string;
    message?: string;
    link?: string;
    source?: "client" | "server";
  }) => string;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

const MAX_NOTIFICATIONS = 50;

function makeId(): string {
  // localStorage scoped — `crypto.randomUUID` modern browser'larda standart;
  // fallback timestamp + random.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Bildirimler client-side store'u.
 *
 * Frontend tarafında üretilen bildirimleri (login welcome, başarılı işlem,
 * uyarılar) persist eder. localStorage `sporthink-notifications` anahtarı
 * altında, kullanıcıya özel browser'da kalıcı.
 *
 * Backend kaynaklı bildirimler ileride bir API endpoint ile çekilip aynı
 * store'a `source: 'server'` ile push edilir.
 */
export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: [],

      add: ({ type = "info", title, message, link, source = "client" }) => {
        const id = makeId();
        set((state) => ({
          notifications: [
            {
              id,
              type,
              title,
              message,
              link,
              source,
              createdAt: Date.now(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, MAX_NOTIFICATIONS),
        }));
        return id;
      },

      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.read ? n : { ...n, read: true },
          ),
        })),

      remove: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clear: () => set({ notifications: [] }),
    }),
    {
      name: "sporthink-notifications",
      version: 1,
    },
  ),
);

export const selectUnreadCount = (s: NotificationsState): number =>
  s.notifications.reduce((acc, n) => (n.read ? acc : acc + 1), 0);
