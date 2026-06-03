import { useQuery } from "@tanstack/react-query";
import { MapPin, Package, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  DateRangePicker,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import {
  MetricToggles,
  type MetricOption,
} from "@/components/feature/charts/MetricToggles";
import { TurkeyMap } from "@/components/feature/charts/TurkeyMap";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import {
  ColumnSettingsMenu,
  ManagedColumnHeader,
  type SortAccessors,
  useSortedRows,
} from "@/components/feature/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { CHART_PALETTE } from "@/hooks/useChartTheme";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
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
import type { ComparisonMode } from "@/stores/useFiltersStore";
import { useFiltersStore } from "@/stores/useFiltersStore";
import type { TopProductRow } from "@/types/dashboard";

import { PageShell } from "./_shared";

/** Görsel hizalama için tüm analiz grafiklerinin ortak yüksekliği. */
const ANALYSIS_CHART_HEIGHT = 300;

/* ──────────────────────────────────────────────────────────────── */
/* Top ürünler tablosu — kolon tanımları (ChannelAnalysisPage deseni). */

interface TopProductColumn extends ColumnDef {
  /** colgroup genişliği. */
  width: string;
  /** Sağa hizalı sayısal kolon mu? */
  numeric?: boolean;
  /** Bir satır için hücre içeriği (idx = sıralama numarası). */
  cell: (row: TopProductRow, idx: number, maxRevenue: number) => ReactNode;
  /** Dışa aktarmada kullanılacak ham hücre değeri (formatsız). */
  exportValue: (row: TopProductRow, idx: number) => string | number | null;
}

const TOP_PRODUCT_COLUMNS: TopProductColumn[] = [
  {
    id: "rank",
    labelKey: "overview.table_rank",
    required: true,
    width: "w-[56px]",
    cell: (_row, idx) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {idx + 1}
      </span>
    ),
    exportValue: (_row, idx) => idx + 1,
  },
  {
    id: "sku",
    labelKey: "overview.table_sku",
    width: "w-[140px]",
    cell: (p) => <span className="font-mono text-xs text-text-muted">{p.sku}</span>,
    exportValue: (p) => p.sku,
  },
  {
    id: "product",
    labelKey: "overview.table_product",
    width: "",
    cell: (p) => (
      <span
        className="block truncate font-medium text-foreground"
        title={p.product_name ?? ""}
      >
        {p.product_name ?? "—"}
      </span>
    ),
    exportValue: (p) => p.product_name,
  },
  {
    id: "brand",
    labelKey: "overview.table_brand",
    width: "w-[150px]",
    cell: (p) =>
      p.brand ? (
        <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-text-muted">
          {p.brand}
        </span>
      ) : (
        <span className="text-text-dim">—</span>
      ),
    exportValue: (p) => p.brand,
  },
  {
    id: "units",
    labelKey: "overview.table_units",
    width: "w-[100px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm">{formatCount(p.units_sold)}</span>
    ),
    exportValue: (p) => p.units_sold,
  },
  {
    id: "revenue",
    labelKey: "overview.table_revenue",
    width: "w-[200px]",
    numeric: true,
    cell: (p, _idx, maxRevenue) => {
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

/**
 * Top ürünler — siralanabilir kolonlarin ham deger cikaricilari. Para/yuzde
 * string'leri `toNumber` ile sayisallastirilir; "rank" yapisal kolon oldugu
 * icin haric tutulur (siralama display sirasini takip eder).
 */
const TOP_PRODUCT_SORT_ACCESSORS: SortAccessors<TopProductRow> = {
  sku: (p) => p.sku,
  product: (p) => p.product_name,
  brand: (p) => p.brand,
  units: (p) => p.units_sold,
  revenue: (p) => toNumber(p.revenue),
};

/**
 * Genel Özet — profesyonel analitik dashboard.
 *
 * Filtre & cross-filter:
 *  - Tarih + karşılaştırma: sayfa-local state.
 *  - Kanal/Cihaz: `useFiltersStore` (cross-page) → backend cross-filter.
 *    Backend `/overview` yalnızca channels + devices kabul eder; bu yüzden
 *    GlobalFilterBar bu iki alanla sınırlıdır (işe yaramayan filtre yok).
 *  - Kanal donut'una tıkla → o kanala filtre; Türkiye haritasında şehre tıkla
 *    → şehir vurgulanır + global store'a yazılır (diğer sayfalara taşınır).
 *
 * Layout zonları: Filtre → KPI (3 hero + 6 destek) → Harita →
 * Kanal·Ürün·Funnel·Müşteri → Trend → Top ürünler (kolon yönetimi + export).
 */
export default function OverviewPage() {
  const { t } = useTranslation("dashboard");

  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2025-03-01",
    date_to: "2025-03-31",
  }));
  const [comparison, setComparison] = useState<ComparisonMode>("sequential");
  const [trendMetrics, setTrendMetrics] = useState<string[]>([
    "revenue",
    "orders",
  ]);

  const channels = useFiltersStore((s) => s.selected_channels);
  const devices = useFiltersStore((s) => s.selected_devices);
  const cities = useFiltersStore((s) => s.selected_cities);
  const setSelectedChannels = useFiltersStore((s) => s.setSelectedChannels);
  const toggleCity = useFiltersStore((s) => s.toggleCity);

  const query = useQuery({
    queryKey: [
      "dashboard",
      "overview",
      range.date_from,
      range.date_to,
      comparison,
      channels,
      devices,
    ],
    queryFn: () =>
      dashboardApi.overview({
        date_from: range.date_from,
        date_to: range.date_to,
        comparison_mode: comparison,
        channels: channels.length ? channels : undefined,
        devices: devices.length ? devices : undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = query.data;
  const isLoading = query.isPending;
  const selectedChannel = channels[0] ?? null;
  const selectedCity = cities[0] ?? null;

  const channelLabels = useMemo(
    () =>
      data?.channels.map((c) => c.channel ?? t("overview.channel_other")) ?? [],
    [data, t],
  );
  const channelValues = useMemo(
    () => data?.channels.map((c) => toNumber(c.revenue) ?? 0) ?? [],
    [data],
  );
  const geo = useMemo(
    () =>
      data?.geo.map((g) => ({
        city: g.city,
        revenue: toNumber(g.revenue) ?? 0,
        orders: g.orders,
      })) ?? [],
    [data],
  );
  // Trend metrikleri — id'li seri tanimi. Kullanici MetricToggles ile
  // hangilerini gorecegini secer; en az 1 metrik secili kalir.
  const trendAllSeries = useMemo(
    () =>
      data
        ? [
            {
              id: "revenue",
              name: t("overview.series_revenue"),
              color: "#e94560",
              data: data.daily_series.map((p) => ({
                x: dayjs(p.date).valueOf(),
                y: toNumber(p.revenue) ?? 0,
              })),
              formatter: formatCurrency,
            },
            {
              id: "orders",
              name: t("overview.series_orders"),
              color: "#2563eb",
              data: data.daily_series.map((p) => ({
                x: dayjs(p.date).valueOf(),
                y: p.orders,
              })),
              formatter: formatCount,
            },
          ]
        : [],
    [data, t],
  );
  const trendOptions = useMemo<MetricOption[]>(
    () => trendAllSeries.map((s) => ({ id: s.id, label: s.name, color: s.color })),
    [trendAllSeries],
  );
  const trendVisibleSeries = useMemo(
    () => trendAllSeries.filter((s) => trendMetrics.includes(s.id)),
    [trendAllSeries, trendMetrics],
  );

  // En çok satan ürünlerin adet payı — donut için. Adet bazlı: ciro
  // (line_total) toplam ciroyla bire bir örtüşmediği için satış adedi
  // kullanılır. Sıfır satışlılar dışlanır; küçük dilimleri DonutChart gruplar.
  const prod = useMemo(
    () =>
      (data?.top_products ?? [])
        .map((p) => ({
          label: p.product_name?.trim() || p.sku,
          value: p.units_sold,
        }))
        .filter((x) => x.value > 0),
    [data],
  );
  const prodLabels = useMemo(() => prod.map((x) => x.label), [prod]);
  const prodValues = useMemo(() => prod.map((x) => x.value), [prod]);

  /** Donut slice / legend tıklama → kanal cross-filter. */
  const handleChannelClick = (label: string | null) => {
    if (!label || label === t("overview.channel_other")) {
      setSelectedChannels([]);
      return;
    }
    setSelectedChannels(selectedChannel === label ? [] : [label]);
  };

  return (
    <PageShell>
      {/* ─── Filtre zonu (sticky) ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <PageHeader
          title={t("overview.title")}
          subtitle={t("overview.subtitle_vs_prev")}
        />
        <GlobalFilterBar
          fields={["channels", "devices"]}
          trailing={
            <>
              <ComparisonToggle value={comparison} onChange={setComparison} />
              <DateRangePicker value={range} onChange={setRange} />
            </>
          }
        />
      </div>

      {/* ─── KPI: 3 hero ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
        {isLoading || !data ? (
          <>
            <KPICardSkeleton hero />
            <KPICardSkeleton hero />
            <KPICardSkeleton hero />
          </>
        ) : (
          <>
            <KPICard kpi={data.summary.revenue} hero />
            <KPICard kpi={data.summary.orders} hero />
            <KPICard kpi={data.summary.roas} hero />
          </>
        )}
      </div>

      {/* ─── KPI: 6 destek ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-6">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <KPICardSkeleton key={i} compact />
          ))
        ) : (
          <>
            <KPICard kpi={data.summary.sessions} compact />
            <KPICard kpi={data.summary.users} compact />
            <KPICard kpi={data.summary.conversion_rate} compact />
            <KPICard kpi={data.summary.aov} compact />
            <KPICard kpi={data.summary.bounce_rate} compact />
            <KPICard kpi={data.summary.ad_spend} compact />
          </>
        )}
      </div>

      {/* ─── Şehir haritası ───────────────────────────────────────── */}
      <ChartCard
        title={t("overview.geo_card_title")}
        hint={t("overview.geo_card_hint")}
        icon={MapPin}
      >
        <TurkeyMap
          data={geo}
          loading={isLoading}
          selectedCity={selectedCity}
          onCityClick={toggleCity}
        />
      </ChartCard>

      {/* ─── Analiz: Kanal · Ürün payı · Funnel · Yeni-Tekrarlayan ── */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("overview.channel_card_title")}
          hint={t("overview.channel_card_hint")}
          className="h-full self-stretch"
        >
          <DonutChart
            loading={isLoading}
            height={ANALYSIS_CHART_HEIGHT}
            labels={channelLabels}
            values={channelValues}
            valueFormatter={formatCurrency}
            onSliceClick={handleChannelClick}
            selectedLabel={selectedChannel}
          />
        </ChartCard>

        <ChartCard
          title={t("overview.product_share_card_title")}
          hint={t("overview.product_share_hint")}
          icon={Package}
          className="h-full self-stretch"
        >
          <DonutChart
            loading={isLoading}
            height={ANALYSIS_CHART_HEIGHT}
            labels={prodLabels}
            values={prodValues}
            valueFormatter={formatCount}
            totalLabel={t("overview.product_share_center")}
          />
        </ChartCard>

        <ChartCard
          title={t("overview.funnel_card_title")}
          hint={t("overview.funnel_card_hint")}
          className="h-full self-stretch"
        >
          <div
            className="flex flex-col justify-center"
            style={{ minHeight: ANALYSIS_CHART_HEIGHT }}
          >
            <FunnelChart steps={data?.funnel ?? []} loading={isLoading} />
          </div>
        </ChartCard>

        <NewVsReturningCard
          data={data?.new_vs_returning ?? []}
          loading={isLoading}
        />
      </div>

      {/* ─── Ciro & Sipariş trendi ────────────────────────────────── */}
      <ChartCard
        title={t("overview.trend_card_title")}
        icon={TrendingUp}
        action={
          data ? (
            <MetricToggles
              options={trendOptions}
              selected={trendMetrics}
              onChange={setTrendMetrics}
            />
          ) : undefined
        }
      >
        <LineChart
          loading={isLoading}
          multiAxis
          showLegend={false}
          series={trendVisibleSeries}
          yFormatter={formatAxisCurrency}
        />
      </ChartCard>

      {/* ─── Top ürünler ──────────────────────────────────────────── */}
      <TopProductsCard
        products={data?.top_products ?? []}
        loading={isLoading}
        dateFrom={range.date_from}
        dateTo={range.date_to}
      />
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════ */

function ComparisonToggle({
  value,
  onChange,
}: {
  value: ComparisonMode;
  onChange: (m: ComparisonMode) => void;
}) {
  const { t } = useTranslation("dashboard");
  const opts: { id: ComparisonMode; label: string }[] = [
    { id: "sequential", label: t("overview.cmp_sequential") },
    { id: "yoy", label: t("overview.cmp_yoy") },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

interface FunnelStepData {
  step: string;
  label_tr: string;
  count: number;
  drop_from_previous_pct: string | null;
}

/** Daralan funnel — her adım orantılı genişlikte bir bar; adımlar arası
 *  düşüş yüzdesi ve genel dönüşüm altta. */
function FunnelChart({
  steps,
  loading,
}: {
  steps: FunnelStepData[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const max = useMemo(() => Math.max(...steps.map((s) => s.count), 1), [steps]);
  const overall = useMemo(() => {
    const first = steps[0];
    const last = steps[steps.length - 1];
    if (!first || !last || first.count === 0) return null;
    return (last.count / first.count) * 100;
  }, [steps]);

  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {steps.map((s, idx) => {
          const pct = (s.count / max) * 100;
          const stepLabel = t(`funnel.steps.${s.step}`, {
            defaultValue: s.label_tr,
          });
          return (
            <div key={s.step}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-foreground">{stepLabel}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatCount(s.count)}
                  </span>
                  {s.drop_from_previous_pct !== null && (
                    <span className="rounded bg-error-50 px-1.5 py-0.5 text-[11px] font-semibold text-error-700 dark:bg-error-500/10 dark:text-error-500">
                      ↓ {formatPercent(s.drop_from_previous_pct, 1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-8 overflow-hidden rounded-md bg-muted/40">
                <div
                  className={cn(
                    "h-full rounded-md transition-all duration-500",
                    idx === steps.length - 1
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-primary to-primary/70",
                  )}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {overall !== null && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
          <span className="text-sm font-medium text-text-muted">
            {t("overview.funnel_overall")}
          </span>
          <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {overall.toFixed(2).replace(".", ",")}%
          </span>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

/**
 * En çok satan ürünler — kolon yönetimi (göster/gizle + sürükle-sırala) ve
 * CSV/XLSX export. Export edilen veri ekrandaki görünür kolonlarla birebir
 * aynıdır (ChannelAnalysisPage deseni).
 */
function TopProductsCard({
  products,
  loading,
  dateFrom,
  dateTo,
}: {
  products: TopProductRow[];
  loading?: boolean;
  dateFrom: string;
  dateTo: string;
}) {
  const { t } = useTranslation("dashboard");
  const columns = useColumnManager("overview-top-products-table", TOP_PRODUCT_COLUMNS);

  // Kolon basligi siralamasi — render ve export ayni sirali veriyi kullanir.
  // Siralama yokken (sortColumnId=null) backend sirasi korunur.
  const sortedProducts = useSortedRows(
    products,
    TOP_PRODUCT_SORT_ACCESSORS,
    columns.sortColumnId,
    columns.sortDir,
  );

  const maxRevenue = useMemo(
    () => Math.max(...products.map((p) => toNumber(p.revenue) ?? 0), 1),
    [products],
  );

  // Export, ekrandaki görünür kolonların ham değerini taşır (sirali + filtreli
  // veri). idx, sirali display sirasidir; "rank" kolonu bunu yansitir.
  const exportColumns = useMemo(
    () =>
      columns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (row: TopProductRow) =>
          col.exportValue(row, sortedProducts.indexOf(row)),
      })),
    [columns.visibleColumns, sortedProducts, t],
  );

  return (
    <ChartCard
      title={t("overview.top_products_card_title")}
      icon={Package}
      contentClassName="p-0"
      action={
        <div className="flex items-center gap-2">
          <ExportMenu
            rows={sortedProducts}
            columns={exportColumns}
            fileBase="top-products"
            dateFrom={dateFrom}
            dateTo={dateTo}
            sheetName={t("overview.top_products_card_title")}
          />
          <ColumnSettingsMenu manager={columns} ns="dashboard" />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <Table className="table-fixed">
          <colgroup>
            {columns.visibleColumns.map((col) => (
              <col key={col.id} className={col.width || undefined} />
            ))}
          </colgroup>
          <ManagedColumnHeader
            manager={columns}
            ns="dashboard"
            isSortable={(col) => col.id !== "rank"}
            headClassName={(col) => (col.numeric ? "text-right" : undefined)}
          />
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell
                    colSpan={columns.visibleColumns.length}
                    className="px-4 py-3.5"
                  >
                    <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                  </TableCell>
                </TableRow>
              ))
            ) : sortedProducts.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.visibleColumns.length}
                  className="px-4 py-12 text-center"
                >
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-text-muted">
                    <Package className="size-6 text-text-dim" />
                    <p className="text-sm font-semibold text-foreground">
                      {t("overview.top_products_empty_title")}
                    </p>
                    <p className="text-xs">
                      {t("overview.top_products_empty_body")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((p, idx) => (
                <TableRow
                  key={p.sku}
                  className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                >
                  {columns.visibleColumns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn("px-3 py-3.5", col.numeric && "text-right")}
                    >
                      {col.cell(p, idx, maxRevenue)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}

/* ──────────────────────────────────────────────────────────────── */

interface NvrRow {
  customer_type: "new" | "returning";
  revenue: string;
  orders: number;
}

/**
 * Yeni vs Tekrarlayan müşteri — ciro dağılımı.
 *
 * Segment renkleri DonutChart ile aynı palet sırasını korur (yeni = palette[0],
 * tekrarlayan = palette[1]) — diğer grafiklerle görsel tutarlılık.
 *
 * Empty / tek-segment durumları:
 *  - İki segment de 0 (ör. dönemde realize sipariş yok) → boş durum mesajı.
 *  - Bir segment 0, diğeri dolu (ör. ilk-sipariş tarihleri seçili dönemden
 *    önce; "Yeni müşteri %0 / Tekrarlayan %100") → bu BACKEND'in dönem-bağımlı
 *    doğru sonucudur. Donut'un tek dolu halka + "0,0%" satırı görseli "bozuk"
 *    durduğu için burada orantılı bir split-bar + segment kırılımı (ciro,
 *    sipariş adedi, yüzde) gösterilir; 0 olan segment soluk/boş kalır ve "0
 *    sipariş · %0,0" satırı kendiliğinden "bu dönemde yeni müşteri yok"u anlatır.
 */
function NewVsReturningCard({
  data,
  loading,
}: {
  data: NvrRow[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const newRow = data.find((d) => d.customer_type === "new");
  const retRow = data.find((d) => d.customer_type === "returning");
  const newRev = toNumber(newRow?.revenue ?? null) ?? 0;
  const retRev = toNumber(retRow?.revenue ?? null) ?? 0;
  const total = newRev + retRev;

  const segments = [
    {
      key: "new",
      label: t("overview.nvr_new"),
      revenue: newRev,
      orders: newRow?.orders ?? 0,
      color: CHART_PALETTE[0]!,
    },
    {
      key: "returning",
      label: t("overview.nvr_returning"),
      revenue: retRev,
      orders: retRow?.orders ?? 0,
      color: CHART_PALETTE[1]!,
    },
  ];

  return (
    <ChartCard
      title={t("overview.nvr_card_title")}
      hint={t("overview.nvr_card_hint")}
      icon={Users}
      className="h-full self-stretch"
    >
      <div
        className="flex flex-col"
        style={{ minHeight: ANALYSIS_CHART_HEIGHT }}
      >
        {loading ? (
          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="h-4 w-full animate-pulse rounded-full bg-muted/40" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : total === 0 ? (
          // İki segment de 0 — anlamlı boş durum.
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-text-muted">
            <Users className="size-6 text-text-dim" />
            <p className="max-w-xs text-sm">{t("overview.nvr_card_hint")}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-5">
            {/* Toplam ciro */}
            <div>
              <p className="text-xs font-medium text-text-muted">
                {t("overview.nvr_total")}
              </p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(total)}
              </p>
            </div>

            {/* Orantılı split bar — 0 olan segment boş/soluk kalır. */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
              {segments.map((s) => {
                const pct = (s.revenue / total) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={s.key}
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                );
              })}
            </div>

            {/* Segment kırılımı — ciro, sipariş adedi ve yüzde. */}
            <ul className="space-y-2.5" role="list">
              {segments.map((s) => {
                const pct = total > 0 ? (s.revenue / total) * 100 : 0;
                const isEmpty = s.revenue === 0;
                return (
                  <li
                    key={s.key}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2.5 transition-opacity",
                      isEmpty && "opacity-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.label}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {formatCount(s.orders)} {t("overview.nvr_orders")}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(s.revenue)}
                      </span>
                      <span className="text-xs tabular-nums text-text-muted">
                        {pct.toFixed(1).replace(".", ",")}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
