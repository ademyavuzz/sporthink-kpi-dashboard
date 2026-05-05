import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ExecutiveSummaryBanner } from "@/components/feature/ExecutiveSummaryBanner";
import {
  DateRangePicker,
  computePresetRange,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { PageHeader } from "@/components/layout/PageHeader";
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
import type { DailySeriesPoint } from "@/types/dashboard";

import { PageShell } from "./_shared";

/**
 * Genel Özet — yöneticilerin 30 saniyede dönemi anlamasını sağlayan sayfa.
 *
 * Akış:
 * 1. Yönetici Özeti (anlatım + öne çıkanlar / dikkat)
 * 2. 3 hero KPI (Gelir / Sipariş / ROAS) — sparkline + delta
 * 3. 6 secondary KPI (AOV, Dönüşüm, Bounce, Oturum, Kullanıcı, Reklam Harcaması)
 * 4. Trend chart (tepe/dip/ortalama annotation) + Kanal donut + top 3 detay
 * 5. Funnel (genel dönüşüm + en zayıf adım vurgusu) + Yeni vs Tekrarlayan
 * 6. Top 10 ürün (marka konsantrasyon insight'ı + tablo)
 *
 * Default tarih: son 30 gün — karşılaştırma KPI'ları doluşunca her metrikte
 * delta görünür. Dummy data Ekim 2024 - Mart 2025 arasında, dev demolarda
 * "Tüm dönem" preset'i tercih edilebilir.
 */
export default function OverviewPage() {
  const { t } = useTranslation("dashboard");
  // Dev'de dummy data 2024-10..2025-03 arasında; demo'larda boş ekran
  // görmemek için default veriyle dolu son 30 günü hard-code ediyoruz.
  // Production'da `computePresetRange("last_30")` ile bugünden geriye 30 gün.
  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2025-03-01",
    date_to: "2025-03-31",
  }));

  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.overview({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = overviewQuery.data;
  const isLoading = overviewQuery.isPending;

  // Sparkline'lar için günlük seri'den son N noktaya kadar daralt.
  const sparklines = useMemo(() => {
    if (!data) return null;
    const series = data.daily_series ?? [];
    return {
      revenue: series.map((p) => toNumber(p.revenue) ?? 0),
      orders: series.map((p) => p.orders),
      sessions: series.map((p) => p.sessions),
      spend: series.map((p) => toNumber(p.spend) ?? 0),
    };
  }, [data]);

  // Top 3 kanal — gelir bazlı
  const topChannels = useMemo(() => {
    if (!data) return [];
    const total = data.channels.reduce(
      (s, c) => s + (toNumber(c.revenue) ?? 0),
      0,
    );
    return data.channels.slice(0, 3).map((c) => {
      const rev = toNumber(c.revenue) ?? 0;
      return {
        channel: c.channel,
        revenue: c.revenue,
        orders: c.orders,
        sessions: c.sessions,
        sharePct: total > 0 ? (rev / total) * 100 : null,
      };
    });
  }, [data]);

  return (
    <PageShell>
      <PageHeader
        title={t("overview.title")}
        subtitle={`${dayjs(range.date_from).format("DD.MM.YYYY")} – ${dayjs(range.date_to).format("DD.MM.YYYY")} · ${t("overview.subtitle_compared_to_prev")}`}
        actions={
          <>
            <PresetButton
              active={range.preset === "last_30"}
              onClick={() =>
                setRange({ preset: "last_30", ...computePresetRange("last_30") })
              }
            >
              {t("overview.preset_last_30")}
            </PresetButton>
            <PresetButton
              active={range.preset === "last_90"}
              onClick={() =>
                setRange({ preset: "last_90", ...computePresetRange("last_90") })
              }
            >
              {t("overview.preset_last_90")}
            </PresetButton>
            <PresetButton
              active={
                range.preset === "custom" &&
                range.date_from === "2024-10-01" &&
                range.date_to === "2025-03-31"
              }
              onClick={() =>
                setRange({
                  preset: "custom",
                  date_from: "2024-10-01",
                  date_to: "2025-03-31",
                })
              }
            >
              {t("overview.preset_all")}
            </PresetButton>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />

      {/* 1) Executive Summary */}
      <ExecutiveSummaryBanner summary={data?.summary} loading={isLoading} />

      {/* 2) Hero KPI'lar — Gelir / Sipariş / ROAS */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {isLoading || !data ? (
          <>
            <KPICardSkeleton hero />
            <KPICardSkeleton hero />
            <KPICardSkeleton hero />
          </>
        ) : (
          <>
            <KPICard
              kpi={data.summary.revenue}
              hero
              sparkline={sparklines?.revenue}
            />
            <KPICard
              kpi={data.summary.orders}
              hero
              sparkline={sparklines?.orders}
            />
            <KPICard kpi={data.summary.roas} hero />
          </>
        )}
      </div>

      {/* 3) Secondary KPI'lar — verimlilik + trafik */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <KPICardSkeleton key={i} compact />
          ))
        ) : (
          <>
            <KPICard kpi={data.summary.aov} compact />
            <KPICard kpi={data.summary.conversion_rate} compact />
            <KPICard kpi={data.summary.bounce_rate} compact />
            <KPICard
              kpi={data.summary.sessions}
              compact
              sparkline={sparklines?.sessions}
            />
            <KPICard kpi={data.summary.users} compact />
            <KPICard
              kpi={data.summary.ad_spend}
              compact
              sparkline={sparklines?.spend}
            />
          </>
        )}
      </div>

      {/* 4) Trend chart + Channel breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("overview.trend_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendInsight points={data?.daily_series ?? []} loading={isLoading} />
            <LineChart
              loading={isLoading}
              multiAxis
              series={
                data
                  ? [
                      {
                        name: t("overview.series_revenue"),
                        data: data.daily_series.map((p) => ({
                          x: dayjs(p.date).valueOf(),
                          y: toNumber(p.revenue) ?? 0,
                        })),
                        formatter: formatCurrency,
                      },
                      {
                        name: t("overview.series_orders"),
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

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.channel_card_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.channels.map(
                      (c) => c.channel ?? t("overview.channel_other"),
                    )
                  : []
              }
              values={
                data ? data.channels.map((c) => toNumber(c.revenue) ?? 0) : []
              }
              valueFormatter={formatCurrency}
              height={220}
            />
            {!isLoading && topChannels.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                  {t("overview.channel_top")}
                </h4>
                <ul className="space-y-1.5">
                  {topChannels.map((c, idx) => (
                    <li
                      key={c.channel ?? idx}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            idx === 0
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-text-muted",
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span className="truncate text-foreground">
                          {c.channel ?? t("overview.channel_other")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="font-semibold text-foreground">
                          {formatCurrency(c.revenue)}
                        </span>
                        {c.sharePct !== null && (
                          <span className="text-[11px] text-text-muted">
                            %{c.sharePct.toFixed(1).replace(".", ",")}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5) Funnel + New vs Returning */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.funnel_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelInsight steps={data?.funnel ?? []} loading={isLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview.new_returning_card_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.new_vs_returning.map((c) =>
                      c.customer_type === "new"
                        ? t("overview.customer_new")
                        : t("overview.customer_returning"),
                    )
                  : []
              }
              values={
                data
                  ? data.new_vs_returning.map((c) => toNumber(c.revenue) ?? 0)
                  : []
              }
              valueFormatter={formatCurrency}
              totalLabel={t("overview.new_returning_center_label")}
              height={220}
            />
            {!isLoading && data && (
              <NewReturningInsight items={data.new_vs_returning} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6) Top products */}
      <TopProductsCard
        products={data?.top_products ?? []}
        loading={isLoading}
      />
    </PageShell>
  );
}

/* ----------------------------------------------------------------------- */
/* Trend insight strip — peak/trough/average chips above the line chart    */
/* ----------------------------------------------------------------------- */

function TrendInsight({
  points,
  loading,
}: {
  points: DailySeriesPoint[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const insight = useMemo(() => {
    if (!points || points.length === 0) return null;
    const series = points.map((p) => ({
      date: p.date,
      revenue: toNumber(p.revenue) ?? 0,
    }));
    const sum = series.reduce((s, p) => s + p.revenue, 0);
    const avg = sum / series.length;
    let peak = series[0];
    let trough = series[0];
    for (const p of series) {
      if (p.revenue > peak.revenue) peak = p;
      if (p.revenue < trough.revenue) trough = p;
    }
    return { peak, trough, avg };
  }, [points]);

  if (loading || !insight) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <Chip
        label={t("overview.trend_peak")}
        valueText={formatCurrency(insight.peak.revenue)}
        sub={dayjs(insight.peak.date).format("DD.MM.YYYY")}
        tone="positive"
      />
      <Chip
        label={t("overview.trend_trough")}
        valueText={formatCurrency(insight.trough.revenue)}
        sub={dayjs(insight.trough.date).format("DD.MM.YYYY")}
        tone="muted"
      />
      <Chip
        label={t("overview.trend_avg")}
        valueText={formatCurrency(insight.avg)}
        tone="neutral"
      />
    </div>
  );
}

function Chip({
  label,
  valueText,
  sub,
  tone,
}: {
  label: string;
  valueText: string;
  sub?: string;
  tone: "positive" | "muted" | "neutral";
}) {
  const toneClasses =
    tone === "positive"
      ? "border-success-100 bg-success-50/50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500"
      : tone === "muted"
        ? "border-error-100 bg-error-50/40 text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500"
        : "border-border bg-surface-2/40 text-text-muted";
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 text-xs",
        toneClasses,
      )}
    >
      <span className="font-semibold uppercase tracking-wider text-[10px]">
        {label}
      </span>
      <span className="font-bold tabular-nums">{valueText}</span>
      {sub && <span className="text-[10px] opacity-70">{sub}</span>}
    </span>
  );
}

