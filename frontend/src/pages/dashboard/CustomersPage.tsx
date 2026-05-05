import { useQuery } from "@tanstack/react-query";
import { Mail, MailX } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DateRangePicker,
  computePresetRange,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { ChartEmpty, ChartLoading } from "@/components/feature/charts/ChartEmpty";
import { DonutChart } from "@/components/feature/charts/DonutChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { formatCount, formatCurrency, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const GENDER_LABEL: Record<string, string> = {
  male: "Erkek",
  female: "Kadın",
  unknown: "Bilinmiyor",
};

const AGE_LABEL: Record<string, string> = {
  unknown: "Bilinmiyor",
};

export default function CustomersPage() {
  const { t } = useTranslation(["dashboard", "common"]);

  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2024-10-01",
    date_to: "2025-03-31",
  }));

  const q = useQuery({
    queryKey: [
      "dashboard",
      "customers",
      range.date_from,
      range.date_to,
    ],
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
    () => data?.by_gender.map((b) => GENDER_LABEL[b.label ?? "unknown"] ?? b.label ?? "—") ?? [],
    [data],
  );
  const genderValues = useMemo(
    () => data?.by_gender.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );

  const ageLabels = useMemo(
    () => data?.by_age_group.map((b) => AGE_LABEL[b.label ?? ""] ?? b.label ?? "—") ?? [],
    [data],
  );
  const ageValues = useMemo(
    () => data?.by_age_group.map((b) => Number(toNumber(b.value) ?? 0)) ?? [],
    [data],
  );

  const cityLabels = useMemo(
    () => data?.by_city.map((b) => b.label ?? "—") ?? [],
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
    <div className="container mx-auto max-w-[1400px] space-y-6 px-6 py-6">
      <PageHeader
        title={t("dashboard:customers.title")}
        subtitle={`${dayjs(range.date_from).format("DD.MM.YYYY")} – ${dayjs(range.date_to).format("DD.MM.YYYY")}`}
        actions={
          <>
            <PresetButton
              onClick={() =>
                setRange({ preset: "last_30", ...computePresetRange("last_30") })
              }
            >
              {t("dashboard:customers.preset_last_30")}
            </PresetButton>
            <PresetButton
              onClick={() =>
                setRange({
                  preset: "custom",
                  date_from: "2024-10-01",
                  date_to: "2025-03-31",
                })
              }
            >
              {t("dashboard:customers.preset_all")}
            </PresetButton>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />

      {/* KPI grid: 2 / 3 / 6 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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

      {/* Yeni müşteri trendi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard:customers.new_customer_trend")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ChartLoading height={280} />
          ) : !data || data.daily_new_customers.length === 0 ? (
            <ChartEmpty height={280} />
          ) : (
            <LineChart
              height={280}
              series={[
                {
                  name: t("dashboard:customers.new_customers_label"),
                  data: data.daily_new_customers.map((p) => ({
                    x: dayjs(p.date).valueOf(),
                    y: p.new_customers,
                  })),
                  formatter: formatCount,
                },
              ]}
              yFormatter={(v) => formatCount(v)}
            />
          )}
        </CardContent>
      </Card>

      {/* Cinsiyet + Yaş */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:customers.by_gender")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              labels={genderLabels}
              values={genderValues}
              loading={loading}
              height={300}
              totalLabel={t("dashboard:customers.total")}
              valueFormatter={(v) => formatCount(v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:customers.by_age_group")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={ageLabels}
              series={[
                {
                  name: t("dashboard:customers.customers_label"),
                  data: ageValues,
                },
              ]}
              loading={loading}
              height={300}
              valueFormatter={(v) => formatCount(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Şehir + Sipariş frekansı */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:customers.by_city")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={cityLabels}
              series={[
                {
                  name: t("dashboard:customers.customers_label"),
                  data: cityValues,
                },
              ]}
              loading={loading}
              horizontal
              height={340}
              valueFormatter={(v) => formatCount(v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard:customers.order_frequency")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={freqLabels}
              series={[
                {
                  name: t("dashboard:customers.customers_label"),
                  data: freqValues,
                },
              ]}
              loading={loading}
              height={340}
              valueFormatter={(v) => formatCount(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Newsletter karşılaştırması */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard:customers.newsletter_compare_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl border border-border/60 bg-muted/30 animate-pulse"
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
        </CardContent>
      </Card>

      {/* Top 20 müşteri tablosu */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard:customers.top_customers_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[60px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[200px]" />
                <col className="w-[100px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="border-b border-border bg-surface-2 hover:bg-surface-2">
                  <TableHead className="px-4 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    #
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:customers.col_customer")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:customers.col_city")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:customers.col_demographics")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:customers.col_orders")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:customers.col_revenue")}
                  </TableHead>
                  <TableHead className="px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim">
                    {t("dashboard:customers.col_last_order")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="px-4 py-3.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !data || data.top_customers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-sm text-text-muted"
                    >
                      {t("dashboard:customers.empty_top")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.top_customers.map((c, i) => (
                    <TableRow
                      key={c.customer_id}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        i % 2 === 1 && "bg-surface-2/40",
                        "hover:bg-primary/[0.04]",
                      )}
                    >
                      <TableCell className="px-4 py-3.5 text-sm font-semibold tabular-nums text-text-muted">
                        {i + 1}
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {c.customer_name ?? "—"}
                        </div>
                        <div className="font-mono text-[11px] text-text-dim">
                          {c.customer_id}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-sm text-text-muted">
                        {c.city ?? <span className="text-text-dim">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-xs text-text-muted">
                        {[
                          c.gender ? GENDER_LABEL[c.gender] ?? c.gender : null,
                          c.age_group,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
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
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PresetButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-muted hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

function NewsletterCompareCard({ data }: { data: import("@/types/dashboard").NewsletterCompare }) {
  const { t } = useTranslation("dashboard");
  const Icon = data.is_subscriber ? Mail : MailX;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
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
      <div className="flex-1 min-w-0">
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
            <p className="text-[10px] uppercase tracking-wide text-text-dim">
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

