import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatChange, formatKPIValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KPIResult } from "@/types/dashboard";

interface KPICardProps {
  kpi: KPIResult;
  loading?: boolean;
  /** Sıkışık layout için (sm: 4 sütun) — daha kısa padding ve değer. */
  compact?: boolean;
}

/**
 * KPI kartı — değer + birim + trend (delta yüzdesi + iyi/kötü renk).
 *
 * `value === null` → "veri yok" gösterilir (örn. 0/0 hesaplaması).
 * `change_percentage === null` → trend gizlenir, gürültü oluşturulmaz.
 * `is_positive` → yeşil/kırmızı renkli mini pill (frontend/CLAUDE.md §10).
 */
export function KPICard({ kpi, loading, compact }: KPICardProps) {
  if (loading) return <KPICardSkeleton compact={compact} />;

  const value = formatKPIValue(kpi.value, kpi.unit);
  const change = formatChange(kpi.change_percentage);
  const Icon =
    kpi.direction === "up" ? ArrowUp : kpi.direction === "down" ? ArrowDown : Minus;

  return (
    <Card className="gap-0 py-0 transition-shadow hover:shadow-sm">
      <CardContent className={cn("space-y-2", compact ? "p-3.5" : "p-4")}>
        <p
          className="text-[11px] font-semibold uppercase tracking-wide text-text-dim line-clamp-1"
          title={kpi.label_tr}
        >
          {kpi.label_tr}
        </p>
        <p
          className={cn(
            "font-semibold tabular-nums leading-tight tracking-tight",
            compact ? "text-[19px]" : "text-[26px]",
          )}
        >
          {value}
        </p>
        {kpi.change_percentage !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              kpi.is_positive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
            )}
          >
            <Icon className="size-3" />
            <span className="tabular-nums">{change}</span>
          </span>
        ) : (
          <span className="inline-block h-[20px]" aria-hidden />
        )}
      </CardContent>
    </Card>
  );
}

export function KPICardSkeleton({ compact }: { compact?: boolean } = {}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className={cn("space-y-2", compact ? "p-3.5" : "p-4")}>
        <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        <div className="h-7 w-24 rounded bg-muted animate-pulse" />
        <div className="h-4 w-12 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}
