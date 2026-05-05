import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CampaignDetailDialog } from "@/components/feature/CampaignDetailDialog";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardApi } from "@/lib/api/dashboard";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  DashboardHeader,
  PageShell,
  RoasPill,
  useDashboardRange,
} from "./_shared";

type PlatformFilter = "all" | "meta" | "google";

export default function CampaignsPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [detailCampaign, setDetailCampaign] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["dashboard", "campaign", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.campaign({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const filtered =
    data?.campaigns.filter((c) =>
      platform === "all" ? true : c.platform === platform,
    ) ?? [];

  return (
    <PageShell>
      <DashboardHeader
        title={t("campaigns.title")}
        range={range}
        onChangeRange={setRange}
        actions={
          <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformFilter)}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("campaigns.platform_filter_all")}
              </SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="google">Google</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.total_spend} />
                <KPICard kpi={data.total_revenue} />
                <KPICard kpi={data.overall_roas} />
              </>
            )}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            {t("campaigns.all_campaigns_card_title", { count: filtered.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[100px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[60px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_platform")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_campaign")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_impressions")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_clicks")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_ctr")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_spend")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_conversions")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_revenue")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("campaigns.col_roas")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    <span className="sr-only">
                      {t("campaigns.col_action_detail")}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c, idx) => (
                    <TableRow
                      key={c.campaign_id}
                      onClick={() =>
                        c.campaign_name && setDetailCampaign(c.campaign_name)
                      }
                      className={cn(
                        "cursor-pointer border-b border-border/60 transition-colors",
                        idx % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5">
                        <PlatformBadge platform={c.platform ?? null} />
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm">
                        <span
                          className="block truncate font-medium text-foreground"
                          title={c.campaign_name ?? ""}
                        >
                          {c.campaign_name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                        {formatCount(c.impressions)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm text-text-muted">
                        {formatCount(c.clicks)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                        {formatPercent(c.ctr, 2)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                        {formatCurrency(c.spend)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                        {formatCount(c.conversions)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                        {formatCurrency(c.conversions_value)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right">
                        <RoasPill value={c.roas} />
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (c.campaign_name)
                              setDetailCampaign(c.campaign_name);
                          }}
                          aria-label={t("campaigns.campaign_detail_aria")}
                          title={t("campaigns.campaign_detail_aria")}
                          className="size-8"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
