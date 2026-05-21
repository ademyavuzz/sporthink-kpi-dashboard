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
  "#e94560", // brand rose
  "#2563eb", // blue-600
  "#12b76a", // success
  "#f79009", // amber
  "#7a5af8", // violet
  "#0891b2", // cyan
  "#64748b", // slate
  "#ec4899", // pink
  "#84cc16", // lime
  "#fb923c", // orange
];

export function useChartTheme(): ApexOptions {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  // Theme tokenları
  const fg = isDark ? "#e4e4e7" : "#27272a";
  const fgMuted = isDark ? "#a1a1aa" : "#71717a";
  const border = isDark ? "rgba(152,162,179,0.18)" : "rgba(102,112,133,0.16)";
  const borderStrong = isDark ? "rgba(152,162,179,0.34)" : "rgba(102,112,133,0.28)";

  return useMemo<ApexOptions>(
    () => ({
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 280, animateGradually: { enabled: false } },
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
        strokeDashArray: 3,
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
