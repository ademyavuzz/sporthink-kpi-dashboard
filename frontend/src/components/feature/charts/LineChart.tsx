import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";
import ReactApexChart from "react-apexcharts";

import { useChartTheme } from "@/hooks/useChartTheme";
import { dayjs } from "@/lib/dayjs";

import { ChartEmpty, ChartLoading } from "./ChartEmpty";

interface LineSeries {
  name: string;
  /** [{x: timestamp_ms, y: number}] */
  data: { x: number; y: number }[];
  /** Bu seri için custom renk (override). */
  color?: string;
  /** Y ekseninde 2 farklı seri varsa hangi tarafı kullanacağı (revenue=left, count=right). */
  yAxisIndex?: number;
  /** Bu seri için custom format (currency vs count). */
  formatter?: (v: number) => string;
}

interface LineChartProps {
  series: LineSeries[];
  height?: number;
  /** Tek y-axis için fallback formatter. */
  yFormatter?: (v: number) => string;
  /** Birden fazla y-axis (örn. revenue ₺ + sipariş adet). */
  multiAxis?: boolean;
  loading?: boolean;
}

/**
 * Çok-serili area/line chart — datetime x-axis, TR locale tooltip.
 *
 * Özellikler:
 * - Multi-axis support (revenue ₺ + count adet aynı chart'ta)
 * - Per-series custom color + formatter
 * - Smart tick density (180+ gün için weekly tick)
 * - Hover marker, gradient fill
 * - Crosshair (tüm seriler tek dikey çizgide hizalanır)
 */
export function LineChart({
  series,
  height = 320,
  yFormatter,
  multiAxis,
  loading,
}: LineChartProps) {
  const base = useChartTheme();

  const options = useMemo<ApexOptions>(() => {
    const colors = series.map((s, i) => s.color ?? (base.colors as string[])[i]);

    // Multi-axis: her seri için ayrı yaxis tanımı, sağ/sol konum.
    // Axis title yazılmaz — legend zaten seri adlarını gösteriyor; duplicate
    // olmasın diye axis border/tick renksiz tutulur, sadece label rengi
    // serinin kendi rengiyle hizalanır.
    const yaxis: ApexOptions["yaxis"] = multiAxis
      ? series.map((s, i) => ({
          ...base.yaxis,
          seriesName: s.name,
          opposite: (s.yAxisIndex ?? i) % 2 === 1,
          tickAmount: 5,
          labels: {
            ...((base.yaxis as { labels?: object })?.labels ?? {}),
            formatter: s.formatter ?? yFormatter,
            style: {
              colors: colors[i],
              fontSize: "11px",
              fontWeight: 500,
            },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        }))
      : {
          ...base.yaxis,
          tickAmount: 5,
          labels: {
            ...((base.yaxis as { labels?: object })?.labels ?? {}),
            formatter: yFormatter,
          },
        };

    return {
      ...base,
      chart: {
        ...base.chart,
        type: "area",
        height,
        toolbar: { show: false },
        parentHeightOffset: 0,
      },
      colors,
      xaxis: {
        ...base.xaxis,
        type: "datetime",
        tickAmount: 6,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          ...((base.xaxis as { labels?: object })?.labels ?? {}),
          formatter: (val: string | number) => dayjs(Number(val)).format("DD MMM"),
        },
      },
      yaxis,
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.18,
          opacityTo: 0,
          stops: [0, 100],
        },
      },
      stroke: { ...base.stroke, width: 2.25, curve: "smooth" },
      markers: { ...base.markers, size: 0, hover: { size: 5 } },
      tooltip: {
        ...base.tooltip,
        x: {
          formatter: (val: number) => dayjs(val).format("DD MMM YYYY (dddd)"),
        },
        y: multiAxis
          ? series.map((s) => ({
              formatter: s.formatter ?? yFormatter,
            }))
          : yFormatter
            ? { formatter: yFormatter }
            : undefined,
      },
    };
  }, [base, height, multiAxis, series, yFormatter]);

  if (loading) return <ChartLoading height={height} />;

  const totalPoints = series.reduce((sum, s) => sum + s.data.length, 0);
  if (totalPoints === 0) return <ChartEmpty height={height} />;

  return <ReactApexChart options={options} series={series} type="area" height={height} />;
}
