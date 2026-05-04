import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, useDashboardRange } from "./_shared";

const MAX_OFFSET = 12;

/**
 * Cohort/Retention sayfası — ilk siparişin verildiği ay × ay-N retention %.
 *
 * Heatmap: koyu yeşil = yüksek retention, açık = düşük. month_offset=0
 * her zaman %100 (taban).
 */
export default function CohortPage() {
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
    <div className="space-y-6">
      <DashboardHeader
        title="Cohort / Retention"
        range={range}
        onChangeRange={setRange}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Retention Heatmap — Kayıt Ayı × Ay Sonra Aktivite
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 bg-muted/40 rounded animate-pulse" />
          ) : matrix.cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Bu tarih aralığında cohort verisi yok.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-background z-10 border-b">
                      Cohort (Kayıt Ayı)
                    </th>
                    <th className="text-right p-2 border-b">Boyut</th>
                    {Array.from({ length: MAX_OFFSET + 1 }).map((_, i) => (
                      <th key={i} className="text-center p-2 border-b">
                        Ay {i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.cohorts.map((cohort) => {
                    const row = matrix.map.get(cohort)!;
                    const size = row.get(0)?.count ?? 0;
                    return (
                      <tr key={cohort}>
                        <td className="p-2 font-mono sticky left-0 bg-background z-10 border-b">
                          {dayjs(cohort).format("YYYY-MM")}
                        </td>
                        <td className="p-2 text-right tabular-nums border-b">
                          {formatCount(size)}
                        </td>
                        {Array.from({ length: MAX_OFFSET + 1 }).map((_, i) => {
                          const cell = row.get(i);
                          if (!cell) {
                            return (
                              <td key={i} className="p-1 border-b">
                                <div className="h-8 bg-muted/20 rounded" />
                              </td>
                            );
                          }
                          const pct = cell.pct ?? 0;
                          // 0-100 → renk yoğunluğu
                          const intensity = Math.min(pct / 100, 1);
                          return (
                            <td key={i} className="p-1 border-b">
                              <div
                                className={cn(
                                  "h-8 rounded flex items-center justify-center font-medium",
                                  pct >= 50
                                    ? "text-white"
                                    : "text-foreground",
                                )}
                                style={{
                                  backgroundColor: `rgba(16, 185, 129, ${0.1 + intensity * 0.85})`,
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
          <CardTitle>Cohort Boyutları</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {matrix.cohorts.map((cohort) => {
              const size = matrix.map.get(cohort)?.get(0)?.count ?? 0;
              return (
                <div
                  key={cohort}
                  className="p-3 rounded-lg border bg-muted/20"
                >
                  <p className="text-xs text-muted-foreground">
                    {dayjs(cohort).format("MMMM YYYY")}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCount(size)} müşteri
                  </p>
                  {(() => {
                    const m1 = matrix.map.get(cohort)?.get(1);
                    return m1 ? (
                      <p className="text-xs">
                        Ay 1 retention:{" "}
                        <span className="font-medium">
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
    </div>
  );
}
