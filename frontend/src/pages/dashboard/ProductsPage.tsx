import { useQuery } from "@tanstack/react-query";

import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
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
import {
  formatAxisCurrency,
  formatCount,
  formatCurrency,
  toNumber,
} from "@/lib/format";

import { DashboardHeader, useDashboardRange } from "./_shared";

export default function ProductsPage() {
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "products", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.products({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;

  return (
    <div className="space-y-6">
      <DashboardHeader title="Ürün Performansı" range={range} onChangeRange={setRange} />

      <div className="grid grid-cols-2 gap-3 max-w-md">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : data ? (
          <KPICard kpi={data.items_sold} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Kategori Bazlı Ciro</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              loading={isLoading}
              horizontal
              height={420}
              categories={data ? data.by_category.map((c) => c.label ?? "—") : []}
              series={
                data
                  ? [
                      {
                        name: "Ciro",
                        data: data.by_category.map((c) => toNumber(c.value) ?? 0),
                      },
                    ]
                  : []
              }
              valueFormatter={formatAxisCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marka Bazlı Ciro</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              loading={isLoading}
              horizontal
              height={420}
              categories={data ? data.by_brand.map((b) => b.label ?? "—") : []}
              series={
                data
                  ? [
                      {
                        name: "Ciro",
                        data: data.by_brand.map((b) => toNumber(b.value) ?? 0),
                      },
                    ]
                  : []
              }
              valueFormatter={formatAxisCurrency}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>En Çok Satan Ürünler (Top 20)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead className="text-right">Adet</TableHead>
                  <TableHead className="text-right">Ciro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <div className="h-5 bg-muted rounded animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  : (data?.top_products ?? []).map((p, i) => (
                      <TableRow key={p.sku}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell
                          className="max-w-[300px] truncate"
                          title={p.product_name ?? ""}
                        >
                          {p.product_name ?? "—"}
                        </TableCell>
                        <TableCell>{p.brand ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(p.units_sold)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(p.revenue)}
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
