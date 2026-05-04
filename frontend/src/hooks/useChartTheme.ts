import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";

import { useThemeStore } from "@/stores/useThemeStore";

/**
 * Theme-aware chart base options — ApexCharts'a inject edilir.
 *
 * Tema değişiminde otomatik refresh için `useThemeStore` selector kullanılır;
 * memoization re-render minimumda tutar.
 *
 * Renk paleti — birbirine zıt 10 renk (overview/cohort gibi geniş paletli
 * chart'larda 8'den çok kategori olabilir):
 *   blue, emerald, amber, rose, cyan, violet, pink, slate, lime, orange.
 */
export const CHART_PALETTE = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#84cc16", // lime-500
  "#fb923c", // orange-400
  "#64748b", // slate-500
];

export function useChartTheme(): ApexOptions {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  // Theme tokenları
  const fg = isDark ? "#e4e4e7" : "#27272a";
  const fgMuted = isDark ? "#a1a1aa" : "#71717a";
  const border = isDark ? "#27272a" : "#e4e4e7";
  const borderStrong = isDark ? "#3f3f46" : "#d4d4d8";

  return useMemo<ApexOptions>(
    () => ({
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 350, animateGradually: { enabled: false } },
        background: "transparent",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        // Pan ile etkileşim açık ama toolbar gizli
        sparkline: { enabled: false },
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: CHART_PALETTE,
      grid: {
        borderColor: border,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { top: 0, right: 12, bottom: 0, left: 12 },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        style: { fontSize: "12px", fontFamily: "inherit" },
        marker: { show: true },
        fillSeriesColor: false,
        // Tüm serileri tek tooltip'te göster (multi-series için kritik)
        shared: true,
        intersect: false,
      },
      stroke: {
        width: 2.5,
        curve: "smooth",
        lineCap: "round",
      },
      markers: {
        size: 0,           // default gizli
        strokeWidth: 2,
        strokeColors: isDark ? "#0a0a0a" : "#ffffff",
        hover: { size: 6, sizeOffset: 2 },
      },
      dataLabels: { enabled: false },
      legend: {
        position: "top",
        horizontalAlign: "left",
        fontSize: "13px",
        fontWeight: 500,
        labels: { colors: fg },
        markers: { size: 8, strokeWidth: 0, offsetX: -3 },
        itemMargin: { horizontal: 10, vertical: 4 },
        offsetY: -4,
      },
      xaxis: {
        labels: {
          style: { colors: fgMuted, fontSize: "11px" },
          datetimeUTC: false,
          // Tarih label'larında otomatik atlamayı 7 gün civarında tut
          rotate: 0,
          hideOverlappingLabels: true,
        },
        axisBorder: { color: borderStrong, show: true },
        axisTicks: { color: borderStrong, show: true },
        crosshairs: {
          show: true,
          stroke: { color: borderStrong, width: 1, dashArray: 3 },
        },
      },
      yaxis: {
        labels: {
          style: { colors: fgMuted, fontSize: "11px" },
          offsetX: -8,
        },
      },
    }),
    [isDark, fg, fgMuted, border, borderStrong],
  );
}
