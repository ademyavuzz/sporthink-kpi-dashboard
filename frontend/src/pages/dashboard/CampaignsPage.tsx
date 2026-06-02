import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronRight,
  PieChart,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { CampaignDetailDialog } from "@/components/feature/CampaignDetailDialog";
import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { ColumnSettingsMenu, ManagedColumnHeader } from "@/components/feature/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
import { dashboardApi } from "@/lib/api/dashboard";
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

type PlatformFilter = "all" | "meta" | "google";

/** Disa aktarmada / grafikte kullanilacak en fazla kampanya sayisi. */
const TOP_CHART_LIMIT = 10;

/**
 * Kampanya tablosu kolon tanimi. `id` localStorage anahtaridir; `cell`
 * satir + (1 tabanli) sira numarasi alir, `exportValue` ham deger doner.
 * Yapisal kolonlarda (sira "#", aksiyon) `exportValue` tanimlanmaz; bu
 * kolonlar disa aktarma kapsamina alinmaz.
 */
interface CampaignColumn extends ColumnDef {
  width: string;
  numeric?: boolean;
  cell: (row: CampaignMetric, index: number) => ReactNode;
  exportValue?: (row: CampaignMetric) => string | number | null;
}

const CAMPAIGN_COLUMNS: CampaignColumn[] = [
  {
    id: "rank",
    labelKey: "campaigns.col_rank",
    required: true,
    width: "w-[52px]",
    cell: (_c, idx) => (
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
          idx <= 3
            ? "bg-primary/10 text-primary"
            : "bg-muted text-text-muted",
        )}
      >
        {idx}
      </span>
    ),
  },
  {
    id: "platform",
    labelKey: "campaigns.col_platform",
    width: "w-[96px]",
    cell: (c) => <PlatformBadge platform={c.platform ?? null} />,
    exportValue: (c) => c.platform,
  },
  {
    id: "campaign",
    labelKey: "campaigns.col_campaign",
    required: true,
    width: "min-w-[220px]",
    cell: (c) => (
      <span
        className="block truncate font-medium text-foreground"
        title={c.campaign_name ?? ""}
      >
        {c.campaign_name ?? "—"}
      </span>
    ),
    exportValue: (c) => c.campaign_name,
  },
  {
    id: "objective",
    labelKey: "campaigns.col_objective",
    width: "w-[130px]",
    cell: (c) => (
      <span className="block truncate text-sm text-text-muted" title={c.objective ?? ""}>
        {c.objective ?? "—"}
      </span>
    ),
    exportValue: (c) => c.objective,
  },
  {
    id: "impressions",
    labelKey: "campaigns.col_impressions",
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
    labelKey: "campaigns.col_clicks",
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
    labelKey: "campaigns.col_ctr",
    width: "w-[88px]",
    numeric: true,
    cell: (c) => <span className="tabular-nums text-sm">{formatPercent(c.ctr, 2)}</span>,
    exportValue: (c) => toNumber(c.ctr),
  },
  {
    id: "cpc",
    labelKey: "campaigns.col_cpc",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm text-text-muted">
        {c.cpc !== null ? formatCurrency(c.cpc) : "—"}
      </span>
    ),
    exportValue: (c) => toNumber(c.cpc),
  },
  {
    id: "spend",
    labelKey: "campaigns.col_spend",
    width: "w-[120px]",
    numeric: true,
    cell: (c) => <span className="tabular-nums text-sm">{formatCurrency(c.spend)}</span>,
    exportValue: (c) => toNumber(c.spend),
  },
  {
    id: "conversions",
    labelKey: "campaigns.col_conversions",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => (
      <span className="tabular-nums text-sm">{formatCount(c.conversions)}</span>
    ),
    exportValue: (c) => toNumber(c.conversions),
  },
  {
    id: "revenue",
    labelKey: "campaigns.col_revenue",
    width: "w-[130px]",
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
    labelKey: "campaigns.col_roas",
    width: "w-[100px]",
    numeric: true,
    cell: (c) => <RoasPill value={c.roas} />,
    exportValue: (c) => toNumber(c.roas),
  },
  {
    id: "action",
    labelKey: "campaigns.col_action_detail",
    required: true,
    width: "w-[56px]",
    numeric: true,
    cell: () => (
      <span className="inline-flex justify-end text-text-dim">
        <ChevronRight className="size-4" />
      </span>
    ),
  },
];

/**
 * Kampanya Analizi sayfasi. 3 ozet KPI, platform filtresi (backend'e gonderilir
 * — hem KPI'lar hem tablo platforma daralir), harcama/ROAS gorselleri ve
 * kolon-ozellestirilebilir + disa aktarilabilir kampanya performans tablosu.
 * Satira tiklayinca kampanya detay dialogu acilir.
 */
