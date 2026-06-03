import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  KeyRound,
  Loader2,
  Minus,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

interface RolePermissionMatrixProps {
  /** Role'e atanmış izin kodları. Süper Admin için tüm kodlar gelir. */
  granted: string[];
  /**
   * Sistem rolü ise tüm izinler her zaman dolu kabul edilir ("tam yetki")
   * — backend `require_permission` bypass eder.
   */
  isSystem?: boolean;
}

const CATEGORY_ORDER = ["view", "data", "admin", "system"] as const;

/** Her kategori için ikon + tema rengi — PermissionPicker ile aynı dil. */
const CATEGORY_META: Record<string, { icon: typeof BarChart3; toneClass: string }> = {
  view: { icon: BarChart3, toneClass: "text-brand-blue bg-brand-blue/10" },
  data: {
    icon: KeyRound,
    toneClass: "text-success-600 bg-success-500/10 dark:text-success-500",
  },
  admin: { icon: Users, toneClass: "text-primary bg-primary/10" },
  system: {
    icon: Settings,
    toneClass: "text-warning-600 bg-warning-500/10 dark:text-warning-500",
  },
};

/**
 * Bir rolün izinlerini kategori bazlı, salt-okunur matris olarak gösterir.
 *
 * Rol detay görüntüleme (drawer) için kullanılır. Düzenleme için
 * `PermissionPicker` kullanılır; bu bileşen yalnızca okur.
 */
export function RolePermissionMatrix({ granted, isSystem }: RolePermissionMatrixProps) {
  const { t } = useTranslation("admin");
  const q = useQuery({
    queryKey: ["permissions", "grouped"],
    queryFn: () => adminApi.listPermissions(),
    staleTime: 60 * 60_000, // 1 saat
  });

  const grantedSet = useMemo(() => new Set(granted), [granted]);

  if (q.isPending) {
    return (
      <div className="py-12 text-center text-text-muted">
        <Loader2 className="mx-auto size-5 animate-spin" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <p className="py-4 text-center text-sm text-destructive">
        {t("permissions_load_failed")}
      </p>
    );
  }

  const orderedEntries = CATEGORY_ORDER.flatMap((key) => {
    const items = q.data?.[key];
    return items ? [[key, items] as const] : [];
  });

  return (
    <div className="space-y-3">
      {orderedEntries.map(([cat, items]) => {
        const codes = items.map((i) => i.code);
        const grantedInCat = isSystem
          ? codes.length
          : codes.filter((c) => grantedSet.has(c)).length;
        const allInCat = codes.length;
        const meta = CATEGORY_META[cat] ?? { icon: Shield, toneClass: "" };
        const Icon = meta.icon;

        return (
          <div key={cat} className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Kategori başlığı */}
            <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-3 py-2.5">
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
                  meta.toneClass,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground">
                {items[0]?.category_label ?? cat}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  grantedInCat > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-text-muted",
                )}
              >
                {grantedInCat}
                <span className="opacity-50">/</span>
                {allInCat}
              </span>
            </div>

            {/* İzin satırları */}
            <ul className="grid grid-cols-1 gap-x-3 gap-y-0.5 p-2 sm:grid-cols-2">
              {items.map((p) => {
                const isGranted = isSystem || grantedSet.has(p.code);
                return (
                  <li
                    key={p.code}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg px-2.5 py-2",
                      isGranted ? "bg-primary/[0.04]" : "opacity-55",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                        isGranted
                          ? "bg-success-500/15 text-success-600 dark:text-success-500"
                          : "bg-muted text-text-dim",
                      )}
                      aria-label={
                        isGranted ? t("roles.detail_granted") : t("roles.detail_not_granted")
                      }
                    >
                      {isGranted ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : (
                        <Minus className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-tight text-foreground">
                        {p.description ?? p.code}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-text-dim">
                        {p.code}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