/* ----------------------------------------------------------------------- */
/* Funnel — 4 step bars + overall conversion + weakest step badge          */
/* ----------------------------------------------------------------------- */

interface FunnelStepView {
  step: string;
  label_tr: string;
  count: number;
  drop_from_previous_pct: string | null;
}

function FunnelInsight({
  steps,
  loading,
}: {
  steps: FunnelStepView[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const max = useMemo(
    () => Math.max(...steps.map((s) => s.count), 1),
    [steps],
  );

  // En zayıf geçiş = en yüksek drop_from_previous_pct
  const weakestStep = useMemo(() => {
    let worst: FunnelStepView | null = null;
    let worstDrop = -Infinity;
    for (const s of steps) {
      const d = toNumber(s.drop_from_previous_pct);
      if (d !== null && d > worstDrop) {
        worst = s;
        worstDrop = d;
      }
    }
    return worst;
  }, [steps]);

  // Genel dönüşüm = son adım / ilk adım
  const overall = useMemo(() => {
    if (steps.length < 2 || steps[0].count === 0) return null;
    return (steps[steps.length - 1].count / steps[0].count) * 100;
  }, [steps]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {steps.map((s) => {
          const pct = (s.count / max) * 100;
          const drop = s.drop_from_previous_pct;
          const stepLabel = t(`funnel.steps.${s.step}`, {
            defaultValue: s.label_tr,
          });
          const isWeakest =
            weakestStep !== null && weakestStep.step === s.step;
          return (
            <div key={s.step} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  {stepLabel}
                  {isWeakest && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-error-600 dark:bg-error-500/15 dark:text-error-500">
                      <TrendingDown className="size-2.5" />
                      {t("overview.funnel_weakest_step")}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCount(s.count)}
                  </span>
                  {drop !== null && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-error-600 dark:text-error-500">
                      ↓ {formatPercent(drop, 1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-muted/40">
                <div
                  className={cn(
                    "h-full rounded-md transition-all",
                    isWeakest ? "bg-error-500/80" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {overall !== null && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold text-text-muted">
            {t("overview.funnel_overall_conversion")}
          </span>
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {overall.toFixed(2).replace(".", ",")}%
          </span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* New vs Returning — qualitative insight under the donut                  */
/* ----------------------------------------------------------------------- */

function NewReturningInsight({
  items,
}: {
  items: { customer_type: "new" | "returning"; revenue: string; orders: number }[];
}) {
  const { t } = useTranslation("dashboard");
  const newRev = toNumber(
    items.find((c) => c.customer_type === "new")?.revenue ?? "0",
  ) ?? 0;
  const retRev = toNumber(
    items.find((c) => c.customer_type === "returning")?.revenue ?? "0",
  ) ?? 0;
  const total = newRev + retRev;
  if (total === 0) return null;
  const retPct = (retRev / total) * 100;

  let insightKey: string;
  let Icon: typeof TrendingUp;
  if (retPct >= 65) {
    insightKey = "overview.new_returning_insight_loyal";
    Icon = TrendingUp;
  } else if (retPct <= 35) {
    insightKey = "overview.new_returning_insight_acquisition";
    Icon = TrendingUp;
  } else {
    insightKey = "overview.new_returning_insight_balanced";
    Icon = TrendingUp;
  }

  return (
    <div className="flex items-center gap-2 rounded-md border-l-2 border-primary bg-surface-2/40 px-3 py-2 text-sm">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="text-foreground">
        <span className="font-semibold">{t(insightKey)}</span>
        <span className="ml-1 text-text-muted">
          ({t("overview.customer_returning")}: %{retPct.toFixed(0)})
        </span>
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Top products card — concentration insight + table                        */
/* ----------------------------------------------------------------------- */

interface TopProductRow {
  sku: string;
  product_name: string | null;
  brand: string | null;
  units_sold: number;
  revenue: string;
}

function TopProductsCard({
  products,
  loading,
}: {
  products: TopProductRow[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");

  const insight = useMemo(() => {
    if (products.length === 0) return null;
    const total = products.reduce((s, p) => s + (toNumber(p.revenue) ?? 0), 0);
    const byBrand = new Map<string, number>();
    for (const p of products) {
      const b = p.brand ?? "—";
      byBrand.set(b, (byBrand.get(b) ?? 0) + (toNumber(p.revenue) ?? 0));
    }
    const top3Brands = [...byBrand.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const top3Sum = top3Brands.reduce((s, [, v]) => s + v, 0);
    const concentrationPct = total > 0 ? (top3Sum / total) * 100 : 0;
    let volumeLeader = products[0];
    let revenueLeader = products[0];
    for (const p of products) {
      if (p.units_sold > volumeLeader.units_sold) volumeLeader = p;
      const r = toNumber(p.revenue) ?? 0;
      if (r > (toNumber(revenueLeader.revenue) ?? 0)) revenueLeader = p;
    }
    return {
      concentrationPct,
      top3Brands,
      volumeLeader,
      revenueLeader,
    };
  }, [products]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{t("overview.top_products_card_title")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!loading && insight && (
          <div className="grid gap-3 border-b border-border bg-surface-2/30 p-4 md:grid-cols-3">
            <InsightTile
              label={t("overview.top_products_concentration", {
                pct: insight.concentrationPct.toFixed(0),
              })}
              chips={insight.top3Brands.map(([b]) => b)}
            />
            <InsightTile
              label={t("overview.top_products_volume_leader")}
              valueText={`${formatCount(insight.volumeLeader.units_sold)} adet`}
              sub={insight.volumeLeader.product_name ?? "—"}
            />
            <InsightTile
              label={t("overview.top_products_revenue_leader")}
              valueText={formatCurrency(insight.revenueLeader.revenue)}
              sub={insight.revenueLeader.product_name ?? "—"}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[140px]" />
              <col />
              <col className="w-[160px]" />
              <col className="w-[110px]" />
              <col className="w-[140px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
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
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                : products.map((p, idx) => (
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
                  ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightTile({
  label,
  valueText,
  sub,
  chips,
}: {
  label: string;
  valueText?: string;
  sub?: string;
  chips?: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
        {label}
      </p>
      {valueText && (
        <p className="mt-1 text-base font-bold tabular-nums text-foreground">
          {valueText}
        </p>
      )}
      {sub && (
        <p className="mt-0.5 truncate text-xs text-text-muted" title={sub}>
          {sub}
        </p>
      )}
      {chips && chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface PresetButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

function PresetButton({ children, onClick, active }: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition-colors",
        active
          ? "border-primary/40 bg-primary/[0.08] text-primary"
          : "border-border bg-surface text-text-muted hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