export default function CampaignsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [detailCampaign, setDetailCampaign] = useState<string | null>(null);

  const campaignColumns = useColumnManager("campaigns-table", CAMPAIGN_COLUMNS);

  const q = useQuery({
    queryKey: ["dashboard", "campaign", range.date_from, range.date_to, platform],
    queryFn: () =>
      dashboardApi.campaign({
        date_from: range.date_from,
        date_to: range.date_to,
        platform: platform === "all" ? undefined : platform,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const loading = q.isPending;

  const campaigns = useMemo(() => data?.campaigns ?? [], [data]);

  // Disa aktarma: yapisal kolonlar (sira, aksiyon) haric gorunur kolonlar.
  const exportColumns = useMemo(
    () =>
      campaignColumns.visibleColumns
        .filter((col) => col.exportValue)
        .map((col) => ({
          header: t(col.labelKey),
          accessor: col.exportValue!,
        })),
    [campaignColumns.visibleColumns, t],
  );

  // En cok harcayan kampanyalar (yatay bar) — backend verisinin gorsel ozeti.
  const topBySpend = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => (toNumber(b.spend) ?? 0) - (toNumber(a.spend) ?? 0))
        .slice(0, TOP_CHART_LIMIT),
    [campaigns],
  );
  const spendBarCategories = useMemo(
    () => topBySpend.map((c) => c.campaign_name ?? "—"),
    [topBySpend],
  );
  const spendBarValues = useMemo(
    () => topBySpend.map((c) => toNumber(c.spend) ?? 0),
    [topBySpend],
  );

  // Reklam gelirinin kampanyalara dagilimi (donut).
  const revenueDonutLabels = useMemo(
    () =>
      [...campaigns]
        .sort(
          (a, b) =>
            (toNumber(b.conversions_value) ?? 0) - (toNumber(a.conversions_value) ?? 0),
        )
        .map((c) => c.campaign_name ?? "—"),
    [campaigns],
  );
  const revenueDonutValues = useMemo(
    () =>
      [...campaigns]
        .sort(
          (a, b) =>
            (toNumber(b.conversions_value) ?? 0) - (toNumber(a.conversions_value) ?? 0),
        )
        .map((c) => toNumber(c.conversions_value) ?? 0),
    [campaigns],
  );

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader
          title={t("campaigns.title")}
          range={range}
          onChangeRange={setRange}
          actions={
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as PlatformFilter)}
            >
              <SelectTrigger className="h-9 w-32" aria-label={t("campaigns.platform_filter_label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("campaigns.platform_filter_all")}</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </div>

      {/* Ozet KPI gridi */}
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
        {loading || !data ? (
          Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} hero />)
        ) : (
          <>
            <KPICard kpi={data.total_spend} hero />
            <KPICard kpi={data.total_revenue} hero />
            <KPICard kpi={data.overall_roas} hero />
          </>
        )}
      </div>

      {/* Harcama bar + gelir donut */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard
          title={t("campaigns.spend_chart_title")}
          hint={t("campaigns.spend_chart_hint")}
          icon={BarChart3}
          className="h-full self-stretch lg:col-span-2"
        >
          {loading ? (
            <ChartLoading height={320} />
          ) : spendBarCategories.length === 0 ? (
            <ChartEmpty height={320} />
          ) : (
            <BarChart
              categories={spendBarCategories}
              series={[{ name: t("campaigns.col_spend"), data: spendBarValues }]}
              horizontal
              height={320}
              valueFormatter={formatAxisCurrency}
            />
          )}
        </ChartCard>

        <ChartCard
          title={t("campaigns.revenue_distribution_title")}
          hint={t("campaigns.revenue_distribution_hint")}
          icon={PieChart}
          className="h-full self-stretch"
        >
          <DonutChart
            labels={revenueDonutLabels}
            values={revenueDonutValues}
            loading={loading}
            height={320}
            totalLabel={t("campaigns.revenue_total")}
            valueFormatter={formatCurrency}
          />
        </ChartCard>
      </div>

      {/* Kampanya performans tablosu */}
      <ChartCard
        title={t("campaigns.all_campaigns_card_title", { count: campaigns.length })}
        hint={t("campaigns.table_hint")}
        icon={Sparkles}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={campaigns}
              columns={exportColumns}
              fileBase="campaigns"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("campaigns.title")}
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
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={campaignColumns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : campaigns.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={campaignColumns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("campaigns.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c, idx) => (
                  <TableRow
                    key={c.campaign_id}
                    onClick={() =>
                      c.campaign_name && setDetailCampaign(c.campaign_name)
                    }
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {campaignColumns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(c, idx + 1)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>

      <CampaignDetailDialog
        open={detailCampaign !== null}
        onOpenChange={(o) => !o && setDetailCampaign(null)}
        campaignName={detailCampaign}
        dateFrom={range.date_from}
        dateTo={range.date_to}
      />
    </PageShell>
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-text-dim">—</span>;
  const tone =
    platform === "meta"
      ? "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
      : platform === "google"
        ? "bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20"
        : "bg-muted text-text-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset",
        tone,
      )}
    >
      {platform}
    </span>
  );
}
