import { useQuery } from "@tanstack/react-query";

import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
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
  formatAxisNumber,
  formatCount,
  formatCurrency,
  toNumber,
} from "@/lib/format";

import { DashboardHeader, useDashboardRange } from "./_shared";

export default function EcommercePage() {
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "ecom", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.ecom({ date_from: range.date_from, date_to: range.date_to }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  return (
    <div className="space-y-6">
      <DashboardHeader title="E-Ticaret" range={range} onChangeRange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
              <>
                <KPICard kpi={data.revenue} compact />
                <KPICard kpi={data.orders} compact />
                <KPICard kpi={data.aov} compact />
                <KPICard kpi={data.items_sold} compact />
                <KPICard kpi={data.refund_rate} compact />
                <KPICard kpi={data.repeat_purchase_rate} compact />
                <KPICard kpi={data.revenue_per_user} compact />
              </>
            )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Günlük Ciro & Sipariş</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            loading={isLoading}
            multiAxis
            series={
              data
                ? [
                    {
                      name: "Ciro (₺)",
                      data: data.daily_series.map((p) => ({
                        x: dayjs(p.date).valueOf(),
                        y: toNumber(p.revenue) ?? 0,
                      })),
                      formatter: formatCurrency,
                    },
                    {
                      name: "Sipariş",
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Kanal Bazlı Ciro</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              loading={isLoading}
              labels={data ? data.by_channel.map((c) => c.channel ?? "Diğer") : []}
              values={
                data ? data.by_channel.map((c) => toNumber(c.revenue) ?? 0) : []
              }
              valueFormatter={formatCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yeni vs Tekrarlayan Müşteri</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              loading={isLoading}
              labels={
                data
                  ? data.new_vs_returning.map((c) =>
                      c.customer_type === "new" ? "Yeni" : "Tekrarlayan",
                    )
                  : []
              }
              values={
                data
                  ? data.new_vs_returning.map((c) => toNumber(c.revenue) ?? 0)
                  : []
              }
              valueFormatter={formatCurrency}
              totalLabel="Toplam Ciro"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>En Çok Harcayan Müşteriler (Top 20)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Müşteri ID</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Şehir</TableHead>
                  <TableHead>Cinsiyet</TableHead>
                  <TableHead>Yaş Grubu</TableHead>
                  <TableHead className="text-right">Sipariş</TableHead>
                  <TableHead className="text-right">Ciro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <div className="h-5 bg-muted rounded animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  : (data?.top_customers ?? []).map((c) => (
                      <TableRow key={c.customer_id}>
                        <TableCell className="font-mono text-xs">
                          {c.customer_id}
                        </TableCell>
                        <TableCell>{c.customer_name ?? "—"}</TableCell>
                        <TableCell>{c.city ?? "—"}</TableCell>
                        <TableCell>{c.gender ?? "—"}</TableCell>
                        <TableCell>{c.age_group ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(c.order_count)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c.revenue)}
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
