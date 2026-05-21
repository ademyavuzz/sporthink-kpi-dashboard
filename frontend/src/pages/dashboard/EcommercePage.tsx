import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  MapPin,
  Package,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
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

/**
 * E-Ticaret sayfasi. Filtreli (kategori/marka/durum/odeme) 6 KPI,
 * trend, kategori/cihaz/sehir/odeme kirilimleri, yeni-vs-tekrarlayan
 * karsilastirmasi, top urun ve siparis tablolari.
 */
export default function EcommercePage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const [filters, setFilters] = useState<EcomFilterValue>(emptyEcomFilter);
  const [orderDialog, setOrderDialog] = useState<{
    open: boolean;
    orderPkId: number | null;
  }>({ open: false, orderPkId: null });

  const q = useQuery({
    queryKey: ["dashboard", "ecom", range.date_from, range.date_to, filters],
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
        orders_limit: 50,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const topProducts = useMemo(() => data?.top_products ?? [], [data]);
  const ordersList = data?.orders_list ?? [];
  const maxProductRevenue = useMemo(
    () => Math.max(...topProducts.map((p) => toNumber(p.revenue) ?? 0), 1),
    [topProducts],
  );

  return (
    <PageShell>
      <DashboardHeader title={t("ecom.title")} range={range} onChangeRange={setRange} />

      <div className="sticky top-0 z-20 rounded-md border border-border/70 bg-card/90 px-3 py-2.5 shadow-theme-xs backdrop-blur">
        <EcommerceFilters value={filters} onChange={setFilters} />
      </div>

      {/* KPI kartlari */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {isLoading || !data
          ? Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} compact />)
          : (
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

      {/* Ciro & siparis trendi */}
      <ChartCard
        title={t("ecom.trend_card_title")}
        hint={t("ecom.trend_hint")}
        icon={TrendingUp}
      >
        <ChartErrorBoundary>
          <LineChart
            loading={isLoading}
            multiAxis
            series={
              data
                ? [
                    {
                      name: t("ecom.series_revenue"),
                      color: "#e94560",
                      data: data.daily_series.map((p) => ({
                        x: dayjs(p.date).valueOf(),
                        y: toNumber(p.revenue) ?? 0,
                      })),
                      formatter: formatCurrency,
                    },
                    {
                      name: t("ecom.series_orders"),
                      color: "#2563eb",
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
      </ChartCard>

      {/* Kategori + Cihaz */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("ecom.by_category_card_title")}
          hint={t("ecom.by_category_hint")}
          icon={Tag}
        >
          <ChartErrorBoundary>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.by_category.map((c) => c.label ?? t("ecom.label_unknown"))
                  : []
              }
              values={data ? data.by_category.map((c) => toNumber(c.value) ?? 0) : []}
              valueFormatter={formatCurrency}
              totalLabel={t("ecom.total_revenue")}
            />
          </ChartErrorBoundary>
        </ChartCard>

        <ChartCard
          title={t("ecom.by_device_card_title")}
          hint={t("ecom.by_device_hint")}
          icon={Smartphone}
        >
          <ChartErrorBoundary>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.by_device.map((d) =>
                      d.label
                        ? t(`ecom.device_${d.label}`, { defaultValue: d.label })
                        : t("ecom.label_unknown"),
                    )
                  : []
              }
              values={data ? data.by_device.map((d) => toNumber(d.value) ?? 0) : []}
              valueFormatter={formatCurrency}
              totalLabel={t("ecom.total_revenue")}
            />
          </ChartErrorBoundary>
        </ChartCard>
      </div>

      {/* Sehir + Odeme */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("ecom.by_city_card_title")}
          hint={t("ecom.by_city_hint")}
          icon={MapPin}
          className="lg:col-span-2"
        >
          <ChartErrorBoundary>
            <BarChart
              loading={isLoading}
              horizontal
              categories={data ? data.by_city.map((c) => c.label ?? "-") : []}
              series={[
                {
                  name: t("ecom.series_revenue"),
                  data: data ? data.by_city.map((c) => toNumber(c.value) ?? 0) : [],
                },
              ]}
              valueFormatter={formatAxisCurrency}
            />
          </ChartErrorBoundary>
        </ChartCard>

        <ChartCard
          title={t("ecom.by_payment_card_title")}
          hint={t("ecom.by_payment_hint")}
          icon={CreditCard}
        >
          <ChartErrorBoundary>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.by_payment_method.map((p) =>
                      p.label
                        ? t(`ecom.payment_${p.label}`, { defaultValue: p.label })
                        : t("ecom.label_unknown"),
                    )
                  : []
              }
              values={
                data ? data.by_payment_method.map((p) => toNumber(p.value) ?? 0) : []
              }
              valueFormatter={formatCurrency}
              totalLabel={t("ecom.total_revenue")}
            />
          </ChartErrorBoundary>
        </ChartCard>
      </div>

      {/* Yeni vs Tekrarlayan */}
      <ChartCard
        title={t("ecom.new_vs_returning_card_title")}
        hint={t("ecom.new_vs_returning_hint")}
        icon={Users}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
              {t("ecom.series_revenue")}
            </p>
            <ChartErrorBoundary height={260}>
              <BarChart
                loading={isLoading}
                categories={[t("ecom.customer_new"), t("ecom.customer_returning")]}
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
                categories={[t("ecom.customer_new"), t("ecom.customer_returning")]}
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
      </ChartCard>

      {/* Top urunler */}
      <ChartCard
        title={t("ecom.top_products_card_title")}
        hint={t("ecom.top_products_hint")}
        icon={Package}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[132px]" />
              <col />
              <col className="w-[150px]" />
              <col className="w-[100px]" />
              <col className="w-[200px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  #
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
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
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="px-4 py-3.5">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : topProducts.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("ecom.top_products_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                topProducts.map((p, idx) => {
                  const rev = toNumber(p.revenue) ?? 0;
                  const barPct = (rev / maxProductRevenue) * 100;
                  return (
                    <TableRow
                      key={p.sku}
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
                      <TableCell className="px-3 py-3.5 font-mono text-xs text-text-muted">
                        {p.sku}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm">
                        <span
                          className="block truncate font-medium text-foreground"
                          title={p.product_name ?? ""}
                        >
                          {p.product_name ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm">
                        {p.brand ? (
                          <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-text-muted">
                            {p.brand}
                          </span>
                        ) : (
                          <span className="text-text-dim">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                        {formatCount(p.units_sold)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted/50 sm:block">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${Math.max(barPct, 3)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-sm font-semibold text-foreground">
                            {formatCurrency(rev)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>

      {/* Siparis listesi */}
      <ChartCard
        title={t("ecom.orders_card_title")}
        hint={t("ecom.orders_hint")}
        icon={ShoppingCart}
        contentClassName="p-0"
        action={
          data ? (
            <span className="text-xs text-text-muted">
              {t("ecom.showing_n_of_total", {
                shown: data.orders_list.length,
                total: data.orders_total,
              })}
            </span>
          ) : undefined
        }
      >
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
              ) : ordersList.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("ecom.orders_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                ordersList.map((o) => (
                  <TableRow
                    key={o.order_pk_id}
                    role="button"
                    onClick={() =>
                      setOrderDialog({ open: true, orderPkId: o.order_pk_id })
                    }
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
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
      </ChartCard>

      <OrderDetailDialog
        open={orderDialog.open}
        orderPkId={orderDialog.orderPkId}
        onOpenChange={(open) => setOrderDialog((prev) => ({ ...prev, open }))}
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
