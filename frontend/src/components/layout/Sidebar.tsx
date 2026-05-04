import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { Logo } from "@/components/layout/Logo";
import { NAV_GROUPS, type NavItem } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSidebarStore } from "@/stores/useSidebarStore";

/**
 * Sol sidebar — gruplandırılmış nav (Dashboard / Veri / Sistem) + collapse.
 *
 * - 3 grup, her grup uppercase mini etiket altında
 * - Aktif state'te sol kenarda 3px primary aksent bar
 * - Boş kalan grup tamamen render dışı (izin yoksa)
 * - Collapsed mode'da grup etiketleri gizlenir, sadece ikonlar görünür
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
    items: g.items.filter((item) => has(item.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "relative z-10 flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-64",
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

      <nav
        className={cn(
          "flex-1 overflow-y-auto py-3",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {groups.map((group, gi) => (
          <div
            key={group.id}
            className={cn(gi > 0 && (collapsed ? "mt-3" : "mt-5"))}
          >
            {!collapsed && (
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                {t(`nav_group.${group.id}`)}
              </div>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-2 mb-3 h-px bg-border" aria-hidden />
            )}
            <ul className="flex flex-col gap-0.5">
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
            "border-t border-border",
            collapsed ? "px-2 py-3" : "px-3 py-3",
          )}
        >
          {collapsed ? (
            <div className="flex justify-center" title={user.full_name}>
              <UserAvatar name={user.full_name} email={user.email} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2.5 py-2">
              <UserAvatar name={user.full_name} email={user.email} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[12px] font-semibold leading-tight">
                  {user.full_name}
                </span>
                <span
                  className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-none"
                  style={{
                    background: `${role.color ?? "var(--primary)"}1f`,
                    color: role.color ?? "var(--primary)",
                  }}
                >
                  <span
                    className="size-1 rounded-full"
                    style={{ background: role.color ?? "var(--primary)" }}
                  />
                  {role.name}
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
          "group relative flex items-center gap-2.5 rounded-md text-[13px] transition-colors",
          collapsed
            ? "h-10 justify-center px-0"
            : "h-9 px-3",
          isActive
            ? "bg-primary/10 font-semibold text-primary"
            : "text-text-muted hover:bg-muted hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary"
            />
          )}
          <Icon className="size-[18px] flex-shrink-0" />
          {!collapsed && <span className="truncate">{t(`nav.${item.id}`)}</span>}
        </>
      )}
    </NavLink>
  );
}

function UserAvatar({ name, email }: { name: string; email: string }) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || email[0]?.toUpperCase() || "?";
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
      {initials}
    </div>
  );
}
