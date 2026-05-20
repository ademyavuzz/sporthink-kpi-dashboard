import { useQuery } from "@tanstack/react-query";
import { LineChart as LineChartIcon, PieChart, Table2, Target } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { ChartCard } from "@/components/feature/ChartCard";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
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
import { useFiltersStore } from "@/stores/useFiltersStore";

import { DashboardHeader, PageShell, RoasPill, useDashboardRange } from "./_shared";

/**
 * Kanal Analizi sayfasi. GlobalFilterBar ile filtrelenebilir 4 KPI, top
 * kanal trendi, ciro dagilimi, ROAS/donusum karsilastirmalari ve detayli
 * kanal performans tablosu.
 */
export default function ChannelAnalysisPage() {
  const { t } = useTranslation("dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  useFilterUrlSync(searchParams, setSearchParams);

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
        <GlobalFilterBar />
      </div>

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("channel_analysis.trend_title")}
          hint={t("channel_analysis.trend_hint")}
          icon={LineChartIcon}
          className="lg:col-span-2"
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("channel_analysis.roas_chart_title")}
          hint={t("channel_analysis.roas_hint")}
          icon={Target}
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
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[170px]" />
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
                  {t("channel_analysis.col_channel")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_revenue")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_orders")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_sessions")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_conversion")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_ad_spend")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_roas")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_aov")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("channel_analysis.col_customers")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9} className="px-4 py-3.5">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !data || data.channels.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={9}
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
                        : "-"}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                      {Number(c.ad_spend) > 0 ? formatCurrency(c.ad_spend) : "-"}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right">
                      <RoasPill value={c.roas} />
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                      {c.aov !== null ? formatCurrency(c.aov) : "-"}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                      {formatCount(c.customers)}
                    </TableCell>
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
