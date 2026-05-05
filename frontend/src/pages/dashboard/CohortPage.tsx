import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

const MAX_OFFSET = 12;

/**
 * Cohort/Retention sayfası — ilk siparişin verildiği ay × ay-N retention %.
 *
 * Heatmap: koyu yeşil = yüksek retention, açık = düşük. month_offset=0
 * her zaman %100 (taban).
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

  const cells = q.data?.cells ?? [];
  const isLoading = q.isPending;

  // Cohort × offset matrisini oluştur
  const matrix = useMemo(() => {
    const cohorts = Array.from(
      new Set(cells.map((c) => c.cohort_month)),
    ).sort();
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
      <DashboardHeader
        title={t("cohort.title")}
        range={range}
        onChangeRange={setRange}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("cohort.heatmap_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded bg-muted/40" />
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
                  {matrix.cohorts.map((cohort, rowIdx) => {
                    const row = matrix.map.get(cohort)!;
                    const size = row.get(0)?.count ?? 0;
                    return (
                      <tr
                        key={cohort}
                        className={cn(
                          "border-b border-border/60",
                          rowIdx % 2 === 1 && "bg-surface-2/30",
                        )}
                      >
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
                                title={`${cohort} → Ay ${i}: ${cell.count} müşteri (${pct.toFixed(1)}%)`}
                              >
                                <span className="tabular-nums">
                                  {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cohort.sizes_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {matrix.cohorts.map((cohort) => {
              const size = matrix.map.get(cohort)?.get(0)?.count ?? 0;
              return (
                <div
                  key={cohort}
                  className="space-y-1.5 rounded-xl border border-border bg-surface-2/40 p-4"
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
                  {(() => {
                    const m1 = matrix.map.get(cohort)?.get(1);
                    return m1 ? (
                      <p className="text-xs text-text-muted">
                        {t("cohort.m1_retention_label")}{" "}
                        <span className="font-semibold text-foreground">
                          {formatPercent(m1.pct, 1)}
                        </span>
                      </p>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
