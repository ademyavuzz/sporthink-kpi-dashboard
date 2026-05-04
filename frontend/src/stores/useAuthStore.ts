import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { PermissionCode } from "@/lib/permissions";
import type { User } from "@/types/auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  permissions: PermissionCode[];

  /** Login veya refresh sonrası çağrılır. */
  setAuth: (args: { user: User; accessToken: string; permissions?: PermissionCode[] }) => void;
  /** Sadece access token tazelendiğinde (refresh interceptor). */
  setAccessToken: (token: string) => void;
  /** /me sonrası izinleri yükle. */
  setPermissions: (permissions: PermissionCode[]) => void;
  /** Logout. */
  clearAuth: () => void;
}

/**
 * Auth state.
 *
 * Persist disiplini (frontend/CLAUDE.md §17 row 1):
 * - `user`: localStorage'a yazılır (yenilemede UI hızlı render için).
 * - `accessToken`: SADECE bellek — XSS yüzeyini azaltır.
 * - `permissions`: SADECE bellek — `/auth/me` ile her oturumda yeniden çekilir.
 *
 * Sayfa yenilendiğinde access token kaybolur; axios interceptor httpOnly
 * refresh cookie ile sessiz refresh yapar (`lib/api/client.ts`).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      permissions: [],

      setAuth: ({ user, accessToken, permissions }) =>
        set({ user, accessToken, permissions: permissions ?? [] }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setPermissions: (permissions) => set({ permissions }),
      clearAuth: () => set({ user: null, accessToken: null, permissions: [] }),
    }),
    {
      name: "sporthink_auth",
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
