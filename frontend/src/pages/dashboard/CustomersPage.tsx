import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Mail,
  MailX,
  MapPin,
  Repeat,
  TrendingUp,
  Trophy,
  Users,
  VenetianMask,
} from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { ExportMenu } from "@/components/feature/ExportMenu";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { ColumnSettingsMenu, ManagedColumnHeader } from "@/components/feature/table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef, useColumnManager } from "@/hooks/useColumnManager";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatCount, formatCurrency, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustomerOverviewRow } from "@/types/dashboard";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Top musteri tablosu kolon tanimlari (id = stabil localStorage anahtari).
 * Hucre ve disa aktarma erisimcileri satir + 0-tabanli siralama index'i alir
 * (sira rozeti icin gerekli).
 */
interface CustomerColumn extends ColumnDef {
  /** Kolonun colgroup genisligi. */
  width: string;
  /** Saga hizali sayisal kolon mu? */
  numeric?: boolean;
  /** Tek satir icin hucre icerigini render eder. */
  cell: (row: CustomerOverviewRow, index: number) => ReactNode;
  /** Disa aktarmada kullanilacak ham hucre degeri (formatsiz). */
  exportValue: (row: CustomerOverviewRow, index: number) => string | number | null;
}

/**
 * Musteriler sayfasi. `dashboard/customers` endpoint'i yalnizca tarih araligi
 * kabul eder (kanal/cihaz/sehir vb. cross-filter desteklenmez), bu yuzden
 * GlobalFilterBar BILEREK eklenmedi. Top musteri tablosu kolon-ozellestirilebilir
 * ve CSV/XLSX disa aktarilabilir.
 */
