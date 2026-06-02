import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
  CreditCard,
  Layers,
  MapPin,
  Package,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { OrderDetailDialog } from "@/components/feature/OrderDetailDialog";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartErrorBoundary } from "@/components/feature/charts/ChartErrorBoundary";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
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
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFiltersStore } from "@/stores/useFiltersStore";
import type {
  OrderListRow,
  TopCustomerRow,
  TopProductRow,
} from "@/types/dashboard";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/** Top urun tablosu satir-render baglami (siralama + bar genisligi icin). */
interface TopProductCtx {
  index: number;
  maxRevenue: number;
}

interface TopProductColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: TopProductRow, ctx: TopProductCtx) => ReactNode;
  /** Disa aktarmada kullanilacak ham hucre degeri (formatsiz). */
  exportValue: (row: TopProductRow, ctx: TopProductCtx) => string | number | null;
}

const TOP_PRODUCT_COLUMNS: TopProductColumn[] = [
  {
    id: "rank",
    labelKey: "ecom.col_rank",
    required: true,
    width: "w-[52px]",
    cell: (_p, { index }) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          index < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {index + 1}
      </span>
    ),
    exportValue: (_p, { index }) => index + 1,
  },
  {
    id: "sku",
    labelKey: "ecom.col_sku",
    width: "w-[132px]",
    cell: (p) => (
      <span className="font-mono text-xs text-text-muted">{p.sku}</span>
    ),
    exportValue: (p) => p.sku,
  },
  {
    id: "product",
    labelKey: "ecom.col_product",
    width: "",
    cell: (p) => (
      <span
        className="block truncate text-sm font-medium text-foreground"
        title={p.product_name ?? ""}
      >
        {p.product_name ?? "-"}
      </span>
    ),
    exportValue: (p) => p.product_name,
  },
  {
    id: "brand",
    labelKey: "ecom.col_brand",
    width: "w-[150px]",
    cell: (p) =>
      p.brand ? (
        <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-text-muted">
          {p.brand}
        </span>
      ) : (
        <span className="text-text-dim">-</span>
      ),
    exportValue: (p) => p.brand,
  },
  {
    id: "units",
    labelKey: "ecom.col_units",
    width: "w-[100px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm">{formatCount(p.units_sold)}</span>
    ),
    exportValue: (p) => p.units_sold,
  },
  {
    id: "revenue",
    labelKey: "ecom.col_revenue",
    width: "w-[200px]",
    numeric: true,
    cell: (p, { maxRevenue }) => {
      const rev = toNumber(p.revenue) ?? 0;
      const barPct = (rev / maxRevenue) * 100;
      return (
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
      );
    },
    exportValue: (p) => toNumber(p.revenue),
  },
];

interface OrderColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: OrderListRow, t: TFunction) => ReactNode;
  /** Disa aktarmada kullanilacak hucre degeri (gerektiginde t() ile cevrili). */
  exportValue: (row: OrderListRow, t: TFunction) => string | number | null;
}

const ORDER_COLUMNS: OrderColumn[] = [
  {
    id: "order_id",
    labelKey: "ecom.col_order_id",
    width: "w-[120px]",
    cell: (o) => (
      <span className="font-mono text-xs text-text-muted">{o.order_id}</span>
    ),
    exportValue: (o) => o.order_id,
  },
  {
    id: "date",
    labelKey: "ecom.col_date",
    width: "w-[110px]",
    cell: (o) => (
      <span className="text-xs tabular-nums text-text-muted">
        {dayjs(o.order_date).format("DD.MM.YYYY")}
      </span>
    ),
    exportValue: (o) => dayjs(o.order_date).format("DD.MM.YYYY"),
  },
  {
    id: "customer",
    labelKey: "ecom.col_customer",
    width: "",
    cell: (o) => (
      <span className="block truncate text-sm" title={o.customer_name ?? o.customer_id}>
        {o.customer_name ?? (
          <span className="font-mono text-xs text-text-muted">{o.customer_id}</span>
        )}
      </span>
    ),
    exportValue: (o) => o.customer_name ?? o.customer_id,
  },
  {
    id: "amount",
    labelKey: "ecom.col_amount",
    width: "w-[120px]",
    numeric: true,
    cell: (o) => (
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {formatCurrency(o.net_revenue)}
      </span>
    ),
    exportValue: (o) => toNumber(o.net_revenue),
  },
  {
    id: "status",
    labelKey: "ecom.col_status",
    width: "w-[120px]",
    cell: (o) => <StatusPill status={o.order_status} />,
    exportValue: (o, t) =>
      t(`ecom.status_${o.order_status}`, { defaultValue: o.order_status }),
  },
  {
    id: "payment",
    labelKey: "ecom.col_payment",
    width: "w-[140px]",
    cell: (o, t) => (
      <span className="text-xs text-text-muted">
        {t(`ecom.payment_${o.payment_method}`, { defaultValue: o.payment_method })}
      </span>
    ),
    exportValue: (o, t) =>
      t(`ecom.payment_${o.payment_method}`, { defaultValue: o.payment_method }),
  },
];

