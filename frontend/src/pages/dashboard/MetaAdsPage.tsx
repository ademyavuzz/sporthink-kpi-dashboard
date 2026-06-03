import { useQuery } from "@tanstack/react-query";
import { BarChart3, Megaphone, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { LineChart } from "@/components/feature/charts/LineChart";
import {
  MetricToggles,
  type MetricOption,
} from "@/components/feature/charts/MetricToggles";
import {
  ColumnSettingsMenu,
  ManagedColumnHeader,
  useSortedRows,
  type SortAccessors,
} from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
import type { CampaignMetric } from "@/types/dashboard";

import {
  DashboardHeader,
  PageShell,
  RoasPill,
  useDashboardRange,
} from "./_shared";

/**
 * Meta Ads sayfasi. 10 reklam KPI'si, gunluk harcama/getiri trendi, harcamaya
 * gore en iyi kampanyalar grafigi ve kolon-ozellestirilebilir + disa
 * aktarilabilir kampanya performans tablosu.
 *
 * Not: backend `/dashboard/meta` endpoint'i yalnizca date_from/date_to
 * (+ comparison_mode) kabul eder; channels/devices gibi capraz filtre
 * parametresi almaz. Bu nedenle bu sayfada GlobalFilterBar yoktur (ise
 * yaramayan filtre gosterilmez).
 */
/** Kampanya tablosu kolon tanimlari (id = stabil localStorage anahtari). */
interface CampaignColumn extends ColumnDef {
  /** Kolonun colgroup genisligi. */
  width: string;
  /** Saga hizali sayisal kolon mu? */
  numeric?: boolean;
  /** Tek satir icin hucre icerigini render eder (idx: 0 tabanli sira). */
  cell: (row: CampaignMetric, idx: number) => ReactNode;
  /** Disa aktarmada kullanilacak ham hucre degeri (formatsiz). */
  exportValue: (row: CampaignMetric, idx: number) => string | number | null;
}

const CAMPAIGN_COLUMNS: CampaignColumn[] = [
  {
    id: "rank",
    labelKey: "meta_ads.col_rank",
    required: true,
    width: "w-[52px]",
    cell: (_c, idx) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {idx + 1}
      </span>
    ),
    exportValue: (_c, idx) => idx + 1,
  },
  {
    id: "campaign",
    labelKey: "meta_ads.col_campaign",
    required: true,
    width: "w-auto",
    cell: (c) => (
      <span
        className="block truncate font-medium text-foreground"
        title={c.campaign_name ?? ""}
      >
        {c.campaign_name ?? "-"}
      </span>
    ),
    exportValue: (c) => c.campaign_name ?? "-",
  },
  {
    id: "impressions",
    labelKey: "meta_ads.col_impressions",
    width: "w-[110px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(c.impressions)}
      </span>
    ),
    exportValue: (c) => c.impressions,
  },
  {
    id: "clicks",
    labelKey: "meta_ads.col_clicks",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(c.clicks)}
      </span>
    ),
    exportValue: (c) => c.clicks,
  },
  {
    id: "ctr",
    labelKey: "meta_ads.col_ctr",
    width: "w-[88px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatPercent(c.ctr, 2)}</span>
    ),
    exportValue: (c) => toNumber(c.ctr),
  },
  {
    id: "cpc",
    labelKey: "meta_ads.col_cpc",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCurrency(c.cpc)}
      </span>
    ),
    exportValue: (c) => toNumber(c.cpc),
  },
  {
    id: "spend",
    labelKey: "meta_ads.col_spend",
    width: "w-[120px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatCurrency(c.spend)}</span>
    ),
    exportValue: (c) => toNumber(c.spend),
  },
  {
    id: "conversions",
    labelKey: "meta_ads.col_conversions",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatCount(c.conversions)}</span>
    ),
    exportValue: (c) => toNumber(c.conversions),
  },
  {
    id: "revenue",
    labelKey: "meta_ads.col_revenue",
    width: "w-[120px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {formatCurrency(c.conversions_value)}
      </span>
    ),
    exportValue: (c) => toNumber(c.conversions_value),
  },
  {
    id: "roas",
    labelKey: "meta_ads.col_roas",
    width: "w-[96px]",
    numeric: true,
    cell: (c) => <RoasPill value={c.roas} />,
    exportValue: (c) => toNumber(c.roas),
  },
];

