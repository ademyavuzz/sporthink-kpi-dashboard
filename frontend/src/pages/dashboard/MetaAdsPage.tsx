import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { LineChart } from "@/components/feature/charts/LineChart";
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

import {
  DashboardHeader,
  PageShell,
  RoasPill,
  useDashboardRange,
} from "./_shared";

export default function MetaAdsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "meta", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.meta({ date_from: range.date_from, date_to: range.date_to }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  return (
    <PageShell>
      <DashboardHeader title={t("meta_ads.title")} range={range} onChangeRange={setRange} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.ad_spend} compact />
                <KPICard kpi={data.impressions} compact />
                <KPICard kpi={data.clicks} compact />
                <KPICard kpi={data.ctr} compact />
                <KPICard kpi={data.cpc} compact />
                <KPICard kpi={data.ad_conversions} compact />
                <KPICard kpi={data.roas} compact />
                <KPICard kpi={data.frequency} compact />
              </>
            )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("meta_ads.trend_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            loading={isLoading}
            multiAxis
            series={
              data
                ? [
                    {
                      name: t("meta_ads.series_ad_revenue"),
                      data: data.daily_series.map((p) => ({
                        x: dayjs(p.date).valueOf(),
                        y: toNumber(p.revenue) ?? 0,
                      })),
                      formatter: formatCurrency,
                    },
                    {
                      name: t("meta_ads.series_ad_spend"),
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
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t("meta_ads.campaigns_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col />
                <col className="w-[110px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_campaign")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_impressions")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_clicks")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_ctr")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_cpc")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_spend")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_conversions")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_revenue")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("meta_ads.col_roas")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data?.campaigns ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.campaigns ?? []).map((c, idx) => (
                    <TableRow
                      key={c.campaign_id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5 text-sm">
                        <span
                          className="block truncate font-medium text-foreground"
                          title={c.campaign_name ?? ""}
                        >
                          {c.campaign_name ?? "—"}
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
        </CardContent>
      </Card>
    </PageShell>
  );
}
