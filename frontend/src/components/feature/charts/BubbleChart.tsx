import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";
import { ApexChart } from "./ApexChart";

import { useChartTheme } from "@/hooks/useChartTheme";

import { ChartEmpty, ChartLoading } from "./ChartEmpty";

export interface BubbleDatum {
  name: string;
  /** X — harcama (spend). */
  x: number;
  /** Y — ROAS. */
  y: number;
  /** Balon büyüklüğü — dönüşüm sayısı. */
  z: number;
  /** Bubble grubu (renk için). */
  group?: string;
}

export interface BubbleSeries {
  name: string;
  color?: string;
  data: BubbleDatum[];
}

interface BubbleChartProps {
  series: BubbleSeries[];
  height?: number;
  loading?: boolean;
  /** Yüksek harcama eşiği — bu ve üstü "yüksek harcama" sayılır. Verilmezse median(x). */
  highSpendThreshold?: number;
  /** Düşük ROAS eşiği — bu ve altı "düşük ROAS" sayılır. */
  lowRoasThreshold?: number;
  xFormatter?: (v: number) => string;
  yFormatter?: (v: number) => string;
  zLabel?: string;
  /** "Ölü bütçe" bölgesi etiketi. */
  deadZoneLabel?: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Bubble chart — kampanya analizi için harcama × ROAS × dönüşüm görünümü.
 *
 * "Yüksek harcama + düşük ROAS" bölgesi (ölü bütçe) kırmızı bant
 * annotation'larıyla vurgulanır. Bu bölgeye düşen baloncuklar pazarlama
 * yöneticisi için aksiyon adayıdır.
 */
export function BubbleChart({
  series,
  height = 360,
  loading,
  highSpendThreshold,
  lowRoasThreshold = 1,
  xFormatter,
  yFormatter,
  zLabel = "Dönüşüm",
  deadZoneLabel = "Ölü bütçe",
}: BubbleChartProps) {
  const base = useChartTheme();

  const allPoints = useMemo(
    () => series.flatMap((s) => s.data),
    [series],
  );

  const xMax = useMemo(() => {
    if (allPoints.length === 0) return 1;
    const m = Math.max(...allPoints.map((p) => p.x));
    return m > 0 ? m * 1.05 : 1;
  }, [allPoints]);

  const yMax = useMemo(() => {
    if (allPoints.length === 0) return Math.max(lowRoasThreshold, 1) * 2;
    const m = Math.max(...allPoints.map((p) => p.y), lowRoasThreshold);
    return m > 0 ? Math.max(m * 1.1, lowRoasThreshold * 1.5) : 1;
  }, [allPoints, lowRoasThreshold]);

  const computedHighSpend = useMemo(() => {
    if (highSpendThreshold !== undefined) return highSpendThreshold;
    return median(allPoints.map((p) => p.x));
  }, [highSpendThreshold, allPoints]);

  const options = useMemo<ApexOptions>(
    () => ({
      ...base,
      chart: {
        ...base.chart,
        type: "bubble",
        height,
        toolbar: { show: false },
      },
      colors: series.map((s, i) => s.color ?? (base.colors as string[])[i]),
      legend: {
        ...base.legend,
        show: series.length > 1,
      },
      dataLabels: { enabled: false },
      fill: {
        type: "solid",
        opacity: 0.78,
      },
      stroke: { width: 1.25, colors: ["transparent"] },
      plotOptions: {
        bubble: {
          minBubbleRadius: 6,
          maxBubbleRadius: 32,
          zScaling: true,
        },
      },
      xaxis: {
        ...base.xaxis,
        type: "numeric",
        min: 0,
        max: xMax,
        tickAmount: 6,
        labels: {
          ...((base.xaxis as { labels?: object })?.labels ?? {}),
          formatter: xFormatter
            ? (v: string | number) => xFormatter(Number(v))
            : undefined,
        },
      },
      yaxis: {
        ...base.yaxis,
        min: 0,
        max: yMax,
        tickAmount: 5,
        labels: {
          ...((base.yaxis as { labels?: object })?.labels ?? {}),
          formatter: yFormatter,
        },
      },
      grid: {
        ...base.grid,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: true } },
      },
      annotations: {
        // "Düşük ROAS" yatay bandı (ROAS < threshold).
        yaxis: [
          {
            y: 0,
            y2: lowRoasThreshold,
            fillColor: "#ef4444",
            opacity: 0.07,
            borderColor: "transparent",
          },
        ],
        // "Yüksek harcama" dikey bandı (spend ≥ threshold).
        xaxis: [
          {
            x: computedHighSpend,
            x2: xMax,
            fillColor: "#ef4444",
            opacity: 0.07,
            borderColor: "transparent",
            label: {
              text: deadZoneLabel,
              borderColor: "transparent",
              orientation: "horizontal",
              position: "top",
              offsetY: 12,
              style: {
                background: "transparent",
                color: "#ef4444",
                fontSize: "11px",
                fontWeight: 600,
              },
            },
          },
        ],
      },
      tooltip: {
        ...base.tooltip,
        shared: false,
        intersect: true,
        custom: ({
          seriesIndex,
          dataPointIndex,
          w,
        }: {
          seriesIndex: number;
          dataPointIndex: number;
          w: {
            config: { series: { name: string; data: BubbleDatum[] }[] };
            globals: { colors: string[] };
          };
        }) => {
          const s = w.config.series[seriesIndex];
          const point = s?.data[dataPointIndex];
          if (!point) return "";
          const color = w.globals.colors[seriesIndex] ?? "#3b82f6";
          const xVal = xFormatter ? xFormatter(point.x) : point.x.toString();
          const yVal = yFormatter ? yFormatter(point.y) : point.y.toString();
          return `
            <div style="padding:8px 10px;font-size:12px;min-width:180px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
                <strong style="font-weight:600">${escapeHtml(point.name)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.7">Harcama</span><span style="font-weight:600">${xVal}</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.7">ROAS</span><span style="font-weight:600">${yVal}x</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.7">${escapeHtml(zLabel)}</span><span style="font-weight:600">${point.z.toLocaleString("tr-TR")}</span></div>
            </div>
          `;
        },
      },
    }),
    [
      base,
      height,
      series,
      xMax,
      yMax,
      lowRoasThreshold,
      computedHighSpend,
      deadZoneLabel,
      xFormatter,
      yFormatter,
      zLabel,
    ],
  );

  if (loading) return <ChartLoading height={height} />;
  if (allPoints.length === 0) return <ChartEmpty height={height} />;

  // ApexCharts bubble series shape: data: [{x, y, z}, ...]
  const apexSeries = series.map((s) => ({
    name: s.name,
    data: s.data.map((d) => ({ x: d.x, y: d.y, z: d.z, name: d.name })),
  }));

  return (
    <ApexChart
      options={options}
      series={apexSeries}
      type="bubble"
      height={height}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}
