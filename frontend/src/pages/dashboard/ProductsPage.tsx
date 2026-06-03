import { useQuery } from "@tanstack/react-query";
import { Package, Tag, Trophy } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import {
  ColumnSettingsMenu,
  ManagedColumnHeader,
  type SortAccessors,
  useSortedRows,
} from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
import { dashboardApi } from "@/lib/api/dashboard";
import { formatAxisCurrency, formatCount, formatCurrency, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFiltersStore } from "@/stores/useFiltersStore";
import type { TopProductRow } from "@/types/dashboard";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Urun Performansi sayfasi. Satilan urun KPI'si, kategori/marka bazli ciro
 * kirilimleri ve en cok satan urunler tablosu (kolon yonetimi + siralama +
 * export).
 *
 * Filtre & cross-filter:
 *  - Tarih araligi: DashboardHeader (sayfa-local state).
 *  - Kategori/Marka: `useFiltersStore` (cross-page) → backend cross-filter.
 *    Backend `/dashboard/products` bu iki boyut filtresini destekledigi icin
 *    GlobalFilterBar bunlarla sinirlidir (ise yaramayan filtre yok).
 *  - Kategori/marka barina tikla → o degere filtre (tekrar tikla → kaldir);
 *    query otomatik refetch olur.
 */

/** En cok satan urunler tablosu kolon tanimlari (id = stabil localStorage anahtari). */
interface ProductColumn extends ColumnDef {
  /** Kolonun colgroup genisligi. */
  width: string;
  /** Saga hizali sayisal kolon mu? */
  numeric?: boolean;
  /** Tek satir icin hucre icerigini render eder (rank 1-bazli sira). */
  cell: (row: TopProductRow, rank: number, barPct: number) => ReactNode;
  /** Disa aktarmada kullanilacak ham hucre degeri (formatsiz). */
  exportValue: (row: TopProductRow, rank: number) => string | number | null;
}

const PRODUCT_COLUMNS: ProductColumn[] = [
  {
    id: "rank",
    labelKey: "products.col_rank",
    required: true,
    width: "w-[56px]",
    cell: (_p, rank) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          rank <= 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {rank}
      </span>
    ),
    exportValue: (_p, rank) => rank,
  },
  {
    id: "sku",
    labelKey: "products.col_sku",
    width: "w-[140px]",
    cell: (p) => (
      <span className="font-mono text-xs text-text-muted">{p.sku}</span>
    ),
    exportValue: (p) => p.sku,
  },
  {
    id: "product",
    labelKey: "products.col_product",
    required: true,
    width: "",
    cell: (p) => (
      <span
        className="block truncate font-medium text-foreground"
        title={p.product_name ?? ""}
      >
        {p.product_name ?? "-"}
      </span>
    ),
    exportValue: (p) => p.product_name,
  },
  {
    id: "brand",
    labelKey: "products.col_brand",
    width: "w-[160px]",
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
    labelKey: "products.col_units",
    width: "w-[100px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm">{formatCount(p.units_sold)}</span>
    ),
    exportValue: (p) => p.units_sold,
  },
  {
    id: "revenue",
    labelKey: "products.col_revenue",
    width: "w-[200px]",
    numeric: true,
    cell: (p, _rank, barPct) => (
      <div className="flex items-center justify-end gap-2">
        <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted/50 sm:block">
          <div
            className="h-full rounded-full bg-primary/70"
            style={{ width: `${Math.max(barPct, 3)}%` }}
          />
        </div>
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {formatCurrency(toNumber(p.revenue) ?? 0)}
        </span>
      </div>
    ),
    exportValue: (p) => toNumber(p.revenue),
  },
];

/**
 * Tablo siralamasi icin kolon id -> ham deger cikaricisi. `rank` yapisal
 * kolondur; siralanmaz (ManagedColumnHeader'da isSortable ile haric tutulur,
 * burada da yer almaz — sirayi zaten siralama belirler). Para string'i
 * toNumber ile sayiya cevrilir; metin kolonlari (sku, urun, marka) string
 * olarak gecer ve useSortedRows icinde tr-TR locale ile karsilastirilir.
 * NULL'lar daima sona.
 */
