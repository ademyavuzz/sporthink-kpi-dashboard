import {
  Bell,
  ChevronDown,
  LogOut,
  Mail,
  Moon,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/feature/NotificationBell";
import { UserAvatar } from "@/components/feature/UserAvatar";
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
 * Üst toolbar — TailAdmin pattern: search input + 11x11 yuvarlak ikon
 * butonlar + avatar dropdown.
 *
 * - Sol: search input (⌘K hint, placeholder, görsel zenginlik)
 * - Sağ: dil toggle, tema toggle, NotificationBell, user dropdown
 * - 64px yükseklik, sticky, beyaz/dark-gray bg
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
    <header className="sticky top-0 z-9 flex h-16 flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Language toggle */}
        <div className="inline-flex h-11 items-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          {(["tr", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={cn(
                "h-full px-3 text-xs font-bold transition-colors",
                lang === l
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white",
              )}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Theme toggle — yuvarlak ikon button */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("theme_light") : t("theme_dark")}
          className="inline-flex size-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>

        <NotificationBell />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 inline-flex h-11 items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <UserAvatar user={user} size="md" className="ring-0" />
                <span className="hidden flex-col leading-tight md:flex">
                  <span className="text-[13px] font-medium text-gray-800 dark:text-white/90">
                    {user.full_name}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {user.role?.name ?? user.email}
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
              <div className="px-2.5 pb-2">
                <p className="text-sm font-semibold leading-tight">
                  {user.full_name}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-text-muted">
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
      </div>
    </header>
  );
}
