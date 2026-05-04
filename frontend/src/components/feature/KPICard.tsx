import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatChange, formatKPIValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KPIResult } from "@/types/dashboard";

interface KPICardProps {
  kpi: KPIResult;
  loading?: boolean;
  /** Sıkışık layout için (sm: 4 sütun) - icon küçük gösterilir. */
  compact?: boolean;
}

/**
 * KPI kartı — değer + birim + trend (delta yüzdesi + iyi/kötü renk).
 *
 * `value === null` → "veri yok" gösterilir (örn. 0/0 hesaplaması).
 * `change_percentage === null` → trend ok'u nötr (—).
 * `is_positive` → yeşil/kırmızı renklendirme (frontend/CLAUDE.md §10).
 */
export function KPICard({ kpi, loading, compact }: KPICardProps) {
  if (loading) return <KPICardSkeleton />;

  const value = formatKPIValue(kpi.value, kpi.unit);
  const change = formatChange(kpi.change_percentage);
  const Icon = kpi.direction === "up" ? ArrowUp : kpi.direction === "down" ? ArrowDown : Minus;

  return (
    <Card>
      <CardContent className={cn("p-4 space-y-1.5", compact && "p-3 space-y-1")}>
        <p className="text-xs text-muted-foreground line-clamp-1" title={kpi.label_tr}>
          {kpi.label_tr}
        </p>
        <p
          className={cn(
            "font-semibold tabular-nums leading-tight",
            compact ? "text-lg" : "text-2xl",
          )}
        >
          {value}
        </p>
        {kpi.change_percentage !== null && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              kpi.is_positive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="tabular-nums">{change}</span>
          </div>
        )}
        {kpi.change_percentage === null && kpi.value !== null && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </CardContent>
    </Card>
  );
}

export function KPICardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        <div className="h-7 w-24 bg-muted rounded animate-pulse" />
        <div className="h-3 w-12 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}
