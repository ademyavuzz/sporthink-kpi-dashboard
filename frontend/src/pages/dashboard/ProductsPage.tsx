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

import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

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
    <PageShell>
      <DashboardHeader title="Ürün Performansı" range={range} onChangeRange={setRange} />

      <div className="grid max-w-md grid-cols-2 gap-3">
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

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>En Çok Satan Ürünler (Top 20)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[60px]" />
                <col className="w-[140px]" />
                <col />
                <col className="w-[160px]" />
                <col className="w-[110px]" />
                <col className="w-[140px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    #
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    SKU
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    Ürün
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    Marka
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    Adet
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    Ciro
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data?.top_products ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.top_products ?? []).map((p, i) => (
                    <TableRow
                      key={p.sku}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        i % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5 text-sm font-semibold tabular-nums text-text-muted">
                        {i + 1}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 font-mono text-xs text-text-muted">
                        {p.sku}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm">
                        <span
                          className="block truncate font-medium text-foreground"
                          title={p.product_name ?? ""}
                        >
                          {p.product_name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                        {p.brand ?? <span className="text-text-dim">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                        {formatCount(p.units_sold)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                        {formatCurrency(p.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
