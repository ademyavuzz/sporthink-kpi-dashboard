import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Filter,
  Layers,
  ListChecks,
  ShoppingBag,
  Table2,
  TrendingDown,
} from "lucide-react";
import { useMemo } from "react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { LineChart } from "@/components/feature/charts/LineChart";
import {
  ColumnSettingsMenu,
  ManagedColumnHeader,
  type SortAccessors,
  useSortedRows,
} from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatPercent, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FunnelGroup } from "@/types/dashboard";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Funnel Analizi sayfasi. E-ticaret donusum hunisi (Goruntuleme to Satin Alma),
 * her adimin detay kartlari, gunluk terk (drop-off) trendi ve cihaz/kanal
 * bazli kirilim tablosu.
 *
 * NOT: `/dashboard/funnel` endpoint'i yalnizca tarih araligi kabul eder
 * (kanal/cihaz/sehir gibi filtre yok), bu yuzden bu sayfaya GlobalFilterBar
 * eklenmez — yalnizca tarih araligi ile filtrelenir.
 */

/** Cihaz + kanal kirilim tablosunda tek satir (bir FunnelGroup). */
interface FunnelBreakdownRow {
  /** Stabil satir kimligi (orn: "device:mobile"). */
  rowKey: string;
  /** Kirilim turu i18n key (cihaz / kanal). */
  dimensionKey: string;
  /** Grup etiketi (cevirili). */
  label: string;
  view: number;
  add_to_cart: number;
  checkout: number;
  purchase: number;
  /** Goruntulemeden satin almaya genel donusum (%) — null = veri yok. */
  conversion: number | null;
}

/** Tablo render'i icin cozulmus boyut etiketini iceren satir. */
interface ResolvedBreakdownRow extends FunnelBreakdownRow {
  dimensionLabel: string;
}

/** Kirilim tablosu kolon tanimi (ChannelAnalysisPage deseni). */
interface BreakdownColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: ResolvedBreakdownRow) => ReactNode;
  exportValue: (row: ResolvedBreakdownRow) => string | number | null;
}

const BREAKDOWN_COLUMNS: BreakdownColumn[] = [
  {
    id: "dimension",
    labelKey: "funnel.col_dimension",
    required: true,
    width: "w-[120px]",
    cell: (r) => (
      <span className="text-xs font-medium uppercase tracking-wider text-text-dim">
        {r.dimensionLabel}
      </span>
    ),
    exportValue: (r) => r.dimensionLabel,
  },
  {
    id: "segment",
    labelKey: "funnel.col_segment",
    required: true,
    width: "w-[160px]",
    cell: (r) => (
      <span className="text-sm font-semibold text-foreground">{r.label}</span>
    ),
    exportValue: (r) => r.label,
  },
  {
    id: "view",
    labelKey: "funnel.steps.view",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(r.view)}
      </span>
    ),
    exportValue: (r) => r.view,
  },
  {
    id: "add_to_cart",
    labelKey: "funnel.steps.add_to_cart",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(r.add_to_cart)}
      </span>
    ),
    exportValue: (r) => r.add_to_cart,
  },
  {
    id: "checkout",
    labelKey: "funnel.steps.checkout",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(r.checkout)}
      </span>
    ),
    exportValue: (r) => r.checkout,
  },
  {
    id: "purchase",
    labelKey: "funnel.steps.purchase",
    width: "w-[120px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {formatCount(r.purchase)}
      </span>
    ),
    exportValue: (r) => r.purchase,
  },
  {
    id: "conversion",
    labelKey: "funnel.col_conversion",
    width: "w-[130px]",
    numeric: true,
    cell: (r) => (
      <span className="tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        {r.conversion !== null ? formatPercent(r.conversion, 2) : "—"}
      </span>
    ),
    exportValue: (r) => r.conversion,
  },
];

/** Bir FunnelGroup'tan tablo satiri uretir (adim sayilari + donusum). */
function groupToRow(
  group: FunnelGroup,
  dimensionKey: "device" | "channel",
): FunnelBreakdownRow {
  const byStep = new Map(group.steps.map((s) => [s.step, s.count]));
  const view = byStep.get("view") ?? 0;
  const addToCart = byStep.get("add_to_cart") ?? 0;
  const checkout = byStep.get("checkout") ?? 0;
  const purchase = byStep.get("purchase") ?? 0;
  return {
    rowKey: `${dimensionKey}:${group.key}`,
    dimensionKey:
      dimensionKey === "device" ? "funnel.dim_device" : "funnel.dim_channel",
    label: group.label_tr,
    view,
    add_to_cart: addToCart,
    checkout,
    purchase,
    conversion: view > 0 ? (purchase / view) * 100 : null,
  };
}

interface SummaryStat {
  key: string;
  labelKey: string;
  value: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number | string }>;
  tone: "blue" | "primary" | "emerald" | "amber";
}

const STAT_TONES: Record<
  SummaryStat["tone"],
  { bg: string; fg: string; stripe: string }
