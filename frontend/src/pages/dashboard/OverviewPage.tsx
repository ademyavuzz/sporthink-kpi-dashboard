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
  formatAxisNumber,
  formatCount,
  formatCurrency,
  formatPercent,
  toNumber,
} from "@/lib/format";

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
    <div className="container mx-auto max-w-[1400px] space-y-6 px-6 py-6">
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
      <Card>
        <CardHeader>
          <CardTitle>{t("overview.top_products_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("overview.table_sku")}</TableHead>
                <TableHead>{t("overview.table_product")}</TableHead>
                <TableHead>{t("overview.table_brand")}</TableHead>
                <TableHead className="text-right">{t("overview.table_units")}</TableHead>
                <TableHead className="text-right">{t("overview.table_revenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <div className="h-5 bg-muted rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                : (data?.top_products ?? []).map((p) => (
                    <TableRow key={p.sku}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell
                        className="max-w-[300px] truncate"
                        title={p.product_name ?? ""}
                      >
                        {p.product_name ?? "—"}
                      </TableCell>
                      <TableCell>{p.brand ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(p.units_sold)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(p.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-accent transition-colors"
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
    <div className="space-y-2">
      {steps.map((s) => {
        const pct = (s.count / max) * 100;
        const drop = s.drop_from_previous_pct;
        return (
          <div key={s.step} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{s.label_tr}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{formatCount(s.count)}</span>
                {drop !== null && (
                  <span className="text-xs text-rose-600">
                    ↓ {formatPercent(drop, 1)}
                  </span>
                )}
              </div>
            </div>
            <div className="h-7 bg-muted/40 rounded overflow-hidden">
              <div
                className="h-full bg-primary/80 rounded transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
