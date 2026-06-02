import { useQuery } from "@tanstack/react-query";
import { KeyRound, Layers, Megaphone, ShoppingBag, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { ColumnSettingsMenu, ManagedColumnHeader } from "@/components/feature/table";
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
import type {
  GoogleCampaignMetric,
  GoogleKeywordRow,
  GoogleProductRow,
} from "@/types/dashboard";

import {
  DashboardHeader,
  PageShell,
  RoasPill,
  useDashboardRange,
} from "./_shared";

/* ──────────────────────────────────────────────────────────────── */
/* Kolon tanimlari — her tablo kendi useColumnManager anahtariyla yonetilir. */

/** Kampanya tablosu kolonu (id = stabil localStorage anahtari). */
interface CampaignColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: GoogleCampaignMetric, index: number) => ReactNode;
  exportValue: (row: GoogleCampaignMetric, index: number) => string | number | null;
}

const CAMPAIGN_COLUMNS: CampaignColumn[] = [
  {
    id: "rank",
    labelKey: "google_ads.col_rank",
    required: true,
    width: "w-[56px]",
    cell: (_, idx) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
        )}
      >
        {idx + 1}
      </span>
    ),
    exportValue: (_, idx) => idx + 1,
  },
  {
    id: "campaign",
    labelKey: "google_ads.col_campaign",
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
    exportValue: (c) => c.campaign_name,
  },
  {
    id: "impressions",
    labelKey: "google_ads.col_impressions",
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
    labelKey: "google_ads.col_clicks",
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
    labelKey: "google_ads.col_ctr",
    width: "w-[88px]",
    numeric: true,
    cell: (c) => <span className="tabular-nums text-sm">{formatPercent(c.ctr, 2)}</span>,
    exportValue: (c) => toNumber(c.ctr),
  },
  {
    id: "cpc",
    labelKey: "google_ads.col_cpc",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">{formatCurrency(c.cpc)}</span>
    ),
    exportValue: (c) => toNumber(c.cpc),
  },
  {
    id: "spend",
    labelKey: "google_ads.col_spend",
    width: "w-[120px]",
    numeric: true,
    cell: (c) => <span className="tabular-nums text-sm">{formatCurrency(c.spend)}</span>,
    exportValue: (c) => toNumber(c.spend),
  },
  {
    id: "conversions",
    labelKey: "google_ads.col_conversions",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatCount(c.conversions)}</span>
    ),
    exportValue: (c) => toNumber(c.conversions),
  },
  {
    id: "revenue",
    labelKey: "google_ads.col_revenue",
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
    labelKey: "google_ads.col_roas",
    width: "w-[96px]",
    numeric: true,
    cell: (c) => <RoasPill value={c.roas} />,
    exportValue: (c) => toNumber(c.roas),
  },
];

/** Anahtar kelime tablosu kolonu. */
interface KeywordColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: GoogleKeywordRow) => ReactNode;
  exportValue: (row: GoogleKeywordRow) => string | number | null;
}

