import { useQuery } from "@tanstack/react-query";
import { Package, Tag, Trophy } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardApi } from "@/lib/api/dashboard";
import {
  formatAxisCurrency,
  formatCount,
  formatCurrency,
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Urun Performansi sayfasi. Satilan urun KPI'si, kategori/marka bazli ciro
 * kirilimleri ve en cok satan urunler tablosu.
 */
export default function ProductsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "products", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.products({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const topProducts = data?.top_products ?? [];
  const maxRevenue = useMemo(
    () => Math.max(...topProducts.map((p) => toNumber(p.revenue) ?? 0), 1),
    [topProducts],
  );

  return (
    <PageShell>
      <DashboardHeader title={t("products.title")} range={range} onChangeRange={setRange} />

      <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
        {isLoading || !data ? (
          <KPICardSkeleton hero />
        ) : (
          <KPICard kpi={data.items_sold} hero />
        )}
      </div>

      {/* Kategori + Marka */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("products.by_category_card_title")}
          hint={t("products.by_category_hint")}
          icon={Tag}
        >
          <BarChart
            loading={isLoading}
            horizontal
            height={420}
            categories={data ? data.by_category.map((c) => c.label ?? "-") : []}
            series={
              data
                ? [
                    {
                      name: t("products.series_revenue"),
                      data: data.by_category.map((c) => toNumber(c.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={formatAxisCurrency}
          />
        </ChartCard>

        <ChartCard
          title={t("products.by_brand_card_title")}
          hint={t("products.by_brand_hint")}
          icon={Package}
        >
          <BarChart
            loading={isLoading}
            horizontal
            height={420}
            categories={data ? data.by_brand.map((b) => b.label ?? "-") : []}
            series={
              data
                ? [
                    {
                      name: t("products.series_revenue"),
                      data: data.by_brand.map((b) => toNumber(b.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={formatAxisCurrency}
          />
        </ChartCard>
      </div>

      {/* En cok satan urunler */}
      <ChartCard
        title={t("products.top_products_card_title")}
        hint={t("products.top_products_hint")}
        icon={Trophy}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[56px]" />
              <col className="w-[140px]" />
              <col />
              <col className="w-[160px]" />
              <col className="w-[100px]" />
              <col className="w-[200px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  #
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("products.col_sku")}
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("products.col_product")}
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("products.col_brand")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("products.col_units")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("products.col_revenue")}
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
              ) : topProducts.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("products.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                topProducts.map((p, i) => {
                  const rev = toNumber(p.revenue) ?? 0;
                  const barPct = (rev / maxRevenue) * 100;
                  return (
                    <TableRow
                      key={p.sku}
                      className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                    >
                      <TableCell className="px-3 py-3.5">
                        <span
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
                            i < 3
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-text-muted",
                          )}
                        >
                          {i + 1}
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
    </PageShell>
  );
}
