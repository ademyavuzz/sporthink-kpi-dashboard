import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DateRangePicker,
  computePresetRange,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import {
  formatAxisCurrency,
  formatCount,
  formatCurrency,
  formatPercent,
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { PageShell } from "./_shared";

/**
 * Overview Page — 9 KPI + revenue trend + kanal donut + funnel + top products.
 *
 * Default tarih: dummy data Ekim 2024 - Mart 2025 (canlıda Last 30 olur,
 * filter store entegre edildiğinde Sprint 9'da güncellenir).
 */
export default function OverviewPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2024-10-01",
    date_to: "2025-03-31",
  }));

  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.overview({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = overviewQuery.data;
  const isLoading = overviewQuery.isPending;

  return (
    <PageShell>
      <PageHeader
        title={t("overview.title")}
        subtitle={`${dayjs(range.date_from).format("DD.MM.YYYY")} – ${dayjs(range.date_to).format("DD.MM.YYYY")}`}
        actions={
          <>
            <PresetButton
              onClick={() =>
                setRange({ preset: "last_30", ...computePresetRange("last_30") })
              }
            >
              {t("overview.preset_last_30")}
            </PresetButton>
            <PresetButton
              onClick={() =>
                setRange({
                  preset: "custom",
                  date_from: "2024-10-01",
                  date_to: "2025-03-31",
                })
              }
            >
              {t("overview.preset_all")}
            </PresetButton>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />

      {/* KPI grid: 2 / 3 / 5 sütun */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : data ? (
          <>
            <KPICard kpi={data.summary.revenue} compact />
            <KPICard kpi={data.summary.orders} compact />
            <KPICard kpi={data.summary.aov} compact />
            <KPICard kpi={data.summary.sessions} compact />
            <KPICard kpi={data.summary.users} compact />
            <KPICard kpi={data.summary.conversion_rate} compact />
            <KPICard kpi={data.summary.bounce_rate} compact />
            <KPICard kpi={data.summary.ad_spend} compact />
            <KPICard kpi={data.summary.roas} compact />
          </>
        ) : null}
      </div>

      {/* Trend + Kanal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("overview.trend_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              loading={isLoading}
              multiAxis
              series={
                data
                  ? [
                      {
                        name: t("overview.series_revenue"),
                        data: data.daily_series.map((p) => ({
                          x: dayjs(p.date).valueOf(),
                          y: toNumber(p.revenue) ?? 0,
                        })),
                        formatter: formatCurrency,
                      },
                      {
                        name: t("overview.series_orders"),
                        data: data.daily_series.map((p) => ({
                          x: dayjs(p.date).valueOf(),
                          y: p.orders,
                        })),
                        formatter: formatCount,
                      },
                    ]
                  : []
              }
              yFormatter={formatAxisCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.channel_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              loading={isLoading}
              labels={data ? data.channels.map((c) => c.channel ?? t("overview.channel_other")) : []}
              values={
                data ? data.channels.map((c) => toNumber(c.revenue) ?? 0) : []
              }
              valueFormatter={formatCurrency}
            />
          </CardContent>
        </Card>
      </div>

      {/* Funnel + New vs Returning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.funnel_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelTable steps={data?.funnel ?? []} loading={isLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.new_returning_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.new_vs_returning.map((c) =>
                      c.customer_type === "new"
                        ? t("overview.customer_new")
                        : t("overview.customer_returning"),
                    )
                  : []
              }
              values={
                data
                  ? data.new_vs_returning.map((c) => toNumber(c.revenue) ?? 0)
                  : []
              }
              valueFormatter={formatCurrency}
              totalLabel={t("overview.total_revenue")}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t("overview.top_products_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[140px]" />
                <col />
                <col className="w-[160px]" />
                <col className="w-[110px]" />
                <col className="w-[140px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("overview.table_sku")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("overview.table_product")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("overview.table_brand")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("overview.table_units")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("overview.table_revenue")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5} className="px-4 py-3.5">
                          <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                        </TableCell>
                      </TableRow>
                    ))
                  : (data?.top_products ?? []).map((p, idx) => (
                      <TableRow
                        key={p.sku}
                        className={cn(
                          "border-b border-border/60 transition-colors",
                          idx % 2 === 1 && "bg-surface-2/40",
                          "hover:bg-primary/[0.04]",
                        )}
                      >
                        <TableCell className="px-4 py-3.5 font-mono text-xs text-text-muted">
                          {p.sku}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-sm">
                          <span
                            className="block truncate font-medium text-foreground"
                            title={p.product_name ?? ""}
                          >
                            {p.product_name ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                          {p.brand ?? (
                            <span className="text-text-dim">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                          {formatCount(p.units_sold)}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                          {formatCurrency(p.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function PresetButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-muted hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

function FunnelTable({
  steps,
  loading,
}: {
  steps: {
    step: string;
    label_tr: string;
    count: number;
    drop_from_previous_pct: string | null;
  }[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const max = useMemo(() => Math.max(...steps.map((s) => s.count), 1), [steps]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {steps.map((s) => {
        const pct = (s.count / max) * 100;
        const drop = s.drop_from_previous_pct;
        const stepLabel = t(`funnel.steps.${s.step}`, {
          defaultValue: s.label_tr,
        });
        return (
          <div key={s.step} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-foreground">
                {stepLabel}
              </span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium text-foreground">
                  {formatCount(s.count)}
                </span>
                {drop !== null && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-error-600 dark:text-error-500">
                    ↓ {formatPercent(drop, 1)}
                  </span>
                )}
              </div>
            </div>
            <div className="h-7 overflow-hidden rounded-md bg-muted/40">
              <div
                className="h-full rounded-md bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