export default function CustomersPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

  const genderLabel = (g: string | null) =>
    t(`customers.gender_${g ?? "unknown"}`, {
      defaultValue: g ?? t("customers.gender_unknown"),
    });

  const customerColumns = useMemo<CustomerColumn[]>(
    () => [
      {
        id: "rank",
        labelKey: "customers.col_rank",
        required: true,
        width: "w-[56px]",
        cell: (_c, i) => (
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
              i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-text-muted",
            )}
          >
            {i + 1}
          </span>
        ),
        exportValue: (_c, i) => i + 1,
      },
      {
        id: "customer",
        labelKey: "customers.col_customer",
        required: true,
        width: "w-[220px]",
        cell: (c) => (
          <>
            <div className="truncate text-sm font-semibold text-foreground">
              {c.customer_name ?? "-"}
            </div>
            <div className="font-mono text-[11px] text-text-dim">{c.customer_id}</div>
          </>
        ),
        exportValue: (c) => c.customer_name ?? "-",
      },
      {
        id: "customer_id",
        labelKey: "customers.col_customer_id",
        width: "w-[140px]",
        cell: (c) => (
          <span className="font-mono text-xs text-text-muted">{c.customer_id}</span>
        ),
        exportValue: (c) => c.customer_id,
      },
      {
        id: "city",
        labelKey: "customers.col_city",
        width: "w-[140px]",
        cell: (c) =>
          c.city ? (
            <span className="text-sm text-text-muted">{c.city}</span>
          ) : (
            <span className="text-text-dim">-</span>
          ),
        exportValue: (c) => c.city,
      },
      {
        id: "gender",
        labelKey: "customers.col_gender",
        width: "w-[110px]",
        cell: (c) => (
          <span className="text-sm text-text-muted">
            {c.gender ? genderLabel(c.gender) : "-"}
          </span>
        ),
        exportValue: (c) => (c.gender ? genderLabel(c.gender) : null),
      },
      {
        id: "age_group",
        labelKey: "customers.col_age_group",
        width: "w-[110px]",
        cell: (c) => (
          <span className="text-sm text-text-muted">{c.age_group ?? "-"}</span>
        ),
        exportValue: (c) => c.age_group,
      },
      {
        id: "orders",
        labelKey: "customers.col_orders",
        width: "w-[100px]",
        numeric: true,
        cell: (c) => (
          <span className="tabular-nums text-sm">{formatCount(c.total_orders)}</span>
        ),
        exportValue: (c) => c.total_orders,
      },
      {
        id: "revenue",
        labelKey: "customers.col_revenue",
        width: "w-[140px]",
        numeric: true,
        cell: (c) => (
          <span className="tabular-nums text-sm font-semibold text-foreground">
            {formatCurrency(c.total_revenue)}
          </span>
        ),
        exportValue: (c) => toNumber(c.total_revenue),
      },
      {
        id: "last_order",
        labelKey: "customers.col_last_order",
        width: "w-[140px]",
        cell: (c) => (
          <span className="text-xs text-text-muted">
            {c.last_order_date ? dayjs(c.last_order_date).format("DD.MM.YYYY") : "-"}
          </span>
        ),
        exportValue: (c) =>
          c.last_order_date ? dayjs(c.last_order_date).format("DD.MM.YYYY") : null,
      },
    ],
    // genderLabel sadece t()'ye bagli; t referansi degisirse kolonlar yeniden kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const columns = useColumnManager("customers-top-table", customerColumns);

  const q = useQuery({
    queryKey: ["dashboard", "customers", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.customers({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const loading = q.isPending;

  const topCustomers = useMemo(() => data?.top_customers ?? [], [data]);
  const customerExportColumns = useMemo(
    () =>
      columns.visibleColumns.map((col) => ({
        header: t(col.labelKey),
        accessor: (row: CustomerOverviewRow) =>
          col.exportValue(row, topCustomers.indexOf(row)),
      })),
    [columns.visibleColumns, t, topCustomers],
  );

  const genderLabels = useMemo(
    () => data?.by_gender.map((b) => genderLabel(b.label)) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const genderValues = useMemo(
    () => data?.by_gender.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );
  const ageLabels = useMemo(
    () =>
      data?.by_age_group.map((b) => b.label ?? t("customers.gender_unknown")) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const ageValues = useMemo(
    () => data?.by_age_group.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );
  const cityLabels = useMemo(
    () => data?.by_city.map((b) => b.label ?? "-") ?? [],
    [data],
  );
  const cityValues = useMemo(
    () => data?.by_city.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );
  const freqLabels = useMemo(
    () => data?.order_frequency.map((b) => b.bucket) ?? [],
    [data],
  );
  const freqValues = useMemo(
    () => data?.order_frequency.map((b) => b.customer_count) ?? [],
    [data],
  );

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-1 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <DashboardHeader
          title={t("customers.title")}
          range={range}
          onChangeRange={setRange}
        />
      </div>

      {/* Musteri KPI'lari */}
      <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-6">
        {loading || !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} compact />)
        ) : (
          <>
            <KPICard kpi={data.total_customers} compact />
            <KPICard kpi={data.new_customers} compact />
            <KPICard kpi={data.repeat_rate} compact />
            <KPICard kpi={data.avg_customer_value} compact />
            <KPICard kpi={data.avg_orders_per_customer} compact />
            <KPICard kpi={data.newsletter_subscription_rate} compact />
          </>
        )}
      </div>

      {/* Yeni musteri trendi */}
      <ChartCard
        title={t("customers.new_customer_trend")}
        hint={t("customers.new_customer_trend_hint")}
        icon={TrendingUp}
      >
        <LineChart
          loading={loading}
          height={280}
          series={
            data
              ? [
                  {
                    name: t("customers.new_customers_label"),
                    color: "#2563eb",
                    data: data.daily_new_customers.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: p.new_customers,
                    })),
                    formatter: formatCount,
                  },
                ]
              : []
          }
          yFormatter={formatCount}
        />
      </ChartCard>

      {/* Cinsiyet + Yas */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("customers.by_gender")}
          hint={t("customers.by_gender_hint")}
          icon={VenetianMask}
          className="h-full self-stretch"
        >
          <DonutChart
            labels={genderLabels}
            values={genderValues}
            loading={loading}
            height={300}
            totalLabel={t("customers.total")}
            valueFormatter={formatCount}
          />
        </ChartCard>

        <ChartCard
          title={t("customers.by_age_group")}
          hint={t("customers.by_age_group_hint")}
          icon={Users}
          className="h-full self-stretch"
        >
          <BarChart
            categories={ageLabels}
            series={[{ name: t("customers.customers_label"), data: ageValues }]}
            loading={loading}
            height={300}
            valueFormatter={formatCount}
          />
        </ChartCard>
      </div>

      {/* Sehir + Siparis frekansi */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("customers.by_city")}
          hint={t("customers.by_city_hint")}
          icon={MapPin}
          className="h-full self-stretch"
        >
          <BarChart
            categories={cityLabels}
            series={[{ name: t("customers.customers_label"), data: cityValues }]}
            loading={loading}
            horizontal
            height={340}
            valueFormatter={formatCount}
          />
        </ChartCard>

        <ChartCard
          title={t("customers.order_frequency")}
          hint={t("customers.order_frequency_hint")}
          icon={Repeat}
          className="h-full self-stretch"
        >
          <BarChart
            categories={freqLabels}
            series={[{ name: t("customers.customers_label"), data: freqValues }]}
            loading={loading}
            height={340}
            valueFormatter={formatCount}
          />
        </ChartCard>
      </div>

      {/* Newsletter karsilastirmasi */}
      <ChartCard
        title={t("customers.newsletter_compare_title")}
        hint={t("customers.newsletter_hint")}
        icon={Mail}
      >
        {loading || !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-md border border-border/60 bg-muted/30"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.newsletter_comparison.map((c) => (
              <NewsletterCompareCard key={String(c.is_subscriber)} data={c} />
            ))}
          </div>
        )}
      </ChartCard>

      {/* Top musteriler */}
      <ChartCard
        title={t("customers.top_customers_title")}
        hint={t("customers.top_customers_hint")}
        icon={Trophy}
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={topCustomers}
              columns={customerExportColumns}
              fileBase="top-customers"
              dateFrom={range.date_from}
              dateTo={range.date_to}
              sheetName={t("customers.top_customers_title")}
            />
            <ColumnSettingsMenu manager={columns} ns="dashboard" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              {columns.visibleColumns.map((col) => (
                <col key={col.id} className={col.width} />
              ))}
            </colgroup>
            <ManagedColumnHeader
              manager={columns}
              ns="dashboard"
              headClassName={(col) => (col.numeric ? "text-right" : undefined)}
            />
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell
                      colSpan={columns.visibleColumns.length}
                      className="px-4 py-3.5"
                    >
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : topCustomers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.visibleColumns.length}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("customers.empty_top")}
                  </TableCell>
                </TableRow>
              ) : (
                topCustomers.map((c, i) => (
                  <TableRow
                    key={c.customer_id}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    {columns.visibleColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("px-3 py-3.5", col.numeric && "text-right")}
                      >
                        {col.cell(c, i)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </PageShell>
  );
}

function NewsletterCompareCard({
  data,
}: {
  data: import("@/types/dashboard").NewsletterCompare;
}) {
  const { t } = useTranslation("dashboard");
  const Icon = data.is_subscriber ? Mail : MailX;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-4",
        data.is_subscriber
          ? "border-primary/20 bg-primary/[0.04]"
          : "border-border/60 bg-card",
      )}
    >
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
          data.is_subscriber
            ? "bg-primary/15 text-primary"
            : "bg-muted text-text-muted",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
          {data.is_subscriber
            ? t("customers.newsletter_subscribed")
            : t("customers.newsletter_not_subscribed")}
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {formatCount(data.customer_count)}{" "}
          <span className="text-xs font-normal text-text-muted">
            {t("customers.customers_label")}
          </span>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-dim">
              <CalendarClock className="size-3" />
              {t("customers.avg_orders_short")}
            </p>
            <p className="font-semibold tabular-nums">
              {formatCount(data.avg_orders)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-dim">
              {t("customers.avg_revenue_short")}
            </p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(data.avg_revenue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
