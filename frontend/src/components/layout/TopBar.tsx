import { Bell, ChevronDown, LogOut, Mail, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/feature/NotificationBell";
import { UserAvatar } from "@/components/feature/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authApi } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLanguageStore, type Lang } from "@/stores/useLanguageStore";
import { useThemeStore } from "@/stores/useThemeStore";

/**
 * Üst toolbar: dil + tema + bildirim + kullanıcı dropdown.
 *
 * - NotificationBell badge'li popover; localStorage persist.
 * - Kullanıcı dropdown'ı: ad/soyad, e-posta, çıkış. Logout butonu artık
 *   ayrı durmaz, dropdown içine taşındı.
 * - Sol taraf esnek (`flex-1`) — sayfa içeriği isterse kendi PageHeader'ını
 *   bu boşluğa render etmez; bu toolbar sadece chrome'tur.
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

  return (
    <header className="sticky top-0 z-9 flex h-14 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      <div className="flex-1" />

      <div className="inline-flex h-9 items-center overflow-hidden rounded-md border border-border bg-surface-2">
        {(["tr", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLanguage(l)}
            className={cn(
              "h-full px-3 text-xs font-bold transition-colors",
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
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? t("theme_light") : t("theme_dark")}
        className="text-text-muted hover:text-foreground"
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      <NotificationBell />

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3 transition-colors hover:bg-muted"
            >
              <UserAvatar user={user} size="sm" className="ring-0" />
              <span className="hidden flex-col leading-tight md:flex">
                <span className="text-[12px] font-semibold">{user.full_name}</span>
                <span className="text-[10px] text-text-muted">
                  {user.role?.name ?? user.email}
                </span>
              </span>
              <ChevronDown className="size-3.5 text-text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
            <div className="px-2.5 pb-2">
              <p className="text-sm font-semibold leading-tight">
                {user.full_name}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-text-muted">
                <Mail className="size-3" />
                {user.email}
              </p>
              {user.role && (
                <span
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: `${user.role.color ?? "var(--primary)"}1f`,
                    color: user.role.color ?? "var(--primary)",
                  }}
                >
                  <span
                    className="size-1 rounded-full"
                    style={{ background: user.role.color ?? "var(--primary)" }}
                  />
                  {user.role.name}
                </span>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/settings/profile")}>
              <UserRound />
              {t("my_profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/settings")}>
              <Settings />
              {t("nav.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/notifications")}>
              <Bell />
              {t("my_notifications")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void handleLogout()}
            >
              <LogOut />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