> = {
  blue: {
    bg: "bg-sky-50 dark:bg-sky-500/15",
    fg: "text-sky-600 dark:text-sky-400",
    stripe: "bg-sky-500",
  },
  primary: {
    bg: "bg-primary/10 dark:bg-primary/15",
    fg: "text-primary",
    stripe: "bg-primary",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/15",
    fg: "text-emerald-600 dark:text-emerald-400",
    stripe: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/15",
    fg: "text-amber-600 dark:text-amber-400",
    stripe: "bg-amber-500",
  },
};

function SummaryStatCard({ stat }: { stat: SummaryStat }) {
  const { t } = useTranslation("dashboard");
  const Icon = stat.icon;
  const tone = STAT_TONES[stat.tone];
  return (
    <div className="group relative h-full overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/30">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-all duration-200 group-hover:inset-y-1",
          tone.stripe,
        )}
      />
      <div className="p-4 pl-5">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]",
              tone.bg,
            )}
          >
            <Icon className={cn("size-[18px]", tone.fg)} strokeWidth={2.2} />
          </span>
          <p className="min-w-0 flex-1 text-[12px] font-medium leading-[1.25] text-text-muted">
            {t(stat.labelKey)}
          </p>
        </div>
        <p className="mt-3 whitespace-nowrap text-[24px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {stat.value}
        </p>
      </div>
    </div>
  );
}

function SummaryStatSkeleton() {
  return (
    <div className="h-full rounded-xl border border-border bg-card p-4 pl-5">
      <div className="flex items-center gap-2.5">
        <div className="size-9 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="mt-3.5 h-6 w-28 animate-pulse rounded bg-muted/50" />
    </div>
  );
}

