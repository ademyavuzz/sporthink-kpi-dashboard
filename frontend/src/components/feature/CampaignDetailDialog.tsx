import { useQuery } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
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
  const { t: _t } = useTranslation("common");

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
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2.5 pr-8">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-4" />
            </span>
            <span className="truncate text-base font-semibold">
              {campaignName ?? "Kampanya Detayı"}
            </span>
            {data?.platform && (
              <Badge variant="outline" className="capitalize">
                {data.platform}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="ml-[42px] text-xs">
            {dayjs(dateFrom).format("DD MMM YYYY")} –{" "}
            {dayjs(dateTo).format("DD MMM YYYY")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : !data ? (
          <p className="text-sm text-text-muted py-12 text-center">
            Veri yüklenemedi.
          </p>
        ) : (
          <div className="space-y-6 px-6 py-6 min-w-0">
            {/* Ad metrics row */}
            <Section title="Reklam Performansı">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Gösterim" value={formatCount(impressions)} />
                <Stat label="Tıklama" value={formatCount(clicks)} />
                <Stat label="CTR" value={ctr !== null ? formatPercent(ctr, 2) : "—"} />
                <Stat label="CPC" value={cpc !== null ? formatCurrency(cpc) : "—"} />
                <Stat label="Harcama" value={formatCurrency(spend)} />
                <Stat
                  label="ROAS"
                  value={roas !== null ? formatMultiplier(roas) : "—"}
                  highlight={roas !== null && roas >= 4}
                />
              </div>
            </Section>

            {/* E-com summary row */}
            <Section
              title="E-Ticaret Atfı"
              hint="orders.campaign_name eşleşmeleri"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Sipariş"
                  value={formatCount(data.ecom_summary.orders)}
                />
                <Stat
                  label="Ciro"
                  value={formatCurrency(data.ecom_summary.revenue)}
                />
                <Stat
                  label="Satılan Ürün"
                  value={formatCount(data.ecom_summary.items_sold)}
                />
                <Stat
                  label="Ortalama Sepet"
                  value={
                    data.ecom_summary.aov
                      ? formatCurrency(data.ecom_summary.aov)
                      : "—"
                  }
                />
              </div>
            </Section>

            {/* Top products */}
            <Section
              title="En Çok Satan Ürünler"
              count={data.top_products.length}
            >
              {data.top_products.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
                  <p className="text-sm text-text-muted">
                    Bu kampanyaya atfedilen sipariş yok.
                  </p>
                </div>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-xl border border-border/60 bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-surface-2 hover:bg-surface-2">
                        <TableHead className="w-10 text-[11px] uppercase tracking-wider text-text-dim">
                          #
                        </TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                          SKU
                        </TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                          Ürün
                        </TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                          Marka
                        </TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-text-dim">
                          Kategori
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-text-dim">
                          Adet
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-text-dim">
                          Sipariş
                        </TableHead>
                        <TableHead className="text-right text-[11px] uppercase tracking-wider text-text-dim">
                          Ciro
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_products.map((p, i) => (
                        <TableRow key={p.sku}>
                          <TableCell className="text-text-muted tabular-nums text-xs">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {p.sku}
                          </TableCell>
                          <TableCell
                            className="max-w-[280px] truncate"
                            title={p.product_name ?? ""}
                          >
                            {p.product_name ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
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
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatCurrency(p.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Section>

            {/* Daily trend */}
            {data.daily_series.length > 0 && (
              <Section title="Günlük Harcama vs Gelir Trendi">
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <LineChart
                    multiAxis
                    height={280}
                    series={[
                      {
                        name: "Ciro (E-ticaret)",
                        data: data.daily_series.map((p) => ({
                          x: dayjs(p.date).valueOf(),
                          y: toNumber(p.revenue) ?? 0,
                        })),
                        formatter: formatCurrency,
                      },
                      {
                        name: "Reklam Harcaması",
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
    <section className="space-y-3 min-w-0">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-text-muted">
            ({count})
          </span>
        )}
        {hint && <span className="text-[11px] text-text-dim">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[19px] font-semibold tabular-nums leading-tight tracking-tight",
          highlight && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}
