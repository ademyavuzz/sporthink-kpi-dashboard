import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OrderDetailDialog } from "@/components/feature/OrderDetailDialog";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartErrorBoundary } from "@/components/feature/charts/ChartErrorBoundary";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { EcommerceFilters } from "@/components/feature/filters/EcommerceFilters";
import {
  emptyEcomFilter,
  type EcomFilterValue,
} from "@/components/feature/filters/ecomFilter";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
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
  const [filters, setFilters] = useState<EcomFilterValue>(emptyEcomFilter);
  const [orderDialog, setOrderDialog] = useState<{
    open: boolean;
    orderPkId: number | null;
  }>({ open: false, orderPkId: null });

  const q = useQuery({
    queryKey: [
      "dashboard",
      "ecom",
      range.date_from,
      range.date_to,
      filters,
    ],
    queryFn: () =>
      dashboardApi.ecom({
        date_from: range.date_from,
        date_to: range.date_to,
        categories: filters.categories.length ? filters.categories : undefined,
        brands: filters.brands.length ? filters.brands : undefined,
        statuses: filters.statuses.length ? filters.statuses : undefined,
        payment_methods: filters.payment_methods.length
          ? filters.payment_methods
          : undefined,
        segment_id: filters.segment_id,
        orders_limit: 50,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  return (
    <PageShell>
      <DashboardHeader title={t("ecom.title")} range={range} onChangeRange={setRange} />

      <div className="rounded-xl border border-border/60 bg-surface px-3 py-2.5">
        <EcommerceFilters value={filters} onChange={setFilters} />
      </div>

      {/* KPI cards (6) ------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.revenue} compact />
                <KPICard kpi={data.orders} compact />
                <KPICard kpi={data.items_sold} compact />
                <KPICard kpi={data.aov} compact />
                <KPICard kpi={data.refund_rate} compact />
                <KPICard kpi={data.repeat_purchase_rate} compact />
              </>
            )}
      </div>

      {/* Revenue trend (area, daily) ---------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("ecom.trend_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartErrorBoundary>
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
          </ChartErrorBoundary>
        </CardContent>
      </Card>

      {/* Donuts: category × device ------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("ecom.by_category_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartErrorBoundary>
              <DonutChart
                loading={isLoading}
                labels={
                  data
                    ? data.by_category.map(
                        (c) => c.label ?? t("ecom.label_unknown"),
                      )
                    : []
                }
                values={
                  data
                    ? data.by_category.map((c) => toNumber(c.value) ?? 0)
                    : []
                }
                valueFormatter={formatCurrency}
                totalLabel={t("ecom.total_revenue")}
              />
            </ChartErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("ecom.by_device_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartErrorBoundary>
              <DonutChart
                loading={isLoading}
                labels={
                  data
                    ? data.by_device.map((d) =>
                        d.label
                          ? t(`ecom.device_${d.label}`, {
                              defaultValue: d.label,
                            })
                          : t("ecom.label_unknown"),
                      )
                    : []
                }
                values={
                  data ? data.by_device.map((d) => toNumber(d.value) ?? 0) : []
                }
                valueFormatter={formatCurrency}
                totalLabel={t("ecom.total_revenue")}
              />
            </ChartErrorBoundary>
          </CardContent>
        </Card>
      </div>

      {/* City horizontal bar + payment donut -------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("ecom.by_city_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartErrorBoundary>
              <BarChart
                loading={isLoading}
                horizontal
                categories={
                  data ? data.by_city.map((c) => c.label ?? "—") : []
                }
                series={[
                  {
                    name: t("ecom.series_revenue"),
                    data: data
                      ? data.by_city.map((c) => toNumber(c.value) ?? 0)
                      : [],
                  },
                ]}
                valueFormatter={formatAxisCurrency}
              />
            </ChartErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("ecom.by_payment_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartErrorBoundary>
              <DonutChart
                loading={isLoading}
                labels={
                  data
                    ? data.by_payment_method.map((p) =>
                        p.label
                          ? t(`ecom.payment_${p.label}`, {
                              defaultValue: p.label,
                            })
                          : t("ecom.label_unknown"),
                      )
                    : []
                }
                values={
                  data
                    ? data.by_payment_method.map((p) => toNumber(p.value) ?? 0)
                    : []
                }
                valueFormatter={formatCurrency}
                totalLabel={t("ecom.total_revenue")}
              />
            </ChartErrorBoundary>
          </CardContent>
        </Card>
      </div>

      {/* New vs Returning grouped bar (revenue + orders yan yana) ----- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("ecom.new_vs_returning_card_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                {t("ecom.series_revenue")}
              </p>
              <ChartErrorBoundary height={260}>
                <BarChart
                  loading={isLoading}
                  categories={[
                    t("ecom.customer_new"),
                    t("ecom.customer_returning"),
                  ]}
                  series={[
                    {
                      name: t("ecom.series_revenue"),
                      data: data
                        ? [
                            toNumber(
                              data.new_vs_returning.find(
                                (c) => c.customer_type === "new",
                              )?.revenue ?? 0,
                            ) ?? 0,
                            toNumber(
                              data.new_vs_returning.find(
                                (c) => c.customer_type === "returning",
                              )?.revenue ?? 0,
                            ) ?? 0,
                          ]
                        : [],
                    },
                  ]}
                  valueFormatter={formatAxisCurrency}
                  showValueLabel
                  height={260}
                />
              </ChartErrorBoundary>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                {t("ecom.series_orders")}
              </p>
              <ChartErrorBoundary height={260}>
                <BarChart
                  loading={isLoading}
                  categories={[
                    t("ecom.customer_new"),
                    t("ecom.customer_returning"),
                  ]}
                  series={[
                    {
                      name: t("ecom.series_orders"),
                      data: data
                        ? [
                            data.new_vs_returning.find(
                              (c) => c.customer_type === "new",
                            )?.orders ?? 0,
                            data.new_vs_returning.find(
                              (c) => c.customer_type === "returning",
                            )?.orders ?? 0,
                          ]
                        : [],
                    },
                  ]}
                  valueFormatter={formatCount}
                  showValueLabel
                  height={260}
                />
              </ChartErrorBoundary>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top products table ------------------------------------------- */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t("ecom.top_products_card_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[140px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[100px]" />
                <col className="w-[140px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_sku")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_product")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_brand")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_units")}
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
                      <TableCell colSpan={5} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data?.top_products ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.top_products ?? []).map((p, idx) => (
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
                        {p.brand ?? <span className="text-text-dim">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right text-sm tabular-nums">
                        {formatCount(p.units_sold)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(p.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Orders list table -------------------------------------------- */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-baseline justify-between">
          <CardTitle>{t("ecom.orders_card_title")}</CardTitle>
          {data && (
            <span className="text-xs text-text-muted">
              {t("ecom.showing_n_of_total", {
                shown: data.orders_list.length,
                total: data.orders_total,
              })}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[140px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_order_id")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_date")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_customer")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_amount")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_status")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("ecom.col_payment")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data?.orders_list ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.orders_list ?? []).map((o, idx) => (
                    <TableRow
                      key={o.order_pk_id}
                      role="button"
                      onClick={() =>
                        setOrderDialog({
                          open: true,
                          orderPkId: o.order_pk_id,
                        })
                      }
                      className={cn(
                        "cursor-pointer border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5 font-mono text-xs text-text-muted">
                        {o.order_id}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-xs tabular-nums text-text-muted">
                        {dayjs(o.order_date).format("DD.MM.YYYY")}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm">
                        <span
                          className="block truncate"
                          title={o.customer_name ?? o.customer_id}
                        >
                          {o.customer_name ?? (
                            <span className="font-mono text-xs text-text-muted">
                              {o.customer_id}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(o.net_revenue)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-xs">
                        <StatusPill status={o.order_status} />
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-xs text-text-muted">
                        {t(`ecom.payment_${o.payment_method}`, {
                          defaultValue: o.payment_method,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <OrderDetailDialog
        open={orderDialog.open}
        orderPkId={orderDialog.orderPkId}
        onOpenChange={(open) =>
          setOrderDialog((prev) => ({ ...prev, open }))
        }
      />
    </PageShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation("dashboard");
  const tone: Record<string, string> = {
    completed: "bg-success/10 text-success",
    shipped: "bg-info/10 text-info",
    pending: "bg-warning/10 text-warning",
    cancelled: "bg-muted text-text-muted",
    refunded: "bg-error/10 text-error",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone[status] ?? "bg-muted text-text-muted",
      )}
    >
      {t(`ecom.status_${status}`, { defaultValue: status })}
    </span>
  );
}
