import { useQuery } from "@tanstack/react-query";
import { MapPin, Radio, Smartphone, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/feature/ChartCard";
import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatAxisNumber, toNumber } from "@/lib/format";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

/**
 * Trafik (GA4) sayfasi. 7 trafik KPI'si, gunluk oturum trendi, kanal/cihaz
 * kirilimleri ve sehir bazli trafik tablosu.
 */
export default function TrafficPage() {
  const { t } = useTranslation("dashboard");
  const [range, setRange] = useDashboardRange();
  const q = useQuery({
    queryKey: ["dashboard", "traffic", range.date_from, range.date_to],
    queryFn: () =>
      dashboardApi.traffic({
        date_from: range.date_from,
        date_to: range.date_to,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const data = q.data;
  const isLoading = q.isPending;
  const sessionsLabel = t("traffic.series_sessions");
  const fmtSessions = (v: number) =>
    `${formatAxisNumber(v)} ${t("traffic.value_sessions_suffix")}`;

  return (
    <PageShell>
      <DashboardHeader title={t("traffic.title")} range={range} onChangeRange={setRange} />

      {/* Trafik KPI'lari */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {isLoading || !data
          ? Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} compact />)
          : (
              <>
                <KPICard kpi={data.sessions} compact />
                <KPICard kpi={data.users} compact />
                <KPICard kpi={data.new_users} compact />
                <KPICard kpi={data.bounce_rate} compact />
                <KPICard kpi={data.pages_per_session} compact />
                <KPICard kpi={data.avg_session_duration} compact />
                <KPICard kpi={data.conversion_rate} compact />
              </>
            )}
      </div>

      {/* Gunluk oturum trendi */}
      <ChartCard
        title={t("traffic.trend_card_title")}
        hint={t("traffic.trend_hint")}
        icon={TrendingUp}
      >
        <LineChart
          loading={isLoading}
          series={
            data
              ? [
                  {
                    name: sessionsLabel,
                    color: "#2563eb",
                    data: data.daily_series.map((p) => ({
                      x: dayjs(p.date).valueOf(),
                      y: p.sessions,
                    })),
                  },
                ]
              : []
          }
          yFormatter={formatAxisNumber}
        />
      </ChartCard>

      {/* Kanal + Cihaz kirilimi */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("traffic.by_channel_card_title")}
          hint={t("traffic.by_channel_hint")}
          icon={Radio}
        >
          <BarChart
            loading={isLoading}
            horizontal
            categories={data ? data.by_channel.map((c) => c.label ?? "Diğer") : []}
            series={
              data
                ? [
                    {
                      name: sessionsLabel,
                      data: data.by_channel.map((c) => toNumber(c.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={fmtSessions}
          />
        </ChartCard>

        <ChartCard
          title={t("traffic.by_device_card_title")}
          hint={t("traffic.by_device_hint")}
          icon={Smartphone}
        >
          <BarChart
            loading={isLoading}
            categories={data ? data.by_device.map((d) => d.label ?? "Diğer") : []}
            series={
              data
                ? [
                    {
                      name: sessionsLabel,
                      data: data.by_device.map((d) => toNumber(d.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={fmtSessions}
          />
        </ChartCard>
      </div>

      {/* Sehir bazli trafik */}
      <ChartCard
        title={t("traffic.by_city_card_title")}
        hint={t("traffic.by_city_hint")}
        icon={MapPin}
      >
        <BarChart
          loading={isLoading}
          horizontal
          height={420}
          categories={data ? data.by_city.map((c) => c.label ?? "Diğer") : []}
          series={
            data
              ? [
                  {
                    name: sessionsLabel,
                    data: data.by_city.map((c) => toNumber(c.value) ?? 0),
                  },
                ]
              : []
          }
          valueFormatter={fmtSessions}
        />
      </ChartCard>
    </PageShell>
  );
}
