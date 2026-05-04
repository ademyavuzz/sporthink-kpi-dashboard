import { useCallback } from "react";

import type { PermissionCode } from "@/lib/permissions";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Mevcut kullanıcının izinlerini sorgulayan hook (frontend/CLAUDE.md §17 row 20).
 *
 * Süper admin için izin listesi backend'den dolu gelir (`auth_service.get_permission_codes`).
 *
 * `has(p)` izinleri `useAuthStore.permissions`'tan okur — bu liste login veya
 * /me sonrası set edilir, oturum boyunca bellekte kalır.
 */
export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);

  const has = useCallback(
    (permission: PermissionCode): boolean => permissions.includes(permission),
    [permissions],
  );

  const hasAny = useCallback(
    (perms: PermissionCode[]): boolean => perms.some((p) => permissions.includes(p)),
    [permissions],
  );

  return { permissions, has, hasAny };
}
