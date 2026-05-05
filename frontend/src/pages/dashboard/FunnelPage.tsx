import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/lib/api/dashboard";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

const STEP_COLORS = [
  "bg-blue-500/80",
  "bg-cyan-500/80",
  "bg-amber-500/80",
  "bg-emerald-500/80",
];

export default function FunnelPage() {
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "funnel", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.funnel({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const steps = q.data?.steps ?? [];
  const max = Math.max(...steps.map((s) => s.count), 1);
  const isLoading = q.isPending;

  // Genel dönüşüm: ilk adım → son adım
  const overallConversion =
    steps.length >= 2 && steps[0].count > 0
      ? (steps[steps.length - 1].count / steps[0].count) * 100
      : null;

  return (
    <PageShell>
      <DashboardHeader
        title="Funnel Analizi"
        range={range}
        onChangeRange={setRange}
      />

      <Card>
        <CardHeader>
          <CardTitle>Dönüşüm Hunisi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/40 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((s, idx) => {
                const pct = (s.count / max) * 100;
                const color = STEP_COLORS[idx % STEP_COLORS.length];
                return (
                  <div key={s.step} className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">
                        {idx + 1}. {s.label_tr}
                      </span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="tabular-nums font-semibold">
                          {formatCount(s.count)}
                        </span>
                        {s.drop_from_previous_pct !== null && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-error-600 dark:text-error-500">
                            ↓ {formatPercent(s.drop_from_previous_pct, 1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-12 bg-muted/30 rounded overflow-hidden flex items-center">
                      <div
                        className={cn(
                          "h-full rounded transition-all flex items-center px-3",
                          color,
                        )}
                        style={{ width: `${pct}%` }}
                      >
                        <span className="text-white text-sm font-medium tabular-nums">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {overallConversion !== null && (
                <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                  <span className="text-sm font-semibold text-text-muted">
                    Genel Dönüşüm
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {overallConversion.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adım Detayları</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {steps.map((s, idx) => (
              <div
                key={s.step}
                className="space-y-1.5 rounded-xl border border-border bg-surface-2/40 p-4"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                  Adım {idx + 1} — {s.label_tr}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCount(s.count)}
                </p>
                {idx === 0 ? (
                  <p className="text-xs text-text-muted">Başlangıç</p>
                ) : (
                  <p className="text-xs text-text-muted">
                    Önceki adımdan{" "}
                    <span className="font-semibold text-error-600 dark:text-error-500">
                      −{formatPercent(toNumber(s.drop_from_previous_pct) ?? 0, 1)}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