export default function MetaAdsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

  const campaignColumns = useColumnManager("meta-ads-campaigns", CAMPAIGN_COLUMNS);

  const q = useQuery({
    queryKey: ["dashboard", "meta", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.meta({ date_from: range.date_from, date_to: range.date_to }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const campaigns = useMemo(() => data?.campaigns ?? [], [data]);

  // Kolon id -> siralama deger cikarici. "rank" yapisal kolon oldugu icin
  // siralanmaz (sirayi zaten siralama belirler). Para/yuzde string'leri toNumber
  // ile sayiya cevrilir; bos isimler null doner (NULL'lar her zaman sona gider).
  const campaignSortAccessors = useMemo<SortAccessors<CampaignMetric>>(
    () => ({
      campaign: (c) => c.campaign_name ?? null,
      impressions: (c) => c.impressions,
      clicks: (c) => c.clicks,
      ctr: (c) => toNumber(c.ctr),
      cpc: (c) => toNumber(c.cpc),
      spend: (c) => toNumber(c.spend),
      conversions: (c) => toNumber(c.conversions),
      revenue: (c) => toNumber(c.conversions_value),
      roas: (c) => toNumber(c.roas),
    }),
    [],
  );

  // Render ve disa aktarmadan ONCE sirala. Varsayilan (sortColumnId=null)
  // backend sirasini korur.
  const sortedCampaigns = useSortedRows(
    campaigns,
    campaignSortAccessors,
    campaignColumns.sortColumnId,
    campaignColumns.sortDir,
  );

  const campaignExportColumns = useMemo(
    () =>
      campaignColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (row: CampaignMetric) =>
          col.exportValue(row, sortedCampaigns.indexOf(row)),
      })),
    [campaignColumns.visibleColumns, sortedCampaigns, t],
  );

  // Harcamaya gore en iyi 8 kampanya (bar grafik).
  const topSpendCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => (toNumber(b.spend) ?? 0) - (toNumber(a.spend) ?? 0))
      .slice(0, 8);
  }, [campaigns]);
  const spendLabels = useMemo(
    () => topSpendCampaigns.map((c) => c.campaign_name ?? "-"),
    [topSpendCampaigns],
  );
  const spendValues = useMemo(
    () => topSpendCampaigns.map((c) => toNumber(c.spend) ?? 0),
    [topSpendCampaigns],
  );

  const [trendMetrics, setTrendMetrics] = useState<string[]>([
    "ad_revenue",
    "ad_spend",
  ]);
  const trendAllSeries = useMemo(() => {
    if (!data) return [];
    return [
      {
        id: "ad_revenue",
        name: t("meta_ads.series_ad_revenue"),
        color: "#10b981",
        data: data.daily_series.map((p) => ({
          x: dayjs(p.date).valueOf(),
          y: toNumber(p.revenue) ?? 0,
        })),
        formatter: formatCurrency,
      },
      {
        id: "ad_spend",
        name: t("meta_ads.series_ad_spend"),
        color: "#7a5af8",
        data: data.daily_series.map((p) => ({
          x: dayjs(p.date).valueOf(),
          y: toNumber(p.spend) ?? 0,
        })),
        formatter: formatCurrency,
      },
    ];
  }, [data, t]);
  const trendOptions = useMemo<MetricOption[]>(
    () => trendAllSeries.map((s) => ({ id: s.id, label: s.name, color: s.color })),
    [trendAllSeries],
  );
  const trendSeries = useMemo(
    () => trendAllSeries.filter((s) => trendMetrics.includes(s.id)),
    [trendAllSeries, trendMetrics],
  );

  const hasTrendData = useMemo(
    () =>
      trendSeries.some((s) =>
        s.data.some((point) => Number.isFinite(point.y) && point.y !== 0),
      ),
    [trendSeries],
  );

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader
          title={t("meta_ads.title")}
          range={range}
          onChangeRange={setRange}
        />
      </div>

      {/* Reklam KPI'lari */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">
        {isLoading || !data ? (
          Array.from({ length: 10 }).map((_, i) => <KPICardSkeleton key={i} compact />)
        ) : (
          <>
            <KPICard kpi={data.ad_spend} compact />
            <KPICard kpi={data.impressions} compact />
            <KPICard kpi={data.clicks} compact />
            <KPICard kpi={data.ctr} compact />
            <KPICard kpi={data.cpc} compact />
            <KPICard kpi={data.cpm} compact />
            <KPICard kpi={data.ad_conversions} compact />
            <KPICard kpi={data.cost_per_conversion} compact />
            <KPICard kpi={data.roas} compact />
            <KPICard kpi={data.frequency} compact />
          </>
        )}
      </div>

      {/* Trend + Harcamaya gore en iyi kampanyalar */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("meta_ads.trend_card_title")}
          hint={t("meta_ads.trend_hint")}
          icon={TrendingUp}
          className="h-full self-stretch lg:col-span-2"
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
          {isLoading ? (
            <ChartLoading height={320} />
          ) : !hasTrendData ? (
            <ChartEmpty height={320} />
          ) : (
            <LineChart
              height={320}
              multiAxis
              series={trendSeries}
              yFormatter={formatAxisCurrency}
            />
          )}
        </ChartCard>

        <ChartCard
          title={t("meta_ads.top_spend_card_title")}
          hint={t("meta_ads.top_spend_hint")}
          icon={BarChart3}
          className="h-full self-stretch"
        >
          {isLoading ? (
            <ChartLoading height={320} />
          ) : spendLabels.length === 0 ? (
            <ChartEmpty height={320} />
          ) : (
            <BarChart
              categories={spendLabels}
              series={[{ name: t("meta_ads.col_spend"), data: spendValues }]}
              horizontal
              height={320}
              valueFormatter={formatCurrency}
            />
          )}
        </ChartCard>
      </div>

      {/* Kampanya tablosu */}
      <ChartCard
        title={t("meta_ads.campaigns_card_title")}
        hint={t("meta_ads.campaigns_hint")}
        icon={Megaphone}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={sortedCampaigns}
              columns={campaignExportColumns}
              fileBase="meta-ads-campaigns"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("meta_ads.campaigns_card_title")}
            />
            <ColumnSettingsMenu manager={campaignColumns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {campaignColumns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={campaignColumns}
              ns="dashboard"
              isSortable={(col) => col.id !== "rank"}
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={campaignColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedCampaigns.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={campaignColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("meta_ads.campaigns_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedCampaigns.map((c, idx) => (
                  <TableRow
                    key={c.campaign_id}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {campaignColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(c, idx)}
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
