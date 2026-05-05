import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { DonutChart } from "@/components/feature/charts/DonutChart";
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
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

export default function EcommercePage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "ecom", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.ecom({ date_from: range.date_from, date_to: range.date_to }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  return (
    <PageShell>
      <DashboardHeader title={t("ecom.title")} range={range} onChangeRange={setRange} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.revenue} compact />
                <KPICard kpi={data.orders} compact />
                <KPICard kpi={data.aov} compact />
                <KPICard kpi={data.items_sold} compact />
                <KPICard kpi={data.refund_rate} compact />
                <KPICard kpi={data.repeat_purchase_rate} compact />
                <KPICard kpi={data.revenue_per_user} compact />
              </>
            )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("ecom.trend_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            loading={isLoading}
            multiAxis
            series={
              data
                ? [
                    {
                      name: t("ecom.series_revenue"),
                      data: data.daily_series.map((p) => ({
                        x: dayjs(p.date).valueOf(),
                        y: toNumber(p.revenue) ?? 0,
                      })),
                      formatter: formatCurrency,
                    },
                    {
                      name: t("ecom.series_orders"),
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("ecom.by_channel_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.by_channel.map(
                      (c) => c.channel ?? t("overview.channel_other"),
                    )
                  : []
              }
              values={
                data ? data.by_channel.map((c) => toNumber(c.revenue) ?? 0) : []
              }
              valueFormatter={formatCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("ecom.new_vs_returning_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.new_vs_returning.map((c) =>
                      c.customer_type === "new"
                        ? t("ecom.customer_new")
                        : t("ecom.customer_returning"),
                    )
                  : []
              }
              values={
                data
                  ? data.new_vs_returning.map((c) => toNumber(c.revenue) ?? 0)
                  : []
              }
              valueFormatter={formatCurrency}
              totalLabel={t("ecom.total_revenue")}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t("ecom.top_customers_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[140px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[140px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_customer_id")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_name")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_city")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_gender")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_age_group")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_orders")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_revenue")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data?.top_customers ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.top_customers ?? []).map((c, idx) => (
                    <TableRow
                      key={c.customer_id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5 font-mono text-xs text-text-muted">
                        {c.customer_id}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm">
                        <span
                          className="block truncate font-medium text-foreground"
                          title={c.customer_name ?? ""}
                        >
                          {c.customer_name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                        {c.city ?? <span className="text-text-dim">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                        {c.gender ?? <span className="text-text-dim">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                        {c.age_group ?? (
                          <span className="text-text-dim">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                        {formatCount(c.order_count)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                        {formatCurrency(c.revenue)}
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