export default function FunnelPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

  const breakdownColumns = useColumnManager(
    "funnel-breakdown-table",
    BREAKDOWN_COLUMNS,
  );

  const q = useQuery({
    queryKey: ["dashboard", "funnel", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.funnel({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  const steps = useMemo(() => data?.steps ?? [], [data]);
  const max = useMemo(
    () => Math.max(...steps.map((s) => s.count), 1),
    [steps],
  );

  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const overallConversion =
    firstStep && lastStep && firstStep.count > 0
      ? (lastStep.count / firstStep.count) * 100
      : null;

  const summaryStats = useMemo<SummaryStat[]>(() => {
    if (!data) return [];
    return [
      {
        key: "sessions",
        labelKey: "funnel.stat_sessions",
        value: formatCount(data.total_sessions),
        icon: Eye,
        tone: "blue",
      },
      {
        key: "views",
        labelKey: "funnel.stat_views",
        value: formatCount(firstStep?.count ?? 0),
        icon: Layers,
        tone: "primary",
      },
      {
        key: "purchases",
        labelKey: "funnel.stat_purchases",
        value: formatCount(lastStep?.count ?? 0),
        icon: ShoppingBag,
        tone: "amber",
      },
      {
        key: "conversion",
        labelKey: "funnel.stat_conversion",
        value: overallConversion !== null ? formatPercent(overallConversion, 2) : "—",
        icon: TrendingDown,
        tone: "emerald",
      },
    ];
  }, [data, firstStep, lastStep, overallConversion]);

  const breakdownRows = useMemo<ResolvedBreakdownRow[]>(() => {
    if (!data) return [];
    const rows: FunnelBreakdownRow[] = [
      ...data.by_channel.map((g) => groupToRow(g, "channel")),
      ...data.by_device.map((g) => groupToRow(g, "device")),
    ];
    return rows.map((r) => ({ ...r, dimensionLabel: t(r.dimensionKey) }));
  }, [data, t]);

  // Kolon basligina tiklayinca kullanilan siralama deger cikaricilari. Adim
  // sayilari sayisal; donusum yuzdesi NULL olabilir (useSortedRows tarafindan
  // otomatik sona atilir). Boyut/segment string olarak tr-TR locale ile siralanir.
  const breakdownSortAccessors = useMemo<SortAccessors<ResolvedBreakdownRow>>(
    () => ({
      dimension: (r) => r.dimensionLabel,
      segment: (r) => r.label,
      view: (r) => r.view,
      add_to_cart: (r) => r.add_to_cart,
      checkout: (r) => r.checkout,
      purchase: (r) => r.purchase,
      conversion: (r) => r.conversion,
    }),
    [],
  );

  // Render ve export'tan ONCE sirala. Varsayilan (sortColumnId=null) backend
  // sirasini (kanallar sonra cihazlar) korur.
  const sortedBreakdownRows = useSortedRows(
    breakdownRows,
    breakdownSortAccessors,
    breakdownColumns.sortColumnId,
    breakdownColumns.sortDir,
  );

  const breakdownExportColumns = useMemo(
    () =>
      breakdownColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: col.exportValue,
      })),
    [breakdownColumns.visibleColumns, t],
  );

  const dropoffSeries = useMemo(() => {
    const points = data?.dropoff_series ?? [];
    if (points.length === 0) return [];
    const build = (
      name: string,
      pick: (p: (typeof points)[number]) => string | null,
    ) => ({
      name,
      data: points.map((p) => ({
        x: dayjs(p.date).valueOf(),
        y: Number(toNumber(pick(p)) ?? 0),
      })),
    });
    return [
      build(t("funnel.drop_view_to_cart"), (p) => p.view_to_cart_pct),
      build(t("funnel.drop_cart_to_checkout"), (p) => p.cart_to_checkout_pct),
      build(t("funnel.drop_checkout_to_purchase"), (p) => p.checkout_to_purchase_pct),
    ];
  }, [data, t]);

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader title={t("funnel.title")} range={range} onChangeRange={setRange} />
      </div>

      {/* Ozet istatistik seridi */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, i) => <SummaryStatSkeleton key={i} />)
          : summaryStats.map((stat) => (
              <SummaryStatCard key={stat.key} stat={stat} />
            ))}
      </div>

      {/* Funnel + drop-off trend */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("funnel.card_title")}
          hint={t("funnel.card_hint")}
          icon={Filter}
          className="h-full self-stretch"
        >
          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : steps.length === 0 ? (
            <ChartEmpty height={260} message={t("funnel.empty")} />
          ) : (
            <div className="space-y-3">
              <div className="space-y-2.5">
                {steps.map((s, idx) => {
                  const pct = (s.count / max) * 100;
                  const stepLabel = t(`funnel.steps.${s.step}`, {
                    defaultValue: s.label_tr,
                  });
                  const isLast = idx === steps.length - 1;
                  return (
                    <div key={s.step}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {idx + 1}. {stepLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatCount(s.count)}
                          </span>
                          {s.drop_from_previous_pct !== null && (
                            <span className="rounded bg-error-50 px-1.5 py-0.5 text-[11px] font-semibold text-error-700 dark:bg-error-500/10 dark:text-error-500">
                              {formatPercent(s.drop_from_previous_pct, 1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex h-9 items-center overflow-hidden rounded-md bg-muted/40">
                        <div
                          className={cn(
                            "flex h-full items-center rounded-md px-3 transition-all duration-500",
                            isLast
                              ? "bg-emerald-500"
                              : "bg-gradient-to-r from-primary to-primary/70",
                          )}
                          style={{ width: `${Math.max(pct, 6)}%` }}
                        >
                          <span className="text-xs font-semibold tabular-nums text-white">
                            {pct.toFixed(1).replace(".", ",")}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {overallConversion !== null && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                  <span className="text-sm font-medium text-text-muted">
                    {t("funnel.overall_conversion")}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {overallConversion.toFixed(2).replace(".", ",")}%
                  </span>
                </div>
              )}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={t("funnel.dropoff_trend_title")}
          hint={t("funnel.dropoff_trend_hint")}
          icon={TrendingDown}
          className="h-full self-stretch"
        >
          {isLoading ? (
            <ChartLoading height={300} />
          ) : dropoffSeries.length === 0 ? (
            <ChartEmpty height={300} message={t("funnel.empty")} />
          ) : (
            <LineChart
              height={300}
              series={dropoffSeries}
              yFormatter={(v) => formatPercent(v, 0)}
            />
          )}
        </ChartCard>
      </div>

      {/* Adim detaylari */}
      <ChartCard
        title={t("funnel.step_details_card_title")}
        hint={t("funnel.step_details_hint")}
        icon={ListChecks}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-md bg-muted/40" />
              ))
            : steps.map((s, idx) => {
                const stepLabel = t(`funnel.steps.${s.step}`, {
                  defaultValue: s.label_tr,
                });
                return (
                  <div
                    key={s.step}
                    className="space-y-1.5 rounded-md border border-border bg-surface-2/40 p-4"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                      {t("funnel.step_label")} {idx + 1}
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {stepLabel}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-foreground">
                      {formatCount(s.count)}
                    </p>
                    {idx === 0 ? (
                      <p className="text-xs text-text-muted">
                        {t("funnel.step_label_start")}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">
                        {t("funnel.drop_from_previous")}{" "}
                        <span className="font-semibold text-error-600 dark:text-error-500">
                          {formatPercent(toNumber(s.drop_from_previous_pct) ?? 0, 1)}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
        </div>
      </ChartCard>

      {/* Cihaz + kanal kirilim tablosu */}
      <ChartCard
        title={t("funnel.breakdown_title")}
        hint={t("funnel.breakdown_hint")}
        icon={Table2}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={sortedBreakdownRows}
              columns={breakdownExportColumns}
              fileBase="funnel-breakdown"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("funnel.breakdown_title")}
            />
            <ColumnSettingsMenu manager={breakdownColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {breakdownColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={breakdownColumns}
              ns="dashboard"
              isSortable={(col) => col.id !== "dimension"}
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={breakdownColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedBreakdownRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={breakdownColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("funnel.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedBreakdownRows.map((row) => (
                  <TableRow
                    key={row.rowKey}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {breakdownColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </PageShell>
  );
}