const KEYWORD_COLUMNS: KeywordColumn[] = [
  {
    id: "keyword",
    labelKey: "google_ads.col_keyword",
    required: true,
    width: "w-auto",
    cell: (k) => (
      <span className="block truncate font-medium text-foreground" title={k.keyword}>
        {k.keyword}
      </span>
    ),
    exportValue: (k) => k.keyword,
  },
  {
    id: "match_type",
    labelKey: "google_ads.col_match_type",
    width: "w-[96px]",
    cell: (k) => <MatchTypeBadge matchType={k.match_type} />,
    exportValue: (k) => k.match_type,
  },
  {
    id: "clicks",
    labelKey: "google_ads.col_clicks",
    width: "w-[90px]",
    numeric: true,
    cell: (k) => (
      <span className="tabular-nums text-sm text-text-muted">{formatCount(k.clicks)}</span>
    ),
    exportValue: (k) => k.clicks,
  },
  {
    id: "impressions",
    labelKey: "google_ads.col_impressions",
    width: "w-[100px]",
    numeric: true,
    cell: (k) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(k.impressions)}
      </span>
    ),
    exportValue: (k) => k.impressions,
  },
  {
    id: "ctr",
    labelKey: "google_ads.col_ctr",
    width: "w-[90px]",
    numeric: true,
    cell: (k) => <span className="tabular-nums text-sm">{formatPercent(k.ctr, 2)}</span>,
    exportValue: (k) => toNumber(k.ctr),
  },
  {
    id: "cpc",
    labelKey: "google_ads.col_cpc",
    width: "w-[96px]",
    numeric: true,
    cell: (k) => (
      <span className="tabular-nums text-sm text-text-muted">{formatCurrency(k.cpc)}</span>
    ),
    exportValue: (k) => toNumber(k.cpc),
  },
  {
    id: "conversions",
    labelKey: "google_ads.col_conversions",
    width: "w-[100px]",
    numeric: true,
    cell: (k) => (
      <span className="tabular-nums text-sm">{formatCount(k.conversions)}</span>
    ),
    exportValue: (k) => toNumber(k.conversions),
  },
  {
    id: "roas",
    labelKey: "google_ads.col_roas",
    width: "w-[90px]",
    numeric: true,
    cell: (k) => <RoasPill value={k.roas} />,
    exportValue: (k) => toNumber(k.roas),
  },
];

/** Urun tablosu kolonu (Shopping/PMax). */
interface ProductColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: GoogleProductRow) => ReactNode;
  exportValue: (row: GoogleProductRow) => string | number | null;
}

const PRODUCT_COLUMNS: ProductColumn[] = [
  {
    id: "product",
    labelKey: "google_ads.col_product",
    required: true,
    width: "w-auto",
    cell: (p) => (
      <span
        className="block truncate font-medium text-foreground"
        title={p.product_name ?? p.product_id}
      >
        {p.product_name ?? p.product_id}
      </span>
    ),
    exportValue: (p) => p.product_name ?? p.product_id,
  },
  {
    id: "impressions",
    labelKey: "google_ads.col_impressions",
    width: "w-[110px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm text-text-muted">
        {formatCount(p.impressions)}
      </span>
    ),
    exportValue: (p) => p.impressions,
  },
  {
    id: "clicks",
    labelKey: "google_ads.col_clicks",
    width: "w-[100px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm text-text-muted">{formatCount(p.clicks)}</span>
    ),
    exportValue: (p) => p.clicks,
  },
  {
    id: "conversions",
    labelKey: "google_ads.col_conversions",
    width: "w-[100px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm">{formatCount(p.conversions)}</span>
    ),
    exportValue: (p) => toNumber(p.conversions),
  },
  {
    id: "spend",
    labelKey: "google_ads.col_spend",
    width: "w-[120px]",
    numeric: true,
    cell: (p) => <span className="tabular-nums text-sm">{formatCurrency(p.spend)}</span>,
    exportValue: (p) => toNumber(p.spend),
  },
  {
    id: "revenue",
    labelKey: "google_ads.col_revenue",
    width: "w-[120px]",
    numeric: true,
    cell: (p) => (
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {formatCurrency(p.conversions_value)}
      </span>
    ),
    exportValue: (p) => toNumber(p.conversions_value),
  },
  {
    id: "roas",
    labelKey: "google_ads.col_roas",
    width: "w-[96px]",
    numeric: true,
    cell: (p) => <RoasPill value={p.roas} />,
    exportValue: (p) => toNumber(p.roas),
  },
];

/* ──────────────────────────────────────────────────────────────── */

/**
 * Google Ads sayfasi. 9 reklam KPI'si, gunluk harcama/getiri trendi, kanal
 * turu kirilimi ile anahtar kelime, urun ve kampanya performans tablolari.
 *
 * Not: `/dashboard/google` endpoint'i yalnizca tarih araligi kabul eder
 * (kanal/cihaz capraz filtresi desteklemez); bu yuzden GlobalFilterBar yok.
 */
