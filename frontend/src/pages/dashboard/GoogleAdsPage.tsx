import { useQuery } from "@tanstack/react-query";
import { Megaphone, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
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
import {
  formatAxisCurrency,
  formatCount,
  formatCurrency,
  formatPercent,
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  DashboardHeader,
  PageShell,
  RoasPill,
  useDashboardRange,
} from "./_shared";

/**
 * Google Ads sayfasi. 8 reklam KPI'si, gunluk harcama/getiri trendi ve
 * kampanya performans tablosu.
 */
export default function GoogleAdsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "google", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.google({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const campaigns = data?.campaigns ?? [];

  return (
    <PageShell>
      <DashboardHeader title={t("google_ads.title")} range={range} onChangeRange={setRange} />

      {/* Reklam KPI'lari */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {isLoading || !data
          ? Array.from({ length: 8 }).map((_, i) => <KPICardSkeleton key={i} compact />)
          : (
              <>
                <KPICard kpi={data.ad_spend} compact />
                <KPICard kpi={data.impressions} compact />
                <KPICard kpi={data.clicks} compact />
                <KPICard kpi={data.ctr} compact />
                <KPICard kpi={data.cpc} compact />
                <KPICard kpi={data.ad_conversions} compact />
                <KPICard kpi={data.cost_per_conversion} compact />
                <KPICard kpi={data.roas} compact />
              </>
            )}
      </div>

      {/* Harcama vs Getiri trendi */}
      <ChartCard
        title={t("google_ads.trend_card_title")}
        hint={t("google_ads.trend_hint")}
        icon={TrendingUp}
      >
        <LineChart
          loading={isLoading}
          multiAxis
          series={
            data
              ? [
                  {
                    name: t("google_ads.series_ad_revenue"),
                    color: "#10b981",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: toNumber(p.revenue) ?? 0,
                    })),
                    formatter: formatCurrency,
                  },
                  {
                    name: t("google_ads.series_ad_spend"),
                    color: "#8b5cf6",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: toNumber(p.spend) ?? 0,
                    })),
                    formatter: formatCurrency,
                  },
                ]
              : []
          }
          yFormatter={formatAxisCurrency}
        />
      </ChartCard>

      {/* Kampanya tablosu */}
      <ChartCard
        title={t("google_ads.campaigns_card_title")}
        hint={t("google_ads.campaigns_hint")}
        icon={Megaphone}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[52px]" />
              <col />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
              <col className="w-[88px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col className="w-[96px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  #
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_campaign")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_impressions")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_clicks")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_ctr")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_cpc")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_spend")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_conversions")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_revenue")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("google_ads.col_roas")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10} className="px-4 py-3.5">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : campaigns.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={10}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("google_ads.campaigns_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c, idx) => (
                  <TableRow
                    key={c.campaign_id}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    <TableCell className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
                          idx < 3
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-text-muted",
                        )}
                      >
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-sm">
                      <span
                        className="block truncate font-medium text-foreground"
                        title={c.campaign_name ?? ""}
                      >
                        {c.campaign_name ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                      {formatCount(c.impressions)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                      {formatCount(c.clicks)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                      {formatPercent(c.ctr, 2)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                      {formatCurrency(c.cpc)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                      {formatCurrency(c.spend)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                      {formatCount(c.conversions)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                      {formatCurrency(c.conversions_value)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right">
                      <RoasPill value={c.roas} />
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
