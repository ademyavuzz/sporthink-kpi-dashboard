import { useQuery } from "@tanstack/react-query";

import { KPICard, KPICardSkeleton } from "@/components/feature/KPICard";
import { BarChart } from "@/components/feature/charts/BarChart";
import { LineChart } from "@/components/feature/charts/LineChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/lib/api/dashboard";
import { dayjs } from "@/lib/dayjs";
import { formatAxisNumber, toNumber } from "@/lib/format";

import { DashboardHeader, PageShell, useDashboardRange } from "./_shared";

export default function TrafficPage() {
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

  return (
    <PageShell>
      <DashboardHeader title="Trafik (GA4)" range={range} onChangeRange={setRange} />

      {/* 7 KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <KPICardSkeleton key={i} />)
          : data && (
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

      <Card>
        <CardHeader>
          <CardTitle>Günlük Oturum Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            loading={isLoading}
            series={
              data
                ? [
                    {
                      name: "Oturum",
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kanal Dağılımı (Oturum)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              loading={isLoading}
              horizontal
              categories={data ? data.by_channel.map((c) => c.label ?? "—") : []}
              series={
                data
                  ? [
                      {
                        name: "Oturum",
                        data: data.by_channel.map((c) => toNumber(c.value) ?? 0),
                      },
                    ]
                  : []
              }
              valueFormatter={(v) => `${formatAxisNumber(v)} oturum`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cihaz Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              loading={isLoading}
              categories={data ? data.by_device.map((d) => d.label ?? "—") : []}
              series={
                data
                  ? [
                      {
                        name: "Oturum",
                        data: data.by_device.map((d) => toNumber(d.value) ?? 0),
                      },
                    ]
                  : []
              }
              valueFormatter={(v) => `${formatAxisNumber(v)} oturum`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Şehir Bazlı Trafik (Top 15)</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            loading={isLoading}
            horizontal
            height={420}
            categories={data ? data.by_city.map((c) => c.label ?? "—") : []}
            series={
              data
                ? [
                    {
                      name: "Oturum",
                      data: data.by_city.map((c) => toNumber(c.value) ?? 0),
                    },
                  ]
                : []
            }
            valueFormatter={(v) => `${formatAxisNumber(v)} oturum`}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
