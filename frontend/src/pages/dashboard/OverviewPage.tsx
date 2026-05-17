import { useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DateRangePicker,
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

import { PageShell } from "./_shared";
import { SectionHeader } from "./SectionHeader";

/**
 * Overview Page — bölümlü analitik dashboard.
 *
 * Yapı (`docs/07` §7'deki "biraz biraz her şey" prensibine göre):
 *  1. Önemli Göstergeler  (3 hero KPI: Ciro / Sipariş / ROAS)
 *  2. Pazarlama           (4 KPI + trend chart + kanal donut)
 *  3. E-Ticaret           (3 KPI + funnel)
 *  4. Müşteri             (1 KPI + new vs returning donut)
 *  5. Ürün & İçgörüler    (insight strip + top 10 tablo)
 *
 * Tek `/dashboard/overview` çağrısı tüm verileri besliyor — paralel istek
 * yok, performans için 5dk staleTime cache.
 *
 * Default tarih: dummy data'nın son ayı (Mart 2025).
 */
export default function OverviewPage() {
  const { t } = useTranslation("dashboard");
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

  return (
    <PageShell>
      <PageHeader
        title={t("overview.title")}
        subtitle={t("overview.subtitle_vs_prev")}
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 1: HERO — 3 büyük KPI                            */}
      {/* ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={Sparkles}
          title={t("overview.section_hero_title")}
          subtitle={t("overview.section_hero_subtitle")}
          tone="primary"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {isLoading ? (
            <>
              <KPICardSkeleton hero />
              <KPICardSkeleton hero />
              <KPICardSkeleton hero />
            </>
          ) : data ? (
            <>
              <KPICard kpi={data.summary.revenue} hero />
              <KPICard kpi={data.summary.orders} hero />
              <KPICard kpi={data.summary.roas} hero />
            </>
          ) : null}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 2: PAZARLAMA                                     */}
      {/* ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={Megaphone}
          title={t("overview.section_marketing_title")}
          subtitle={t("overview.section_marketing_subtitle")}
          tone="violet"
        />
        {/* 4 KPI */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <KPICardSkeleton key={i} compact />
            ))
          ) : data ? (
            <>
              <KPICard kpi={data.summary.sessions} compact />
              <KPICard kpi={data.summary.users} compact />
              <KPICard kpi={data.summary.bounce_rate} compact />
              <KPICard kpi={data.summary.ad_spend} compact />
            </>
          ) : null}
        </div>
        {/* Trend (2/3) + Kanal donut (1/3) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("overview.trend_card_title")}</CardTitle>
            </CardHeader>
            <CardContent>
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
                          color: "#0ea5e9",
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
            <CardContent>
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
                  data
                    ? data.channels.map((c) => toNumber(c.revenue) ?? 0)
                    : []
                }
                valueFormatter={formatCurrency}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 3: E-TİCARET                                     */}
      {/* ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={ShoppingCart}
          title={t("overview.section_ecom_title")}
          subtitle={t("overview.section_ecom_subtitle")}
          tone="emerald"
        />
        {/* 2 KPI */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {isLoading ? (
            <>
              <KPICardSkeleton compact />
              <KPICardSkeleton compact />
            </>
          ) : data ? (
            <>
              <KPICard kpi={data.summary.aov} compact />
              <KPICard kpi={data.summary.conversion_rate} compact />
            </>
          ) : null}
        </div>
        {/* Funnel — full-width (geniş ekranda yine kart içinde) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.funnel_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelTable steps={data?.funnel ?? []} loading={isLoading} />
          </CardContent>
        </Card>
      </section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 4: MÜŞTERİ                                       */}
      {/* ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={Users}
          title={t("overview.section_customer_title")}
          subtitle={t("overview.section_customer_subtitle")}
          tone="blue"
        />
        <Card>
          <CardHeader>
            <CardTitle>{t("overview.new_returning_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
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
              totalLabel={t("overview.new_returning_center")}
            />
          </CardContent>
        </Card>
      </section>

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 5: ÜRÜN & İÇGÖRÜLER                              */}
      {/* ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          icon={Package}
          title={t("overview.section_product_title")}
          subtitle={t("overview.section_product_subtitle")}
          tone="amber"
        />
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{t("overview.top_products_card_title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!isLoading && data && data.top_products.length > 0 && (
              <TopProductsInsightStrip products={data.top_products} />
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
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5} className="px-4 py-3.5">
                          <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.top_products ?? []).length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="px-4 py-12 text-center">
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
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                          {formatCount(p.units_sold)}
                        </TableCell>
                        <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
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
      </section>
    </PageShell>
  );
}

function FunnelTable({
  steps,
  loading,
}: {
  steps: {
    step: string;
    label_tr: string;
    count: number;
    drop_from_previous_pct: string | null;
  }[];
  loading?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const max = useMemo(() => Math.max(...steps.map((s) => s.count), 1), [steps]);
  // Genel dönüşüm: ilk adım (görüntüleme) → son adım (satın alma) yüzdesi.
  const overallConversion = useMemo(() => {
    const first = steps[0];
    const last = steps[steps.length - 1];
    if (!first || !last || first.count === 0) return null;
    return (last.count / first.count) * 100;
  }, [steps]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {steps.map((s) => {
          const pct = (s.count / max) * 100;
          const drop = s.drop_from_previous_pct;
          const stepLabel = t(`funnel.steps.${s.step}`, {
            defaultValue: s.label_tr,
          });
          return (
            <div key={s.step} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-foreground">
                  {stepLabel}
                </span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-medium text-foreground">
                    {formatCount(s.count)}
                  </span>
                  {drop !== null && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-error-600 dark:text-error-500">
                      ↓ {formatPercent(drop, 1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-muted/40">
                <div
                  className="h-full rounded-md bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {overallConversion !== null && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold text-text-muted">
            {t("overview.funnel_overall")}
          </span>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {overallConversion.toFixed(2).replace(".", ",")}%
          </span>
        </div>
      )}
    </div>
  );
}

interface TopProduct {
  sku: string;
  product_name: string | null;
  brand: string | null;
  units_sold: number;
  revenue: string;
}

/**
 * Tablonun üzerine yerleşen 3 mini insight tile — backend'e ek çağrı atmadan
 * `top_products` verisinden türetilir.
 */
function TopProductsInsightStrip({ products }: { products: TopProduct[] }) {
  const { t } = useTranslation("dashboard");

  const insight = useMemo(() => {
    const totalRevenue = products.reduce(
      (s, p) => s + (toNumber(p.revenue) ?? 0),
      0,
    );
    const byBrand = new Map<string, number>();
    for (const p of products) {
      const b = p.brand ?? "—";
      byBrand.set(b, (byBrand.get(b) ?? 0) + (toNumber(p.revenue) ?? 0));
    }
    const top3Brands = [...byBrand.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const top3Sum = top3Brands.reduce((s, [, v]) => s + v, 0);
    const concentrationPct = totalRevenue > 0 ? (top3Sum / totalRevenue) * 100 : 0;
    let volumeLeader: TopProduct | null = products[0] ?? null;
    let revenueLeader: TopProduct | null = products[0] ?? null;
    for (const p of products) {
      if (volumeLeader && p.units_sold > volumeLeader.units_sold) volumeLeader = p;
      const r = toNumber(p.revenue) ?? 0;
      if (revenueLeader && r > (toNumber(revenueLeader.revenue) ?? 0)) revenueLeader = p;
    }
    return {
      concentrationPct,
      top3Brands: top3Brands.map(([b]) => b),
      volumeLeader,
      revenueLeader,
    };
  }, [products]);

  return (
    <div className="grid gap-3 border-b border-border bg-surface-2/30 p-4 md:grid-cols-3">
      <InsightTile
        label={`${t("overview.top_products_brand_concentration")} ${t(
          "overview.top_products_brand_share",
          { pct: insight.concentrationPct.toFixed(0) },
        )}`}
        chips={insight.top3Brands}
      />
      <InsightTile
        label={t("overview.top_products_volume_leader")}
        valueText={
          insight.volumeLeader ? formatCount(insight.volumeLeader.units_sold) : "—"
        }
        sub={insight.volumeLeader?.product_name ?? "—"}
      />
      <InsightTile
        label={t("overview.top_products_revenue_leader")}
        valueText={
          insight.revenueLeader ? formatCurrency(insight.revenueLeader.revenue) : "—"
        }
        sub={insight.revenueLeader?.product_name ?? "—"}
      />
    </div>
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
