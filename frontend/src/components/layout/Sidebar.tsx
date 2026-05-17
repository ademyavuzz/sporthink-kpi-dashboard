import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { UserAvatar } from "@/components/feature/UserAvatar";
import { Logo } from "@/components/layout/Logo";
import { NAV_GROUPS, type NavItem } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSidebarStore } from "@/stores/useSidebarStore";

/**
 * Sol sidebar — TailAdmin pattern: 290px / 90px, bg-white / dark:bg-gray-900.
 *
 * - 3 grup, her grup uppercase mini etiket altında (`text-gray-400`)
 * - Aktif state'te `bg-primary/10 text-primary` (rose tonu)
 * - Permission-aware filtreleme — boş kalan grup tamamen render dışı
 * - Collapsed mode'da 90px, sadece ikonlar + tooltip
 *
 * `frontend/CLAUDE.md` §17 row 16: permission kontrolü UX içindir,
 * güvenlik backend'de.
 */
export function Sidebar() {
  const { t } = useTranslation("common");
  const { has } = usePermissions();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.permission || has(item.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "relative z-10 flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 dark:border-gray-800 dark:bg-gray-900",
        collapsed ? "w-[90px]" : "w-[290px]",
      )}
    >
      {/* Header — logo + collapse toggle (TopBar h-16 ile birebir hizalı) */}
      <div
        className={cn(
          "flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800",
          collapsed ? "px-3" : "px-6",
        )}
      >
        <Logo small={collapsed} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label="toggle-sidebar"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto py-4",
          collapsed ? "px-3" : "px-5",
        )}
      >
        {groups.map((group, gi) => (
          <div
            key={group.id}
            className={cn(gi > 0 && (collapsed ? "mt-6" : "mt-7"))}
          >
            {!collapsed ? (
              <div className="mb-3 px-2 text-xs font-medium uppercase tracking-[0.05em] text-gray-400 dark:text-gray-500">
                {t(`nav_group.${group.id}`)}
              </div>
            ) : (
              gi > 0 && (
                <div
                  className="mx-2 mb-4 h-px bg-gray-200 dark:bg-gray-800"
                  aria-hidden
                />
              )
            )}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarLink item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {role && user && (
        <div
          className={cn(
            "border-t border-gray-200 dark:border-gray-800",
            collapsed ? "px-3 py-4" : "px-5 py-4",
          )}
        >
          {collapsed ? (
            <div className="flex justify-center" title={user.full_name}>
              <UserAvatar user={user} size="md" />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
              <UserAvatar user={user} size="md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium leading-tight text-gray-800 dark:text-white/90">
                  {user.full_name}
                </span>
                <span
                  className="mt-0.5 truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400"
                  title={user.email}
                >
                  {user.email}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function SidebarLink({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const { t } = useTranslation("common");
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      title={collapsed ? t(`nav.${item.id}`) : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
          collapsed ? "h-11 justify-center px-0" : "h-11 px-3",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-white",
        )
      }
    >
      <Icon className="size-[22px] flex-shrink-0" />
      {!collapsed && <span className="truncate">{t(`nav.${item.id}`)}</span>}
    </NavLink>
  );
}
