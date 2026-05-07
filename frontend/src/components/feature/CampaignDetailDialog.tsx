import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Eye,
  Loader2,
  MousePointerClick,
  Package,
  Percent,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { LineChart } from "@/components/feature/charts/LineChart";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  formatMultiplier,
  formatPercent,
  toNumber,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface CampaignDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string | null;
  dateFrom: string;
  dateTo: string;
}

export function CampaignDetailDialog({
  open,
  onOpenChange,
  campaignName,
  dateFrom,
  dateTo,
}: CampaignDetailDialogProps) {
  const { t } = useTranslation("dashboard");
  const q = useQuery({
    queryKey: ["campaign-detail", campaignName, dateFrom, dateTo],
    queryFn: () =>
      dashboardApi.campaignDetail({
        date_from: dateFrom,
        date_to: dateTo,
        campaign_name: campaignName!,
        top_n: 10,
      }),
    enabled: open && !!campaignName,
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  // Hesaplanmış metrikler
  const spend = toNumber(data?.ad_metrics.spend) ?? 0;
  const adRevenue = toNumber(data?.ad_metrics.conversions_value) ?? 0;
  const impressions = toNumber(data?.ad_metrics.impressions) ?? 0;
  const clicks = toNumber(data?.ad_metrics.clicks) ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const roas = spend > 0 ? adRevenue / spend : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="border-b border-border/60 bg-surface-2 px-6 pt-6 pb-5">
          <DialogTitle className="flex items-center gap-3 pr-10">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Package className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold tracking-tight">
                  {campaignName ?? t("campaign_detail.title_default")}
                </span>
                {data?.platform && (
                  <Badge
                    variant="outline"
                    className="capitalize text-[10px] px-1.5 py-0"
                  >
                    {data.platform}
                  </Badge>
                )}
              </span>
              <DialogDescription className="inline-flex items-center gap-1.5 text-xs">
                <CalendarDays className="size-3 shrink-0" />
                {dayjs(dateFrom).format("DD MMM YYYY")}
                {" – "}
                {dayjs(dateTo).format("DD MMM YYYY")}
              </DialogDescription>
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-text-muted" />
          </div>
        ) : !data ? (
          <p className="py-16 text-center text-sm text-text-muted">
            {t("campaign_detail.data_unavailable")}
          </p>
        ) : (
          <div className="min-w-0 space-y-7 px-6 py-6">
            {/* Reklam performansı */}
            <Section title={t("campaign_detail.section_ad_performance")}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatTile
                  icon={Eye}
                  label={t("kpi.impressions")}
                  value={formatCount(impressions)}
                />
                <StatTile
                  icon={MousePointerClick}
                  label={t("kpi.clicks")}
                  value={formatCount(clicks)}
                />
                <StatTile
                  icon={Percent}
                  label={t("kpi.ctr")}
                  value={ctr !== null ? formatPercent(ctr, 2) : "—"}
                />
                <StatTile
                  icon={Wallet}
                  label={t("kpi.cpc")}
                  value={cpc !== null ? formatCurrency(cpc) : "—"}
                />
                <StatTile
                  icon={Wallet}
                  label={t("campaign_detail.label_spend")}
                  value={formatCurrency(spend)}
                />
                <StatTile
                  icon={TrendingUp}
                  label={t("kpi.roas")}
                  value={roas !== null ? formatMultiplier(roas) : "—"}
                  tone={roas !== null && roas >= 4 ? "good" : "neutral"}
                />
              </div>
            </Section>

            {/* E-ticaret atfı */}
            <Section
              title={t("campaign_detail.section_ecom_attribution")}
              hint={t("campaign_detail.section_ecom_attribution_hint")}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  icon={ShoppingBag}
                  label={t("campaign_detail.label_orders_short")}
                  value={formatCount(data.ecom_summary.orders)}
                />
                <StatTile
                  icon={Sparkles}
                  label={t("campaign_detail.label_revenue_short")}
                  value={formatCurrency(data.ecom_summary.revenue)}
                  tone="primary"
                />
                <StatTile
                  icon={Package}
                  label={t("kpi.items_sold")}
                  value={formatCount(data.ecom_summary.items_sold)}
                />
                <StatTile
                  icon={Wallet}
                  label={t("campaign_detail.label_aov")}
                  value={
                    data.ecom_summary.aov
                      ? formatCurrency(data.ecom_summary.aov)
                      : "—"
                  }
                />
              </div>
            </Section>

            {/* Top ürünler */}
            <Section
              title={t("campaign_detail.section_top_products")}
              count={data.top_products.length}
            >
              {data.top_products.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
                  <p className="text-sm text-text-muted">
                    {t("campaign_detail.empty_top_products")}
                  </p>
                </div>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                        <ColHead className="w-10">#</ColHead>
                        <ColHead>SKU</ColHead>
                        <ColHead>{t("campaign_detail.table_product")}</ColHead>
                        <ColHead>{t("campaign_detail.table_brand")}</ColHead>
                        <ColHead>{t("campaign_detail.table_category")}</ColHead>
                        <ColHead align="right">
                          {t("campaign_detail.table_units_sold")}
                        </ColHead>
                        <ColHead align="right">
                          {t("campaign_detail.label_orders_short")}
                        </ColHead>
                        <ColHead align="right">
                          {t("campaign_detail.label_revenue_short")}
                        </ColHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_products.map((p, i) => (
                        <TableRow key={p.sku} className="border-b border-border/40 last:border-b-0">
                          <TableCell className="text-text-muted tabular-nums text-xs">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap text-text-muted">
                            {p.sku}
                          </TableCell>
                          <TableCell
                            className="max-w-[280px] truncate font-medium"
                            title={p.product_name ?? ""}
                          >
                            {p.product_name ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {p.brand ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-text-muted whitespace-nowrap">
                            {p.category ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCount(p.units_sold)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCount(p.orders)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-foreground">
                            {formatCurrency(p.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Section>

            {/* Günlük trend */}
            {data.daily_series.length > 0 && (
              <Section title={t("campaign_detail.section_daily_trend")}>
                <div className="rounded-xl border border-border bg-card p-4">
                  <LineChart
                    multiAxis
                    height={280}
                    series={[
                      {
                        name: t("campaign_detail.chart_revenue_series"),
                        data: data.daily_series.map((p) => ({
                          x: dayjs(p.date).valueOf(),
                          y: toNumber(p.revenue) ?? 0,
                        })),
                        formatter: formatCurrency,
                      },
                      {
                        name: t("kpi.ad_spend"),
                        data: data.daily_series.map((p) => ({
                          x: dayjs(p.date).valueOf(),
                          y: toNumber(p.spend) ?? 0,
                        })),
                        formatter: formatCurrency,
                      },
                    ]}
                    yFormatter={formatAxisCurrency}
                  />
                </div>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
          {title}
        </h3>
        {count !== undefined && (
          <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-text-muted">
            {count}
          </span>
        )}
        {hint && (
          <span className="text-[11px] text-text-dim">· {hint}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "neutral" | "primary" | "good";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-surface-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "good" &&
              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            tone === "neutral" && "bg-muted text-text-muted",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-2 text-[19px] font-semibold tabular-nums leading-tight tracking-tight",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ColHead({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <TableHead
      className={cn(
        "h-10 text-[11px] font-semibold uppercase tracking-wider text-text-dim",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}
