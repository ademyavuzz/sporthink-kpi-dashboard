import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import {
  DateRangePicker,
  computePresetRange,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
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
import { useFilterUrlSync } from "@/lib/filter-url";
import {
  formatAxisCurrency,
  formatCount,
  formatCurrency,
  formatMultiplier,
  formatPercent,
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFiltersStore } from "@/stores/useFiltersStore";

import { PageShell } from "./_shared";

export default function ChannelAnalysisPage() {
  const { t } = useTranslation(["dashboard"]);
  const [searchParams, setSearchParams] = useSearchParams();
  useFilterUrlSync(searchParams, setSearchParams);

  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2024-10-01",
    date_to: "2025-03-31",
  }));

  // Filter store'dan tüm aktif filtreleri al — `useShallow` ile gereksiz
  // re-render'ları önle (object selector her render yeni referans üretir).
  const filters = useFiltersStore(
    useShallow((s) => ({
      selected_channels: s.selected_channels,
      selected_devices: s.selected_devices,
      revenue_range: s.revenue_range,
      orders_range: s.orders_range,
      roas_range: s.roas_range,
      conversion_range: s.conversion_range,
    })),
  );

  const q = useQuery({
    queryKey: [
      "dashboard",
      "channel-analysis",
      range.date_from,
      range.date_to,
      filters,
    ],
    queryFn: () =>
      dashboardApi.channelAnalysis({
        date_from: range.date_from,
        date_to: range.date_to,
        channels: filters.selected_channels.length > 0 ? filters.selected_channels : undefined,
        devices: filters.selected_devices.length > 0 ? filters.selected_devices : undefined,
        revenue_min: filters.revenue_range.min,
        revenue_max: filters.revenue_range.max,
        orders_min: filters.orders_range.min,
        orders_max: filters.orders_range.max,
        roas_min: filters.roas_range.min,
        roas_max: filters.roas_range.max,
        conversion_min: filters.conversion_range.min,
        conversion_max: filters.conversion_range.max,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const loading = q.isPending;

  // Donut: ciro dağılımı
  const revenueLabels = useMemo(
    () => data?.revenue_distribution.map((b) => b.label ?? "—") ?? [],
    [data],
  );
  const revenueValues = useMemo(
    () =>
      data?.revenue_distribution.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );

  // Bar: ROAS
  const roasLabels = useMemo(
    () => data?.roas_by_channel.map((b) => b.label ?? "—") ?? [],
    [data],
  );
  const roasValues = useMemo(
    () => data?.roas_by_channel.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );

  // Bar: Conversion
  const convLabels = useMemo(
    () => data?.conversion_by_channel.map((b) => b.label ?? "—") ?? [],
    [data],
  );
  const convValues = useMemo(
    () =>
      data?.conversion_by_channel.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );

  // Multi-series line: günlük ciro top kanal başına
  const trendSeries = useMemo(() => {
    if (!data) return [];
    const byChannel = new Map<string, { x: number; y: number }[]>();
    for (const p of data.daily_revenue_trend) {
      const arr = byChannel.get(p.channel) ?? [];
      arr.push({ x: dayjs(p.date).valueOf(), y: Number(toNumber(p.revenue) ?? 0) });
      byChannel.set(p.channel, arr);
    }
    return Array.from(byChannel.entries()).map(([name, points]) => ({
      name,
      data: points,
      formatter: formatCurrency,
    }));
  }, [data]);

  return (
    <PageShell>
      <PageHeader
        title={t("dashboard:channel_analysis.title")}
        subtitle={`${dayjs(range.date_from).format("DD.MM.YYYY")} – ${dayjs(range.date_to).format("DD.MM.YYYY")}`}
        actions={
          <>
            <PresetButton
              onClick={() =>
                setRange({ preset: "last_30", ...computePresetRange("last_30") })
              }
            >
              {t("dashboard:channel_analysis.preset_last_30")}
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
              {t("dashboard:channel_analysis.preset_all")}
            </PresetButton>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />

      <GlobalFilterBar />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard kpi={data.active_channels} />
            <KPICard kpi={data.top_channel_revenue} />
            <KPICard kpi={data.avg_roas} />
            <KPICard kpi={data.avg_conversion_rate} />
          </>
        )}
      </div>

      {/* Trend + Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:channel_analysis.trend_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartLoading height={300} />
            ) : trendSeries.length === 0 ? (
              <ChartEmpty height={300} />
            ) : (
              <LineChart
                height={300}
                series={trendSeries}
                yFormatter={formatAxisCurrency}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:channel_analysis.revenue_distribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              labels={revenueLabels}
              values={revenueValues}
              loading={loading}
              height={300}
              totalLabel={t("dashboard:channel_analysis.total")}
              valueFormatter={(v) => formatCurrency(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* ROAS + Conversion */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:channel_analysis.roas_chart_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={roasLabels}
              series={[
                {
                  name: t("dashboard:channel_analysis.roas_label"),
                  data: roasValues,
                },
              ]}
              loading={loading}
              horizontal
              height={300}
              valueFormatter={(v) => formatMultiplier(v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:channel_analysis.conversion_chart_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={convLabels}
              series={[
                {
                  name: t("dashboard:channel_analysis.conversion_label"),
                  data: convValues,
                },
              ]}
              loading={loading}
              horizontal
              height={300}
              valueFormatter={(v) => formatPercent(v, 2)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Detaylı kanal tablosu */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard:channel_analysis.table_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[160px]" />
                <col className="w-[130px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
                <col className="w-[110px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_channel")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_revenue")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_orders")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_sessions")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_conversion")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_ad_spend")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_roas")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_aov")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:channel_analysis.col_customers")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !data || data.channels.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      {t("dashboard:channel_analysis.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.channels.map((c, idx) => {
                    const roasNum = c.roas !== null ? Number(c.roas) : null;
                    const roasTone =
                      roasNum === null
                        ? "neutral"
                        : roasNum >= 4
                          ? "success"
                          : roasNum >= 1
                            ? "info"
                            : "error";
                    return (
                      <TableRow
                        key={c.channel}
                        className={cn(
                          "border-b border-border/60 transition-colors",
                          idx % 2 === 1 && "bg-surface-2/40",
                          "hover:bg-primary/[0.04]",
                        )}
                      >
                        <TableCell className="px-4 py-3.5 text-sm font-semibold text-foreground">
                          {c.channel}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                          {formatCurrency(c.revenue)}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                          {formatCount(c.orders)}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                          {formatCount(c.sessions)}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                          {c.conversion_rate !== null
                            ? formatPercent(c.conversion_rate, 2)
                            : "—"}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                          {Number(c.ad_spend) > 0
                            ? formatCurrency(c.ad_spend)
                            : "—"}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right">
                          {roasNum !== null ? (
                            <RoasPill tone={roasTone} value={roasNum} />
                          ) : (
                            <span className="text-text-dim">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                          {c.aov !== null ? formatCurrency(c.aov) : "—"}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                          {formatCount(c.customers)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function RoasPill({
  tone,
  value,
}: {
  tone: "success" | "info" | "error" | "neutral";
  value: number;
}) {
  const cls = {
    success:
      "bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20",
    info: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    error:
      "bg-error-50 text-error-700 ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20",
    neutral: "bg-muted text-text-muted",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset",
        cls,
      )}
    >
      {formatMultiplier(value)}
    </span>
  );
}

function PresetButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-muted hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
