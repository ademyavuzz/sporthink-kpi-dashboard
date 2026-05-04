import { useQuery } from "@tanstack/react-query";

import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { LineChart } from "@/components/feature/charts/LineChart";
import { Badge } from "@/components/ui/badge";
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
  formatMultiplier,
  formatPercent,
  toNumber,
} from "@/lib/format";

import { DashboardHeader, useDashboardRange } from "./_shared";

export default function MetaAdsPage() {
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "meta", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.meta({ date_from: range.date_from, date_to: range.date_to }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  return (
    <div className="space-y-6">
      <DashboardHeader title="Meta Ads" range={range} onChangeRange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.ad_spend} compact />
                <KPICard kpi={data.impressions} compact />
                <KPICard kpi={data.clicks} compact />
                <KPICard kpi={data.ctr} compact />
                <KPICard kpi={data.cpc} compact />
                <KPICard kpi={data.ad_conversions} compact />
                <KPICard kpi={data.roas} compact />
                <KPICard kpi={data.frequency} compact />
              </>
            )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Günlük Harcama vs Gelir</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            loading={isLoading}
            multiAxis
            series={
              data
                ? [
                    {
                      name: "Reklam Geliri",
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
                  ]
                : []
            }
            yFormatter={formatAxisCurrency}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kampanyalar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kampanya</TableHead>
                  <TableHead className="text-right">Gösterim</TableHead>
                  <TableHead className="text-right">Tıklama</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Harcama</TableHead>
                  <TableHead className="text-right">Dönüşüm</TableHead>
                  <TableHead className="text-right">Gelir</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9}>
                          <div className="h-5 bg-muted rounded animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  : (data?.campaigns ?? []).map((c) => (
                      <TableRow key={c.campaign_id}>
                        <TableCell className="max-w-[280px] truncate" title={c.campaign_name ?? ""}>
                          {c.campaign_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(c.impressions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(c.clicks)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.ctr ? formatPercent(toNumber(c.ctr)! * 100, 2) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c.cpc)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c.spend)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(c.conversions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c.conversions_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              toNumber(c.roas) && toNumber(c.roas)! >= 4
                                ? "default"
                                : "secondary"
                            }
                          >
                            {formatMultiplier(c.roas)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