export default function GoogleAdsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

  const campaignColumns = useColumnManager("google-campaigns-table", CAMPAIGN_COLUMNS);
  const keywordColumns = useColumnManager("google-keywords-table", KEYWORD_COLUMNS);
  const productColumns = useColumnManager("google-products-table", PRODUCT_COLUMNS);

  const q = useQuery({
    queryKey: ["dashboard", "google", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.google({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const campaigns = useMemo(() => data?.campaigns ?? [], [data]);
  const keywords = useMemo(() => data?.keywords ?? [], [data]);
  const products = useMemo(() => data?.products ?? [], [data]);

  const channelTypeLabel = (type: string | null) =>
    t(`google_ads.channel_type_${type ?? "unknown"}`, {
      defaultValue: type ?? t("google_ads.channel_type_unknown"),
    });

  const channelLabels = useMemo(
    () =>
      data?.channel_breakdown.map((c) => channelTypeLabel(c.channel_type)) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const channelValues = useMemo(
    () => data?.channel_breakdown.map((c) => toNumber(c.spend) ?? 0) ?? [],
    [data],
  );

  const campaignExportColumns = useMemo(
    () =>
      campaignColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (row: GoogleCampaignMetric) =>
          col.exportValue(row, campaigns.indexOf(row)),
      })),
    [campaignColumns.visibleColumns, campaigns, t],
  );
  const keywordExportColumns = useMemo(
    () =>
      keywordColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: col.exportValue,
      })),
    [keywordColumns.visibleColumns, t],
  );
  const productExportColumns = useMemo(
    () =>
      productColumns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: col.exportValue,
      })),
    [productColumns.visibleColumns, t],
  );

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader
          title={t("google_ads.title")}
          range={range}
          onChangeRange={setRange}
        />
      </div>

      {/* Reklam KPI'lari */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-5">
        {isLoading || !data
          ? Array.from({ length: 9 }).map((_, i) => <KPICardSkeleton key={i} compact />)
          : (
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
              </>
            )}
      </div>

      {/* Harcama vs Getiri trendi + Kanal türü kırılımı */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("google_ads.trend_card_title")}
          hint={t("google_ads.trend_hint")}
          icon={TrendingUp}
          className="h-full self-stretch lg:col-span-2"
        >
          {isLoading ? (
            <ChartLoading height={300} />
          ) : !data || data.daily_series.length === 0 ? (
            <ChartEmpty height={300} />
          ) : (
            <LineChart
              height={300}
              multiAxis
              series={[
                {
                  name: t("google_ads.series_ad_revenue"),
                  color: "#10b981",
                  data: data.daily_series.map((p) => ({
                    x: dayjs(p.date).valueOf(),
                    y: toNumber(p.revenue) ?? 0,
                  })),
                  formatter: formatCurrency,
                },
                {
                  name: t("google_ads.series_ad_spend"),
                  color: "#7a5af8",
                  data: data.daily_series.map((p) => ({
                    x: dayjs(p.date).valueOf(),
                    y: toNumber(p.spend) ?? 0,
                  })),
                  formatter: formatCurrency,
                },
              ]}
              yFormatter={formatAxisCurrency}
            />
          )}
        </ChartCard>

        <ChartCard
          title={t("google_ads.channel_breakdown_card_title")}
          hint={t("google_ads.channel_breakdown_hint")}
          icon={Layers}
          className="h-full self-stretch"
        >
          <DonutChart
            loading={isLoading}
            height={300}
            labels={channelLabels}
            values={channelValues}
            valueFormatter={formatCurrency}
            totalLabel={t("google_ads.col_spend")}
            groupSmallSlices={false}
          />
        </ChartCard>
      </div>

      {/* Anahtar kelimeler */}
      <ChartCard
        title={t("google_ads.keywords_card_title")}
        hint={t("google_ads.keywords_hint")}
        icon={KeyRound}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={keywords}
              columns={keywordExportColumns}
              fileBase="google-keywords"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("google_ads.keywords_card_title")}
            />
            <ColumnSettingsMenu manager={keywordColumns} ns="dashboard" />
          </div>
        }
      >
        <ManagedTable
          manager={keywordColumns}
          rows={keywords}
          loading={isLoading}
          rowKey={(k) => `${k.keyword}-${k.match_type ?? ""}`}
          emptyLabel={t("google_ads.keywords_empty")}
        />
      </ChartCard>

      {/* Shopping/PMax ürünleri */}
      <ChartCard
        title={t("google_ads.products_card_title")}
        hint={t("google_ads.products_hint")}
        icon={ShoppingBag}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={products}
              columns={productExportColumns}
              fileBase="google-products"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("google_ads.products_card_title")}
            />
            <ColumnSettingsMenu manager={productColumns} ns="dashboard" />
          </div>
        }
      >
        <ManagedTable
          manager={productColumns}
          rows={products}
          loading={isLoading}
          rowKey={(p) => p.product_id}
          emptyLabel={t("google_ads.products_empty")}
        />
      </ChartCard>

      {/* Kampanya tablosu */}
      <ChartCard
        title={t("google_ads.campaigns_card_title")}
        hint={t("google_ads.campaigns_hint")}
        icon={Megaphone}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={campaigns}
              columns={campaignExportColumns}
              fileBase="google-campaigns"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("google_ads.campaigns_card_title")}
            />
            <ColumnSettingsMenu manager={campaignColumns} ns="dashboard" />
          </div>
        }
      >
        <ManagedTable
          manager={campaignColumns}
          rows={campaigns}
          loading={isLoading}
          rowKey={(c) => String(c.campaign_id)}
          emptyLabel={t("google_ads.campaigns_empty")}
        />
      </ChartCard>
    </PageShell>
  );
}

