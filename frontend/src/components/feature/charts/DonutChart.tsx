import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";
import ReactApexChart from "react-apexcharts";

import { useChartTheme } from "@/hooks/useChartTheme";

import { ChartEmpty, ChartLoading } from "./ChartEmpty";

interface DonutChartProps {
  labels: string[];
  values: number[];
  height?: number;
  totalLabel?: string;
  valueFormatter?: (v: number) => string;
  loading?: boolean;
  /** %2'den küçük slice'ları "Diğer" altında topla (default: true). */
  groupSmallSlices?: boolean;
}

const SMALL_SLICE_THRESHOLD = 0.02; // %2

/**
 * Donut chart — center'da total + label, sağda yüzde-yanı legend,
 * küçük slice'ları "Diğer" altında otomatik topla. Mobile'de legend alta düşer.
 */
export function DonutChart({
  labels,
  values,
  height = 320,
  totalLabel = "Toplam",
  valueFormatter,
  loading,
  groupSmallSlices = true,
}: DonutChartProps) {
  const base = useChartTheme();

  const { displayLabels, displayValues } = useMemo(() => {
    if (!groupSmallSlices || values.length <= 6) {
      return { displayLabels: labels, displayValues: values };
    }
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return { displayLabels: labels, displayValues: values };

    const main: { label: string; value: number }[] = [];
    let other = 0;
    labels.forEach((label, i) => {
      const ratio = values[i] / total;
      if (ratio < SMALL_SLICE_THRESHOLD) {
        other += values[i];
      } else {
        main.push({ label, value: values[i] });
      }
    });
    if (other > 0) main.push({ label: "Diğer", value: other });
    return {
      displayLabels: main.map((m) => m.label),
      displayValues: main.map((m) => m.value),
    };
  }, [labels, values, groupSmallSlices]);

  const total = displayValues.reduce((a, b) => a + b, 0);
  const fmt = useMemo(
    () => (v: number) =>
      valueFormatter ? valueFormatter(v) : v.toLocaleString("tr-TR"),
    [valueFormatter],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...base,
      chart: { ...base.chart, type: "donut", height },
      labels: displayLabels,
      stroke: { width: 2, colors: ["transparent"] },
      legend: {
        ...base.legend,
        position: "right",
        offsetY: 8,
        formatter: (label: string, opts) => {
          const idx = opts.seriesIndex as number;
          const val = displayValues[idx] ?? 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
          return `${label} <span style="opacity:0.6;font-size:11px">${pct}%</span>`;
        },
        markers: { size: 9, strokeWidth: 0 },
        itemMargin: { horizontal: 0, vertical: 6 },
      },
      plotOptions: {
        pie: {
          donut: {
            size: "70%",
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: "13px",
                fontWeight: 500,
                offsetY: -4,
              },
              value: {
                show: true,
                fontSize: "20px",
                fontWeight: 700,
                offsetY: 6,
                formatter: (v) => fmt(Number(v)),
              },
              total: {
                show: true,
                showAlways: true,
                label: totalLabel,
                fontSize: "12px",
                fontWeight: 500,
                formatter: () => fmt(total),
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      tooltip: {
        ...base.tooltip,
        y: {
          formatter: (v: number) => {
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
            return `${fmt(v)} (${pct}%)`;
          },
        },
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            legend: { position: "bottom", offsetY: 0 },
          },
        },
      ],
    }),
    [base, height, displayLabels, displayValues, total, totalLabel, fmt],
  );

  if (loading) return <ChartLoading height={height} />;
  if (displayValues.length === 0 || displayValues.every((v) => v === 0)) {
    return <ChartEmpty height={height} />;
  }

  return (
    <ReactApexChart
      options={options}
      series={displayValues}
      type="donut"
      height={height}
    />
  );
}
