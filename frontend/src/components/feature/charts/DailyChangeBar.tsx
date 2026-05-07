import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";
import { ApexChart } from "./ApexChart";

import { useChartTheme } from "@/hooks/useChartTheme";
import { dayjs } from "@/lib/dayjs";

import { ChartEmpty, ChartLoading } from "./ChartEmpty";

export interface DailyChangePoint {
  /** ISO tarih (YYYY-MM-DD). */
  date: string;
  /** Yüzde değişim (örn: 12.45 = +%12.45). null → bar çizilmez. */
  change_percentage: number | null;
}

interface DailyChangeBarProps {
  data: DailyChangePoint[];
  height?: number;
  loading?: boolean;
  /** Tooltip için dönem adı (örn: "Ciro değişimi"). */
  metricLabel?: string;
}

/**
 * Günlük performans değişimi (Daily Performance Change) bar chart.
 *
 * KPI 9.6.5 — ((bugün − dün) ÷ dün) × 100. Pozitif yeşil, negatif kırmızı,
 * 0 nötr. Sıfır çizgisi grid'de belirgin.
 */
export function DailyChangeBar({
  data,
  height = 240,
  loading,
  metricLabel = "Değişim",
}: DailyChangeBarProps) {
  const base = useChartTheme();

  const series = useMemo(
    () => [
      {
        name: metricLabel,
        data: data.map((p) => ({
          x: dayjs(p.date).valueOf(),
          y: p.change_percentage,
        })),
      },
    ],
    [data, metricLabel],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...base,
      chart: {
        ...base.chart,
        type: "bar",
        height,
        toolbar: { show: false },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          borderRadius: 3,
          columnWidth: "70%",
          colors: {
            ranges: [
              { from: -1000, to: -0.0001, color: "#ef4444" },
              { from: 0, to: 1000, color: "#10b981" },
            ],
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: false, width: 0 },
      legend: { show: false },
      xaxis: {
        ...base.xaxis,
        type: "datetime",
        tickAmount: 6,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          ...((base.xaxis as { labels?: object })?.labels ?? {}),
          formatter: (val: string | number) =>
            dayjs(Number(val)).format("DD MMM"),
        },
      },
      yaxis: {
        ...base.yaxis,
        labels: {
          ...((base.yaxis as { labels?: object })?.labels ?? {}),
          formatter: (v: number) => `${v.toFixed(0)}%`,
        },
      },
      grid: {
        ...base.grid,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      tooltip: {
        ...base.tooltip,
        shared: false,
        intersect: true,
        x: {
          formatter: (val: number) => dayjs(val).format("DD MMM YYYY (dddd)"),
        },
        y: {
          formatter: (v: number | null) =>
            v === null || v === undefined
              ? "—"
              : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
        },
      },
    }),
    [base, height],
  );

  if (loading) return <ChartLoading height={height} />;
  if (
    data.length === 0 ||
    data.every((p) => p.change_percentage === null)
  ) {
    return <ChartEmpty height={height} />;
  }

  return (
    <ApexChart options={options} series={series} type="bar" height={height} />
  );
}