const PRODUCT_SORT_ACCESSORS: SortAccessors<TopProductRow> = {
  sku: (p) => p.sku,
  product: (p) => p.product_name,
  brand: (p) => p.brand,
  units: (p) => p.units_sold,
  revenue: (p) => toNumber(p.revenue),
};

export default function ProductsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

  const categories = useFiltersStore((s) => s.selected_categories);
  const brands = useFiltersStore((s) => s.selected_brands);
  const setSelectedCategories = useFiltersStore((s) => s.setSelectedCategories);
  const setSelectedBrands = useFiltersStore((s) => s.setSelectedBrands);

  const productColumns = useColumnManager("products-top-table", PRODUCT_COLUMNS);

  const q = useQuery({
    queryKey: [
      "dashboard",
      "products",
      range.date_from,
      range.date_to,
      categories,
      brands,
    ],
    queryFn: () =>
      dashboardApi.products({
        date_from: range.date_from,
        date_to: range.date_to,
        categories: categories.length ? categories : undefined,
        brands: brands.length ? brands : undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  const topProducts = useMemo(() => data?.top_products ?? [], [data]);
  const maxRevenue = useMemo(
    () => Math.max(...topProducts.map((p) => toNumber(p.revenue) ?? 0), 1),
    [topProducts],
  );

  // Render ve disa aktarmadan ONCE sirala. Varsayilan (sortColumnId=null)
  // backend sirasini korur.
  const sortedProducts = useSortedRows(
    topProducts,
    PRODUCT_SORT_ACCESSORS,
    productColumns.sortColumnId,
    productColumns.sortDir,
  );

  const productExportColumns = useMemo(
    () =>
      productColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (p: TopProductRow) =>
          col.exportValue(p, sortedProducts.indexOf(p) + 1),
      })),
    [productColumns.visibleColumns, sortedProducts, t],
  );

  /** Kategori barina tikla → kategori cross-filter (tekrar tikla → kaldir). */
  const handleCategoryClick = (label: string) => {
    setSelectedCategories(
      categories.length === 1 && categories[0] === label ? [] : [label],
    );
  };

  /** Marka barina tikla → marka cross-filter (tekrar tikla → kaldir). */
  const handleBrandClick = (label: string) => {
    setSelectedBrands(brands.length === 1 && brands[0] === label ? [] : [label]);
  };

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader
          title={t("products.title")}
          range={range}
          onChangeRange={setRange}
        />
        <GlobalFilterBar fields={["categories", "brands"]} showRanges />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 items-stretch gap-3 sm:max-w-xs">
        {isLoading || !data ? (
          <KPICardSkeleton hero />
        ) : (
          <KPICard kpi={data.items_sold} hero />
        )}
      </div>

      {/* Kategori + Marka */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("products.by_category_card_title")}
          hint={t("products.by_category_hint")}
          icon={Tag}
          className="h-full self-stretch"
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
            onSelect={handleCategoryClick}
          />
        </ChartCard>

        <ChartCard
          title={t("products.by_brand_card_title")}
          hint={t("products.by_brand_hint")}
          icon={Package}
          className="h-full self-stretch"
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
            onSelect={handleBrandClick}
          />
        </ChartCard>
      </div>

      {/* En cok satan urunler */}
      <ChartCard
        title={t("products.top_products_card_title")}
        hint={t("products.top_products_hint")}
        icon={Trophy}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={sortedProducts}
              columns={productExportColumns}
              fileBase="products-top"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("products.top_products_card_title")}
            />
            <ColumnSettingsMenu manager={productColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {productColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={productColumns}
              ns="dashboard"
              isSortable={(col) => col.id !== "rank"}
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={productColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedProducts.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={productColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("products.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedProducts.map((p, i) => {
                  const rev = toNumber(p.revenue) ?? 0;
                  const barPct = (rev / maxRevenue) * 100;
                  return (
                    <TableRow
                      key={p.sku}
                      className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                    >
                      {productColumns.visibleColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={cn("px-3 py-3.5", col.numeric && "text-right")}
                        >
                          {col.cell(p, i + 1, barPct)}
                        </TableCell>
                      ))}
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
