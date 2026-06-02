import { useQuery } from "@tanstack/react-query";
import { MapPin, Package, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DateRangePicker,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { ChartCard } from "@/components/feature/ChartCard";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { TurkeyMap } from "@/components/feature/charts/TurkeyMap";
import { GlobalFilterBar } from "@/components/feature/filters/GlobalFilterBar";
import { PageHeader } from "@/components/layout/PageHeader";
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
import type { ComparisonMode } from "@/stores/useFiltersStore";
import { useFiltersStore } from "@/stores/useFiltersStore";

import { PageShell } from "./_shared";

/**
 * Genel Özet — profesyonel analitik dashboard.
 *
 * Filtre & cross-filter:
 *  - Tarih + karşılaştırma: sayfa-local state.
 *  - Kanal/Cihaz: `useFiltersStore` (cross-page) → backend cross-filter.
 *  - Kanal donut'una tıkla → o kanala filtre; Türkiye haritasında şehre tıkla
 *    → şehir vurgulanır + global store'a yazılır (diğer sayfalara taşınır).
 *
 * Layout zonları: Filtre → KPI (3 hero + 6 destek) → Trend+Kanal →
 * Harita+Funnel → Top ürünler.
 */
export default function OverviewPage() {
  const { t } = useTranslation("dashboard");

  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2025-03-01",
    date_to: "2025-03-31",
  }));
  const [comparison, setComparison] = useState<ComparisonMode>("sequential");

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
          trailing={
            <>
              <ComparisonToggle value={comparison} onChange={setComparison} />
              <DateRangePicker value={range} onChange={setRange} />
            </>
          }
        />
      </div>

      {/* ─── KPI: 3 hero ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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

      {/* ─── Kanal + Yeni vs Tekrarlayan + Funnel ─────────────────── */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("overview.channel_card_title")}
          hint={t("overview.channel_card_hint")}
          className="h-full self-stretch"
        >
          <DonutChart
            loading={isLoading}
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
          <FunnelChart steps={data?.funnel ?? []} loading={isLoading} />
        </ChartCard>
      </div>

      {/* ─── Yeni vs Tekrarlayan müşteri ──────────────────────────── */}
      <NewVsReturningCard data={data?.new_vs_returning ?? []} loading={isLoading} />

      {/* ─── Ciro & Sipariş trendi ────────────────────────────────── */}
      <ChartCard title={t("overview.trend_card_title")} icon={TrendingUp}>
        <LineChart
          loading={isLoading}
          multiAxis
          series={
            data
              ? [
                  {
                    name: t("overview.series_revenue"),
                    color: "#e94560",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: toNumber(p.revenue) ?? 0,
                    })),
                    formatter: formatCurrency,
                  },
                  {
                    name: t("overview.series_orders"),
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
      </ChartCard>

      {/* ─── Top ürünler ──────────────────────────────────────────── */}
      <TopProductsCard
        products={data?.top_products ?? []}
        loading={isLoading}
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

interface TopProduct {
  sku: string;
  product_name: string | null;
  brand: string | null;
  units_sold: number;
  revenue: string;
}

/** En çok satan ürünler — ciro hücresinde orantılı mini bar. */
function TopProductsCard({
  products,
  loading,
}: {
  products: TopProduct[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const maxRevenue = useMemo(
    () => Math.max(...products.map((p) => toNumber(p.revenue) ?? 0), 1),
    [products],
  );

  return (
    <ChartCard
      title={t("overview.top_products_card_title")}
      icon={Package}
      contentClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[56px]" />
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
                {t("overview.table_sku")}
              </TableHead>
              <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                {t("overview.table_product")}
              </TableHead>
              <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                {t("overview.table_brand")}
              </TableHead>
              <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                {t("overview.table_units")}
              </TableHead>
              <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                {t("overview.table_revenue")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="px-4 py-3.5">
                    <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                  </TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="px-4 py-12 text-center">
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
              products.map((p, idx) => {
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
                        {p.product_name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-sm">
                      {p.brand ? (
                        <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-text-muted">
                          {p.brand}
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
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
  );
}

/* ──────────────────────────────────────────────────────────────── */

interface NvrRow {
  customer_type: "new" | "returning";
  revenue: string;
  orders: number;
}

/** Yeni vs Tekrarlayan müşteri — ciro/sipariş dağılımı (oransal bar + bloklar). */
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
  const newPct = total > 0 ? (newRev / total) * 100 : 0;
  const retPct = total > 0 ? (retRev / total) * 100 : 0;

  const items = [
    {
      key: "new",
      color: "bg-primary",
      label: t("overview.nvr_new"),
      revenue: newRev,
      orders: newRow?.orders ?? 0,
      pct: newPct,
    },
    {
      key: "returning",
      color: "bg-sky-500",
      label: t("overview.nvr_returning"),
      revenue: retRev,
      orders: retRow?.orders ?? 0,
      pct: retPct,
    },
  ];

  return (
    <ChartCard
      title={t("overview.nvr_card_title")}
      hint={t("overview.nvr_card_hint")}
      icon={Users}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-4 w-full animate-pulse rounded-full bg-muted/40" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="bg-primary transition-all duration-500"
              style={{ width: `${newPct}%` }}
            />
            <div
              className="bg-sky-500 transition-all duration-500"
              style={{ width: `${retPct}%` }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <div
                key={it.key}
                className="rounded-lg border border-border/60 bg-surface-2/40 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className={cn("size-2.5 rounded-full", it.color)} />
                    {it.label}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-text-muted">
                    %{it.pct.toFixed(1).replace(".", ",")}
                  </span>
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {formatCurrency(it.revenue)}
                </div>
                <div className="mt-0.5 text-xs tabular-nums text-text-muted">
                  {formatCount(it.orders)} {t("overview.nvr_orders")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
