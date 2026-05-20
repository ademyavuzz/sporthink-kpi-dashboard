import { useQuery } from "@tanstack/react-query";
import { Filter, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { dashboardApi } from "@/lib/api/dashboard";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Funnel Analizi sayfasi. E-ticaret donusum hunisi (Goruntuleme to Satin Alma)
 * ve her adimin detay kartlari.
 */
export default function FunnelPage() {
  const { t } = useTranslation("dashboard");
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

  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const overallConversion =
    firstStep && lastStep && firstStep.count > 0
      ? (lastStep.count / firstStep.count) * 100
      : null;

  return (
    <PageShell>
      <DashboardHeader title={t("funnel.title")} range={range} onChangeRange={setRange} />

      <ChartCard
        title={t("funnel.card_title")}
        hint={t("funnel.card_hint")}
        icon={Filter}
      >
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2.5">
              {steps.map((s, idx) => {
                const pct = (s.count / max) * 100;
                const stepLabel = t(`funnel.steps.${s.step}`, {
                  defaultValue: s.label_tr,
                });
                const isLast = idx === steps.length - 1;
                return (
                  <div key={s.step}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {idx + 1}. {stepLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-semibold text-foreground">
                          {formatCount(s.count)}
                        </span>
                        {s.drop_from_previous_pct !== null && (
                          <span className="rounded bg-error-50 px-1.5 py-0.5 text-[11px] font-semibold text-error-700 dark:bg-error-500/10 dark:text-error-500">
                            {formatPercent(s.drop_from_previous_pct, 1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex h-9 items-center overflow-hidden rounded-md bg-muted/40">
                      <div
                        className={cn(
                          "flex h-full items-center rounded-md px-3 transition-all duration-500",
                          isLast
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-primary to-primary/70",
                        )}
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      >
                        <span className="text-xs font-semibold tabular-nums text-white">
                          {pct.toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {overallConversion !== null && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                <span className="text-sm font-medium text-text-muted">
                  {t("funnel.overall_conversion")}
                </span>
                <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {overallConversion.toFixed(2).replace(".", ",")}%
                </span>
              </div>
            )}
          </div>
        )}
      </ChartCard>

      <ChartCard
        title={t("funnel.step_details_card_title")}
        hint={t("funnel.step_details_hint")}
        icon={ListChecks}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/40" />
              ))
            : steps.map((s, idx) => {
                const stepLabel = t(`funnel.steps.${s.step}`, {
                  defaultValue: s.label_tr,
                });
                return (
                  <div
                    key={s.step}
                    className="space-y-1.5 rounded-xl border border-border bg-surface-2/40 p-4"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                      {t("funnel.step_label")} {idx + 1}
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {stepLabel}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">
                      {formatCount(s.count)}
                    </p>
                    {idx === 0 ? (
                      <p className="text-xs text-text-muted">
                        {t("funnel.step_label_start")}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">
                        {t("funnel.drop_from_previous")}{" "}
                        <span className="font-semibold text-error-600 dark:text-error-500">
                          {formatPercent(toNumber(s.drop_from_previous_pct) ?? 0, 1)}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
        </div>
      </ChartCard>
    </PageShell>
  );
}
