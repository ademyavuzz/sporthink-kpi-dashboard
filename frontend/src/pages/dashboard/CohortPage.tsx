import { useQuery } from "@tanstack/react-query";
import { Grid3x3, Users } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

const MAX_OFFSET = 12;

/**
 * Cohort / Retention sayfasi. Ilk siparisin verildigi ay x ay-N retention %
 * heatmap'i ve cohort buyukluk kartlari.
 */
export default function CohortPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "cohort", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.cohort({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const cells = useMemo(() => q.data?.cells ?? [], [q.data?.cells]);
  const isLoading = q.isPending;

  const matrix = useMemo(() => {
    const cohorts = Array.from(new Set(cells.map((c) => c.cohort_month))).sort();
    const map = new Map<string, Map<number, { count: number; pct: number | null }>>();
    for (const c of cells) {
      if (!map.has(c.cohort_month)) map.set(c.cohort_month, new Map());
      map.get(c.cohort_month)!.set(c.month_offset, {
        count: c.customer_count,
        pct: toNumber(c.retention_pct),
      });
    }
    return { cohorts, map };
  }, [cells]);

  return (
    <PageShell>
      <DashboardHeader title={t("cohort.title")} range={range} onChangeRange={setRange} />

      <ChartCard
        title={t("cohort.heatmap_card_title")}
        hint={t("cohort.heatmap_hint")}
        icon={Grid3x3}
        action={
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>{t("cohort.legend_low")}</span>
            <span className="h-3 w-20 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-500" />
            <span>{t("cohort.legend_high")}</span>
          </div>
        }
      >
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
        ) : matrix.cohorts.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">
            {t("cohort.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-border bg-surface-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                    {t("cohort.col_cohort")}
                  </th>
                  <th className="border-b border-border bg-surface-2 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                    {t("cohort.col_size")}
                  </th>
                  {Array.from({ length: MAX_OFFSET + 1 }).map((_, i) => (
                    <th
                      key={i}
                      className="border-b border-border bg-surface-2 px-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-text-dim"
                    >
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.cohorts.map((cohort) => {
                  const row = matrix.map.get(cohort)!;
                  const size = row.get(0)?.count ?? 0;
                  return (
                    <tr key={cohort} className="border-b border-border/60">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-mono text-xs font-semibold text-foreground">
                        {dayjs(cohort).format("YYYY-MM")}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-text-muted">
                        {formatCount(size)}
                      </td>
                      {Array.from({ length: MAX_OFFSET + 1 }).map((_, i) => {
                        const cell = row.get(i);
                        if (!cell) {
                          return (
                            <td key={i} className="px-0.5 py-1">
                              <div className="h-8 rounded-md bg-muted/20" />
                            </td>
                          );
                        }
                        const pct = cell.pct ?? 0;
                        const intensity = Math.min(pct / 100, 1);
                        return (
                          <td key={i} className="px-0.5 py-1">
                            <div
                              className={cn(
                                "flex h-8 items-center justify-center rounded-md text-xs font-semibold",
                                pct >= 50 ? "text-white" : "text-foreground",
                              )}
                              style={{
                                backgroundColor: `rgba(18, 183, 106, ${0.1 + intensity * 0.85})`,
                              }}
                              title={`${dayjs(cohort).format("YYYY-MM")} / M${i}: ${formatCount(cell.count)} (${pct.toFixed(1)}%)`}
                            >
                              <span className="tabular-nums">
                                {pct > 0 ? `${pct.toFixed(0)}%` : ""}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title={t("cohort.sizes_card_title")}
        hint={t("cohort.sizes_hint")}
        icon={Users}
      >
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-md bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {matrix.cohorts.map((cohort) => {
              const size = matrix.map.get(cohort)?.get(0)?.count ?? 0;
              const m1 = matrix.map.get(cohort)?.get(1);
              return (
                <div
                  key={cohort}
                  className="space-y-1.5 rounded-md border border-border bg-surface-2/40 p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                    {dayjs(cohort).format("MMMM YYYY")}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatCount(size)}{" "}
                    <span className="text-xs font-normal text-text-muted">
                      {t("cohort.customers_suffix")}
                    </span>
                  </p>
                  {m1 && (
                    <p className="text-xs text-text-muted">
                      {t("cohort.m1_retention_label")}{" "}
                      <span className="font-semibold text-foreground">
                        {formatPercent(m1.pct, 1)}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </PageShell>
  );
}
