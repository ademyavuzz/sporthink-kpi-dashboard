import { useEffect, useState } from "react";

import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/useAuthStore";

import { PageLoader } from "./PageLoader";

/**
 * `user` localStorage'dan dönerken `permissions` (sadece bellek) sayfa
 * yenilendiğinde sıfırlanır. Bu wrapper ilk render'da `/auth/me` çağırarak
 * permissions'ı yeniden yükler — yoksa kullanıcı her permission-gated
 * route'ta 403 görür.
 *
 * Access token yoksa axios interceptor httpOnly refresh cookie ile sessiz
 * refresh yapar; refresh de başarısızsa interceptor `clearAuth` çağırır,
 * ProtectedRoute kullanıcıyı /login'e yönlendirir.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const [loading, setLoading] = useState(
    user !== null && permissions.length === 0,
  );

  useEffect(() => {
    if (user === null || permissions.length > 0) {
      return;
    }
    let alive = true;
    (async () => {
      try {
        const me = await authApi.me();
        if (alive) setPermissions(me.permissions);
      } catch {
        // 401 ise interceptor zaten clearAuth çağırır.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PageLoader />;
  return <>{children}</>;
}
