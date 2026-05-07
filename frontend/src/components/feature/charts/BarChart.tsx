import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";
import { ApexChart } from "./ApexChart";

import { useChartTheme } from "@/hooks/useChartTheme";

import { ChartEmpty, ChartLoading } from "./ChartEmpty";
import { ChartErrorBoundary } from "./ChartErrorBoundary";

interface BarChartProps {
  categories: string[];
  series: { name: string; data: number[] }[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (v: number) => string;
  loading?: boolean;
  /** Bar üstünde değer etiketi göster (default: yatay bar'da true). */
  showValueLabel?: boolean;
  /** Birden fazla seri varsa serileri üst üste stack et. */
  stacked?: boolean;
}

/**
 * Yatay/dikey bar chart — uzun label truncate, akıllı bar genişliği,
 * value label opsiyonu.
 */
export function BarChart({
  categories,
  series,
  height = 320,
  horizontal = false,
  valueFormatter,
  loading,
  showValueLabel,
  stacked,
}: BarChartProps) {
  const base = useChartTheme();
  // Yatay bar'da sayı etiketi göstermek varsayılan.
  const showLabel = showValueLabel ?? horizontal;

  // Uzun label'ları truncate (yatay bar'da y axis label'ı 28 karakter sınırı)
  const truncatedCategories = useMemo(
    () =>
      categories.map((c) =>
        horizontal && c.length > 28 ? `${c.slice(0, 26)}…` : c,
      ),
    [categories, horizontal],
  );

  // Akıllı yükseklik: yatay bar'da kategori başına min 32px
  const computedHeight = useMemo(() => {
    if (!horizontal) return height;
    const min = Math.max(height, categories.length * 32 + 60);
    return Math.min(min, 600);
  }, [height, horizontal, categories.length]);

  const options = useMemo<ApexOptions>(
    () => ({
      ...base,
      chart: { ...base.chart, type: "bar", height: computedHeight, stacked },
      plotOptions: {
        bar: {
          horizontal,
          borderRadius: 6,
          borderRadiusApplication: "end",
          columnWidth: "55%",
          barHeight: horizontal ? "70%" : undefined,
          dataLabels: { position: horizontal ? "top" : "top" },
        },
      },
      stroke: { show: true, width: 2, colors: ["transparent"] },
      dataLabels: {
        enabled: showLabel,
        formatter: (val: number) =>
          valueFormatter ? valueFormatter(val) : val.toLocaleString("tr-TR"),
        style: { fontSize: "11px", fontWeight: 600, colors: ["#52525b"] },
        offsetX: horizontal ? 28 : 0,
        offsetY: horizontal ? 0 : -20,
      },
      xaxis: {
        ...base.xaxis,
        categories: truncatedCategories,
        labels: {
          ...((base.xaxis as { labels?: object })?.labels ?? {}),
          formatter:
            horizontal && valueFormatter
              ? (val: string) => valueFormatter(Number(val))
              : undefined,
          rotate: horizontal ? 0 : -25,
          rotateAlways: !horizontal && categories.some((c) => c.length > 8),
          hideOverlappingLabels: true,
          trim: !horizontal,
          maxHeight: 80,
        },
      },
      yaxis: {
        ...base.yaxis,
        labels: {
          ...((base.yaxis as { labels?: object })?.labels ?? {}),
          formatter:
            !horizontal && valueFormatter
              ? (val: number) => valueFormatter(val)
              : undefined,
          maxWidth: horizontal ? 220 : undefined,
        },
      },
      grid: {
        ...base.grid,
        xaxis: { lines: { show: horizontal } },
        yaxis: { lines: { show: !horizontal } },
      },
      tooltip: {
        ...base.tooltip,
        y: valueFormatter ? { formatter: valueFormatter } : undefined,
        // Uzun label'larda full ad'ı tooltip'te göster
        x: { show: true },
      },
      legend: {
        ...base.legend,
        // Tek seri ise legend gerek yok
        show: series.length > 1,
      },
    }),
    [
      base,
      computedHeight,
      horizontal,
      truncatedCategories,
      categories,
      valueFormatter,
      showLabel,
      series.length,
      stacked,
    ],
  );

  if (loading) return <ChartLoading height={height} />;
  if (
    categories.length === 0 ||
    series.every((s) => s.data.length === 0 || s.data.every((v) => v === 0))
  ) {
    return <ChartEmpty height={height} />;
  }

  return (
    <ChartErrorBoundary height={computedHeight}>
      <ApexChart
        options={options}
        series={series}
        type="bar"
        height={computedHeight}
      />
    </ChartErrorBoundary>
  );
}