/** Top musteri tablosu satir-render baglami (siralama icin). */
interface TopCustomerCtx {
  index: number;
}

interface TopCustomerColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: TopCustomerRow, ctx: TopCustomerCtx, t: TFunction) => ReactNode;
  /** Disa aktarmada kullanilacak hucre degeri (gerektiginde t() ile cevrili). */
  exportValue: (
    row: TopCustomerRow,
    ctx: TopCustomerCtx,
    t: TFunction,
  ) => string | number | null;
}

/** Cinsiyet ham degerini lokalize eder (OrderDetailDialog ile tutarli). */
function genderLabel(gender: string | null, t: TFunction): string | null {
  if (!gender) return null;
  return t(`ecom.gender_${gender}`, { defaultValue: gender });
}

const TOP_CUSTOMER_COLUMNS: TopCustomerColumn[] = [
  {
    id: "rank",
    labelKey: "ecom.col_rank",
    required: true,
    width: "w-[52px]",
    cell: (_c, { index }) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          index < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {index + 1}
      </span>
    ),
    exportValue: (_c, { index }) => index + 1,
  },
  {
    id: "customer",
    labelKey: "ecom.col_customer",
    width: "",
    cell: (c) => (
      <span
        className="block truncate text-sm font-medium text-foreground"
        title={c.customer_name ?? c.customer_id}
      >
        {c.customer_name ?? (
          <span className="font-mono text-xs text-text-muted">{c.customer_id}</span>
        )}
      </span>
    ),
    exportValue: (c) => c.customer_name ?? c.customer_id,
  },
  {
    id: "customer_id",
    labelKey: "ecom.col_customer_id",
    width: "w-[132px]",
    cell: (c) => (
      <span className="font-mono text-xs text-text-muted">{c.customer_id}</span>
    ),
    exportValue: (c) => c.customer_id,
  },
  {
    id: "city",
    labelKey: "ecom.col_city",
    width: "w-[140px]",
    cell: (c) => (
      <span className="text-sm text-text-muted">{c.city ?? "-"}</span>
    ),
    exportValue: (c) => c.city,
  },
  {
    id: "gender",
    labelKey: "ecom.col_gender",
    width: "w-[110px]",
    cell: (c, _ctx, t) => (
      <span className="text-sm text-text-muted">
        {genderLabel(c.gender, t) ?? "-"}
      </span>
    ),
    exportValue: (c, _ctx, t) => genderLabel(c.gender, t),
  },
  {
    id: "age_group",
    labelKey: "ecom.col_age_group",
    width: "w-[110px]",
    cell: (c) => (
      <span className="text-sm text-text-muted">{c.age_group ?? "-"}</span>
    ),
    exportValue: (c) => c.age_group,
  },
  {
    id: "orders",
    labelKey: "ecom.col_orders",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatCount(c.order_count)}</span>
    ),
    exportValue: (c) => c.order_count,
  },
  {
    id: "revenue",
    labelKey: "ecom.col_revenue",
    width: "w-[140px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {formatCurrency(c.revenue)}
      </span>
    ),
    exportValue: (c) => toNumber(c.revenue),
  },
];

/**
 * E-Ticaret sayfasi. Filtreli (kategori/marka/durum/odeme) 6 KPI,
 * trend, kanal/kategori/cihaz/sehir/odeme kirilimleri, yeni-vs-tekrarlayan
 * karsilastirmasi, top urun, top musteri ve siparis tablolari.
 */
