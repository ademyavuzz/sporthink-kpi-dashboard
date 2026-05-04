import { ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/useAuthStore";

export default function ForbiddenPage() {
  const { t } = useTranslation(["errors", "common"]);
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Close → logout + /login. "/" → /overview yönlendirmesi yetkisiz kullanıcıyı
  // tekrar 403'e düşürürdü; logout yaparak döngüyü kırıyoruz.
  const onClose = async () => {
    try {
      await authApi.logout();
    } catch {
      // Backend'e ulaşılamasa bile state'i temizle.
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <ShieldOff className="size-12 text-primary" aria-hidden />
        <div className="text-3xl font-bold tracking-tight">403</div>
        <div className="text-sm text-text-muted">{t("PERMISSION_DENIED")}</div>
        <Button variant="outline" onClick={onClose}>
          {t("common:close")}
        </Button>
      </div>
    </div>
  );
}
