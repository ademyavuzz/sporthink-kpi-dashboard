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
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
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
import { formatCount, formatCurrency, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

const GENDER_LABEL: Record<string, string> = {
  male: "Erkek",
  female: "Kadın",
  unknown: "Bilinmiyor",
};

/**
 * Musteriler sayfasi. 6 musteri KPI'si, yeni musteri trendi, cinsiyet/yas/
 * sehir/frekans kirilimleri, newsletter karsilastirmasi ve top musteri tablosu.
 */
export default function CustomersPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();

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

  const genderLabels = useMemo(
    () =>
      data?.by_gender.map(
        (b) => GENDER_LABEL[b.label ?? "unknown"] ?? b.label ?? "Bilinmiyor",
      ) ?? [],
    [data],
  );
  const genderValues = useMemo(
    () => data?.by_gender.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );
  const ageLabels = useMemo(
    () => data?.by_age_group.map((b) => b.label ?? "Bilinmiyor") ?? [],
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
      <DashboardHeader
        title={t("customers.title")}
        range={range}
        onChangeRange={setRange}
      />

      {/* Musteri KPI'lari */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("customers.by_gender")}
          hint={t("customers.by_gender_hint")}
          icon={VenetianMask}
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("customers.by_city")}
          hint={t("customers.by_city_hint")}
          icon={MapPin}
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
      >
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[56px]" />
              <col />
              <col className="w-[140px]" />
              <col className="w-[200px]" />
              <col className="w-[100px]" />
              <col className="w-[140px]" />
              <col className="w-[140px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  #
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("customers.col_customer")}
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("customers.col_city")}
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("customers.col_demographics")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("customers.col_orders")}
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                  {t("customers.col_revenue")}
                </TableHead>
                <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                  {t("customers.col_last_order")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="px-4 py-3.5">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !data || data.top_customers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-text-muted"
                  >
                    {t("customers.empty_top")}
                  </TableCell>
                </TableRow>
              ) : (
                data.top_customers.map((c, i) => (
                  <TableRow
                    key={c.customer_id}
                    className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]"
                  >
                    <TableCell className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums",
                          i < 3
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-text-muted",
                        )}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-3.5">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {c.customer_name ?? "-"}
                      </div>
                      <div className="font-mono text-[11px] text-text-dim">
                        {c.customer_id}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                      {c.city ?? <span className="text-text-dim">-</span>}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-xs text-text-muted">
                      {[
                        c.gender ? (GENDER_LABEL[c.gender] ?? c.gender) : null,
                        c.age_group,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm">
                      {formatCount(c.total_orders)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-right tabular-nums text-sm font-semibold text-foreground">
                      {formatCurrency(c.total_revenue)}
                    </TableCell>
                    <TableCell className="px-3 py-3.5 text-xs text-text-muted">
                      {c.last_order_date
                        ? dayjs(c.last_order_date).format("DD.MM.YYYY")
                        : "-"}
                    </TableCell>
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
