import { useQuery } from "@tanstack/react-query";
import { LineChart as LineChartIcon, PieChart, Table2, Target } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { ColumnSettingsMenu, ManagedColumnHeader } from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
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
import type { ChannelPerformanceRow } from "@/types/dashboard";

import { DashboardHeader, PageShell, RoasPill, useDashboardRange } from "./_shared";

/**
 * Kanal Analizi sayfasi. GlobalFilterBar ile filtrelenebilir 4 KPI, top
 * kanal trendi, ciro dagilimi, ROAS/donusum karsilastirmalari ve detayli
 * kanal performans tablosu.
 */
/** Kanal performans tablosu kolon tanimlari (id = stabil localStorage anahtari). */
interface ChannelColumn extends ColumnDef {
  /** Kolonun colgroup genisligi. */
  width: string;
  /** Saga hizali sayisal kolon mu? */
  numeric?: boolean;
  /** Tek satir icin hucre icerigini render eder. */
  cell: (row: ChannelPerformanceRow) => ReactNode;
  /** Disa aktarmada kullanilacak ham hucre degeri (formatsiz). */
  exportValue: (row: ChannelPerformanceRow) => string | number | null;
}

const CHANNEL_COLUMNS: ChannelColumn[] = [
  {
    id: "channel",
    labelKey: "channel_analysis.col_channel",
    required: true,
    width: "w-[170px]",
    cell: (c) => (
      <span className="text-sm font-semibold text-foreground">{c.channel}</span>
    ),
    exportValue: (c) => c.channel,
  },
  {
    id: "revenue",
    labelKey: "channel_analysis.col_revenue",
    width: "w-[130px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {formatCurrency(c.revenue)}
      </span>
    ),
    exportValue: (c) => toNumber(c.revenue),
  },
  {
    id: "orders",
    labelKey: "channel_analysis.col_orders",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => <span className="tabular-nums text-sm">{formatCount(c.orders)}</span>,
    exportValue: (c) => c.orders,
  },
  {
    id: "sessions",
    labelKey: "channel_analysis.col_sessions",
    width: "w-[110px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(c.sessions)}
      </span>
    ),
    exportValue: (c) => c.sessions,
  },
  {
    id: "conversion",
    labelKey: "channel_analysis.col_conversion",
    width: "w-[110px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">
        {c.conversion_rate !== null ? formatPercent(c.conversion_rate, 2) : "-"}
      </span>
    ),
    exportValue: (c) => toNumber(c.conversion_rate),
  },
  {
    id: "ad_spend",
    labelKey: "channel_analysis.col_ad_spend",
    width: "w-[120px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {Number(c.ad_spend) > 0 ? formatCurrency(c.ad_spend) : "-"}
      </span>
    ),
    exportValue: (c) => toNumber(c.ad_spend),
  },
  {
    id: "roas",
    labelKey: "channel_analysis.col_roas",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => <RoasPill value={c.roas} />,
    exportValue: (c) => toNumber(c.roas),
  },
  {
    id: "aov",
    labelKey: "channel_analysis.col_aov",
    width: "w-[110px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {c.aov !== null ? formatCurrency(c.aov) : "-"}
      </span>
    ),
    exportValue: (c) => toNumber(c.aov),
  },
  {
    id: "customers",
    labelKey: "channel_analysis.col_customers",
    width: "w-[110px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatCount(c.customers)}</span>
    ),
    exportValue: (c) => c.customers,
  },
];

export default function ChannelAnalysisPage() {
  const { t } = useTranslation("dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  useFilterUrlSync(searchParams, setSearchParams);

  const channelColumns = useColumnManager("channel-analysis-table", CHANNEL_COLUMNS);

  const [range, setRange] = useDashboardRange();

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
    queryKey: ["dashboard", "channel-analysis", range.date_from, range.date_to, filters],
    queryFn: () =>
      dashboardApi.channelAnalysis({
        date_from: range.date_from,
        date_to: range.date_to,
        channels:
          filters.selected_channels.length > 0 ? filters.selected_channels : undefined,
        devices:
          filters.selected_devices.length > 0 ? filters.selected_devices : undefined,
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

  const channelRows = useMemo(() => data?.channels ?? [], [data]);
  const channelExportColumns = useMemo(
    () =>
      channelColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: col.exportValue,
      })),
    [channelColumns.visibleColumns, t],
  );

  const revenueLabels = useMemo(
    () => data?.revenue_distribution.map((b) => b.label ?? "-") ?? [],
    [data],
  );
  const revenueValues = useMemo(
    () => data?.revenue_distribution.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );
  const roasLabels = useMemo(
    () => data?.roas_by_channel.map((b) => b.label ?? "-") ?? [],
    [data],
  );
  const roasValues = useMemo(
    () => data?.roas_by_channel.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );
  const convLabels = useMemo(
    () => data?.conversion_by_channel.map((b) => b.label ?? "-") ?? [],
    [data],
  );
  const convValues = useMemo(
    () => data?.conversion_by_channel.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );

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
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader
          title={t("channel_analysis.title")}
          range={range}
          onChangeRange={setRange}
        />
        <GlobalFilterBar fields={["channels", "devices"]} showRanges />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4">
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
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("channel_analysis.trend_title")}
          hint={t("channel_analysis.trend_hint")}
          icon={LineChartIcon}
          className="h-full self-stretch lg:col-span-2"
        >
          {loading ? (
            <ChartLoading height={300} />
          ) : trendSeries.length === 0 ? (
            <ChartEmpty height={300} />
          ) : (
            <LineChart height={300} series={trendSeries} yFormatter={formatAxisCurrency} />
          )}
        </ChartCard>

        <ChartCard
          title={t("channel_analysis.revenue_distribution")}
          hint={t("channel_analysis.revenue_distribution_hint")}
          icon={PieChart}
          className="h-full self-stretch"
        >
          <DonutChart
            labels={revenueLabels}
            values={revenueValues}
            loading={loading}
            height={300}
            totalLabel={t("channel_analysis.total")}
            valueFormatter={formatCurrency}
          />
        </ChartCard>
      </div>

      {/* ROAS + Conversion */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("channel_analysis.roas_chart_title")}
          hint={t("channel_analysis.roas_hint")}
          icon={Target}
          className="h-full self-stretch"
        >
          <BarChart
            categories={roasLabels}
            series={[{ name: t("channel_analysis.roas_label"), data: roasValues }]}
            loading={loading}
            horizontal
            height={300}
            valueFormatter={formatMultiplier}
          />
        </ChartCard>

        <ChartCard
          title={t("channel_analysis.conversion_chart_title")}
          hint={t("channel_analysis.conversion_hint")}
          icon={Target}
          className="h-full self-stretch"
        >
          <BarChart
            categories={convLabels}
            series={[
              { name: t("channel_analysis.conversion_label"), data: convValues },
            ]}
            loading={loading}
            horizontal
            height={300}
            valueFormatter={(v) => formatPercent(v, 2)}
          />
        </ChartCard>
      </div>

      {/* Detayli kanal tablosu */}
      <ChartCard
        title={t("channel_analysis.table_title")}
        hint={t("channel_analysis.table_hint")}
        icon={Table2}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={channelRows}
              columns={channelExportColumns}
              fileBase="channel-analysis"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("channel_analysis.table_title")}
            />
            <ColumnSettingsMenu manager={channelColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {channelColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={channelColumns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={channelColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !data || data.channels.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={channelColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("channel_analysis.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                data.channels.map((c) => (
                  <TableRow
                    key={c.channel}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {channelColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(c)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </PageShell>
  );
}
