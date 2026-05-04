import { useQuery } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LineChart } from "@/components/feature/charts/LineChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {campaignName ?? "Kampanya Detayı"}
            {data?.platform && (
              <Badge variant="outline" className="capitalize ml-1">
                {data.platform}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {dayjs(dateFrom).format("DD MMM YYYY")} —{" "}
            {dayjs(dateTo).format("DD MMM YYYY")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Veri yüklenemedi.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Ad metrics row */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Reklam Performansı
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
            </div>

            {/* E-com summary row */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                E-Ticaret Atfı (orders.campaign_name)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            </div>

            {/* Top products */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                En Çok Satan Ürünler ({data.top_products.length})
              </h3>
              {data.top_products.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                  Bu kampanyaya atfedilen sipariş yok.
                </p>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Marka</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">Adet</TableHead>
                            <TableHead className="text-right">Sipariş</TableHead>
                            <TableHead className="text-right">Ciro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.top_products.map((p, i) => (
                            <TableRow key={p.sku}>
                              <TableCell className="text-muted-foreground tabular-nums text-xs">
                                {i + 1}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {p.sku}
                              </TableCell>
                              <TableCell
                                className="max-w-[280px] truncate"
                                title={p.product_name ?? ""}
                              >
                                {p.product_name ?? "—"}
                              </TableCell>
                              <TableCell>{p.brand ?? "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {p.category ?? "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCount(p.units_sold)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCount(p.orders)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {formatCurrency(p.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Daily trend */}
            {data.daily_series.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Günlük Harcama vs Gelir Trendi
                </h3>
                <Card>
                  <CardContent className="pt-4">
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
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-base font-semibold tabular-nums",
          highlight && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}