/* ──────────────────────────────────────────────────────────────── */

/** Anahtar kelime eşleşme türü rozeti. */
function MatchTypeBadge({ matchType }: { matchType: string | null }) {
  const { t } = useTranslation("dashboard");
  if (!matchType) return <span className="text-text-dim">—</span>;
  return (
    <span className="inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-text-muted">
      {t(`google_ads.match_${matchType}`, { defaultValue: matchType })}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────── */

/** Bir yönetilen tablo kolonunun ortak şekli (cell index opsiyonel). */
interface ManagedTableColumn<TRow> extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: TRow, index: number) => ReactNode;
}

/**
 * Kolon yöneticisiyle render edilen jenerik tablo. ChannelAnalysisPage'deki
 * tablo desenini sayfa içindeki üç tabloya yeniden kullanılabilir kılar:
 * görünür kolonlar kullanıcı sırasında, loading + empty durumlarıyla.
 */
function ManagedTable<TCol extends ManagedTableColumn<TRow>, TRow>({
  manager,
  rows,
  loading,
  rowKey,
  emptyLabel,
}: {
  manager: ReturnType<typeof useColumnManager<TCol>>;
  rows: TRow[];
  loading?: boolean;
  rowKey: (row: TRow) => string;
  emptyLabel: string;
}) {
  const colCount = manager.visibleColumns.length;
  return (
    <div className="overflow-x-auto">
      <Table className="table-fixed">
        <colgroup>
          {manager.visibleColumns.map((col) => (
            <col key={col.id} className={col.width} />
          ))}
        </colgroup>
        <ManagedColumnHeader
          manager={manager}
          ns="dashboard"
          headClassName={(col) => (col.numeric ? "text-right" : undefined)}
        />
        <TableBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={colCount} className="px-4 py-3.5">
                  <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colCount}
                className="py-12 text-center text-sm text-text-muted"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, idx) => (
              <TableRow
                key={rowKey(row)}
                className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
              >
                {manager.visibleColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn("px-3 py-3.5", col.numeric && "text-right")}
                  >
                    {col.cell(row, idx)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
