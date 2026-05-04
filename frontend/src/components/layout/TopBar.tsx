import { LogOut, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLanguageStore, type Lang } from "@/stores/useLanguageStore";
import { useThemeStore } from "@/stores/useThemeStore";

/**
 * Üst bar — mock'taki TopBar'ın MVP'i: tema toggle, dil toggle, kullanıcı
 * adı/avatar ve logout. Filtre çipleri (date range, kanal, vb.) sayfa-spesifik
 * filtrelere geçildiğinde sonraki slice'ta eklenecek.
 */
export function TopBar() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const lang = useLanguageStore((s) => s.lang);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
    }
  };

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : user?.email[0]?.toUpperCase() ?? "?";

  return (
    <div className="sticky top-0 z-9 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
      <div className="flex-1" />

      <div className="inline-flex overflow-hidden rounded-md border border-border bg-surface-2">
        {(["tr", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLanguage(l)}
            className={cn(
              "px-3 py-1.5 text-xs font-bold transition-colors",
              lang === l
                ? "bg-primary text-primary-foreground"
                : "text-text-muted hover:text-foreground",
            )}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? t("theme_light") : t("theme_dark")}
        className="border-border bg-surface-2 text-text-muted"
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      {user && (
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold">{user.full_name}</span>
            <span className="text-[10px] text-text-muted">{user.email}</span>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        aria-label={t("logout")}
        className="text-text-muted"
      >
        <LogOut />
      </Button>
    </div>
  );
}