export default function EcommercePage() {
  const { t } = useTranslation("dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  useFilterUrlSync(searchParams, setSearchParams);

  const [range, setRange] = useDashboardRange();
  const [orderDialog, setOrderDialog] = useState<{
    open: boolean;
    orderPkId: number | null;
  }>({ open: false, orderPkId: null });

  const filters = useFiltersStore(
    useShallow((s) => ({
      categories: s.selected_categories,
      brands: s.selected_brands,
      statuses: s.selected_statuses,
      payment_methods: s.selected_payment_methods,
    })),
  );

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
  const topCustomers = useMemo(() => data?.top_customers ?? [], [data]);
  const ordersList = data?.orders_list ?? [];
  const maxProductRevenue = useMemo(
    () => Math.max(...topProducts.map((p) => toNumber(p.revenue) ?? 0), 1),
    [topProducts],
  );

  const productColumns = useColumnManager("ecom-top-products", TOP_PRODUCT_COLUMNS);
  const customerColumns = useColumnManager("ecom-top-customers", TOP_CUSTOMER_COLUMNS);
  const orderColumns = useColumnManager("ecom-orders", ORDER_COLUMNS);

  const productExportColumns = useMemo(
    () =>
      productColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (p: TopProductRow) =>
          col.exportValue(p, {
            index: topProducts.indexOf(p),
            maxRevenue: maxProductRevenue,
          }),
      })),
    [productColumns.visibleColumns, t, topProducts, maxProductRevenue],
  );

  const customerExportColumns = useMemo(
    () =>
      customerColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (c: TopCustomerRow) =>
          col.exportValue(c, { index: topCustomers.indexOf(c) }, t),
      })),
    [customerColumns.visibleColumns, t, topCustomers],
  );

  const orderExportColumns = useMemo(
    () =>
      orderColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (o: OrderListRow) => col.exportValue(o, t),
      })),
    [orderColumns.visibleColumns, t],
  );

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader title={t("ecom.title")} range={range} onChangeRange={setRange} />
        <GlobalFilterBar
          fields={["categories", "brands", "statuses", "payment_methods"]}
        />
      </div>

      {/* KPI kartlari */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-6">
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

      {/* Kanal bazli ciro */}
      <ChartCard
        title={t("ecom.by_channel_card_title")}
        hint={t("ecom.by_channel_hint")}
        icon={Layers}
      >
        <ChartErrorBoundary height={300}>
          <BarChart
            loading={isLoading}
            horizontal
            height={300}
            categories={
              data
                ? data.by_channel.map((c) => c.channel ?? t("ecom.label_unknown"))
                : []
            }
            series={[
              {
                name: t("ecom.series_revenue"),
                data: data
                  ? data.by_channel.map((c) => toNumber(c.revenue) ?? 0)
                  : [],
              },
            ]}
            valueFormatter={formatAxisCurrency}
          />
        </ChartErrorBoundary>
      </ChartCard>

      {/* Kategori + Cihaz */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("ecom.by_category_card_title")}
          hint={t("ecom.by_category_hint")}
          icon={Tag}
          className="h-full self-stretch"
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
          className="h-full self-stretch"
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
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("ecom.by_city_card_title")}
          hint={t("ecom.by_city_hint")}
          icon={MapPin}
          className="h-full self-stretch lg:col-span-2"
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
          className="h-full self-stretch"
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
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={topProducts}
              columns={productExportColumns}
              fileBase="ecom-top-products"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("ecom.top_products_card_title")}
            />
            <ColumnSettingsMenu manager={productColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {productColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width || undefined} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={productColumns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={productColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : topProducts.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={productColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("ecom.top_products_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                topProducts.map((p, idx) => (
                  <TableRow
                    key={p.sku}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {productColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(p, { index: idx, maxRevenue: maxProductRevenue })}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>

      {/* Top musteriler */}
      <ChartCard
        title={t("ecom.top_customers_card_title")}
        hint={t("ecom.top_customers_hint")}
        icon={Trophy}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={topCustomers}
              columns={customerExportColumns}
              fileBase="ecom-top-customers"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("ecom.top_customers_card_title")}
            />
            <ColumnSettingsMenu manager={customerColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {customerColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width || undefined} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={customerColumns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={customerColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : topCustomers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={customerColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("ecom.top_customers_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                topCustomers.map((c, idx) => (
                  <TableRow
                    key={c.customer_id}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {customerColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(c, { index: idx }, t)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
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
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-xs text-text-muted">
                {t("ecom.showing_n_of_total", {
                  shown: data.orders_list.length,
                  total: data.orders_total,
                })}
              </span>
            )}
            <ExportMenu
              rows={ordersList}
              columns={orderExportColumns}
              fileBase="orders"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("ecom.orders_card_title")}
            />
            <ColumnSettingsMenu manager={orderColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {orderColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width || undefined} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={orderColumns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={orderColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : ordersList.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={orderColumns.visibleColumns.length}
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
                    {orderColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(o, t)}
                      </TableCell>
                    ))}
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
