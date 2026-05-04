import { Navigate, useLocation } from "react-router-dom";

import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionCode } from "@/lib/permissions";
import { useAuthStore } from "@/stores/useAuthStore";

interface ProtectedRouteProps {
  permission?: PermissionCode;
  children: React.ReactNode;
}

/**
 * Auth + (opsiyonel) permission guard (frontend/CLAUDE.md §9.2).
 *
 * - Kullanıcı yoksa → /login (return path query'de saklanır).
 * - Permission set edilmiş ve kullanıcı sahip değilse → /403.
 * - Frontend kontrolü sadece UX içindir; backend her endpoint'te tekrar kontrol eder.
 */
export function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const { has } = usePermissions();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (permission && !has(permission)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
