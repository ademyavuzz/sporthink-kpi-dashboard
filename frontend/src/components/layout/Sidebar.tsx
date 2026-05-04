import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { Logo } from "@/components/layout/Logo";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSidebarStore } from "@/stores/useSidebarStore";

/**
 * Sol sidebar — mock referansı: width 240 collapsed/64 expanded, sticky,
 * pürüzsüz width geçişi, role badge alt blokta.
 *
 * Nav item'ları kullanıcı permission'larıyla filtreler — sadece izinli
 * sayfalar görünür (frontend/CLAUDE.md §17 row 16).
 */
export function Sidebar() {
  const { t } = useTranslation("common");
  const { has } = usePermissions();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const role = useAuthStore((s) => s.user?.role ?? null);

  const allowed = NAV_ITEMS.filter((n) => has(n.permission));

  return (
    <aside
      className={cn(
        "relative z-10 flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-border",
          collapsed ? "px-3 py-4" : "px-4 py-4",
        )}
      >
        <Logo small={collapsed} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label="toggle-sidebar"
          className="text-text-muted"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {allowed.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              title={collapsed ? t(`nav.${item.id}`) : undefined}
              className={({ isActive }) =>
                cn(
                  "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors",
                  collapsed && "justify-center px-3.5",
                  isActive
                    ? "bg-primary/15 font-semibold text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-foreground",
                )
              }
            >
              <Icon className="size-4 flex-shrink-0" />
              {!collapsed && (
                <span className="truncate">{t(`nav.${item.id}`)}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && role && (
        <div className="border-t border-border px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            {t("active_role")}
          </div>
          <div
            className="mt-1 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: `${role.color ?? "var(--primary)"}20`,
              color: role.color ?? "var(--primary)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: role.color ?? "var(--primary)" }}
            />
            {role.name}
          </div>
        </div>
      )}
    </aside>
  );
}
