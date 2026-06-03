import type { ApexOptions } from "apexcharts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ApexChart } from "./ApexChart";

import { useChartTheme } from "@/hooks/useChartTheme";
import { CHART_PALETTE } from "@/hooks/useChartTheme";
import { cn } from "@/lib/utils";

import { ChartEmpty, ChartLoading } from "./ChartEmpty";
import { ChartErrorBoundary } from "./ChartErrorBoundary";

interface DonutChartProps {
  labels: string[];
  values: number[];
  height?: number;
  totalLabel?: string;
  valueFormatter?: (v: number) => string;
  loading?: boolean;
  /** %2'den küçük slice'ları "Diğer" altında topla (default: true). */
  groupSmallSlices?: boolean;
  /** Slice veya legend tıklandığında label döner; aynı label tekrar tıklanırsa null geçer (toggle). */
  onSliceClick?: (label: string | null) => void;
  /**
   * BarChart ile aynı standart cross-filter imzası — bir dilime tıklanınca
   * `label` (ham) ve `index` döner. "Diğer" dilimi ve toggle mantığı
   * `onSliceClick`'e özgüdür; `onSelect` her dilim için tetiklenir.
   */
  onSelect?: (label: string, index: number) => void;
  /** Vurgulanacak label — diğer slice'lar soluk render edilir. */
  selectedLabel?: string | null;
}

const SMALL_SLICE_THRESHOLD = 0.02; // %2

/**
 * Donut chart — center'da total + label, **sağda HTML-based custom legend**.
 *
 * ApexCharts'ın yerleşik (SVG-rendered) legend'i uzun label'larda truncate
 * eder ve wrap edemez. Bunun yerine donut'u solda küçük tutuyoruz, sağda
 * scrollable HTML <ul> render ediyoruz; her satırda renk noktası, label ve
 * yüzde aynı hizada. Mobile'da legend alta düşer.
 *
 * Props:
 * - `labels` / `values` — eşit uzunlukta dizinler.
 * - `groupSmallSlices` — %2 altı dilimleri "Diğer" altında toplar (default).
 * - `valueFormatter` — tooltip ve "Diğer" değer biçimleyicisi.
 */
export function DonutChart({
  labels,
  values,
  height = 320,
  totalLabel,
  valueFormatter,
  loading,
  groupSmallSlices = true,
  onSliceClick,
  onSelect,
  selectedLabel,
}: DonutChartProps) {
  const { t } = useTranslation("common");
  const base = useChartTheme();
  const otherLabel = t("other_bucket");
  const resolvedTotalLabel = totalLabel ?? t("total");

  const { displayLabels, displayValues } = useMemo(() => {
    if (!groupSmallSlices || values.length <= 6) {
      return { displayLabels: labels, displayValues: values };
    }
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return { displayLabels: labels, displayValues: values };

    const main: { label: string; value: number }[] = [];
    let other = 0;
    labels.forEach((label, i) => {
      const v = values[i] ?? 0;
      const ratio = v / total;
      if (ratio < SMALL_SLICE_THRESHOLD) {
        other += v;
      } else {
        main.push({ label, value: v });
      }
    });
    if (other > 0) main.push({ label: otherLabel, value: other });
    return {
      displayLabels: main.map((m) => m.label),
      displayValues: main.map((m) => m.value),
    };
  }, [labels, values, groupSmallSlices, otherLabel]);

  const total = displayValues.reduce((a, b) => a + b, 0);
  const fmt = useMemo(
    () => (v: number) =>
      valueFormatter ? valueFormatter(v) : v.toLocaleString("tr-TR"),
    [valueFormatter],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      ...base,
      chart: {
        ...base.chart,
        type: "donut",
        height,
        parentHeightOffset: 0,
        // `events` anahtarı yalnızca handler varsa eklenir; `events: undefined`
        // ApexCharts 4'te render sırasında `beforeMount` okurken patlatıyor.
        ...((onSliceClick || onSelect) && {
          events: {
            dataPointSelection: (
              _e,
              _ctx,
              config: { dataPointIndex: number },
            ) => {
              const label = displayLabels[config.dataPointIndex];
              if (!label || label === otherLabel) return;
              onSelect?.(label, config.dataPointIndex);
              onSliceClick?.(selectedLabel === label ? null : label);
            },
          },
        }),
      },
      labels: displayLabels,
      stroke: { width: 2, colors: ["transparent"] },
      // Built-in legend kapalı — kendi HTML legend'imiz var.
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: "74%",
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: "12px",
                fontWeight: 500,
                color: base.theme?.mode === "dark" ? "#a1a1aa" : "#71717a",
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
                label: resolvedTotalLabel,
                fontSize: "12px",
                fontWeight: 500,
                color: base.theme?.mode === "dark" ? "#a1a1aa" : "#71717a",
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
    }),
    [
      base,
      height,
      displayLabels,
      total,
      resolvedTotalLabel,
      fmt,
      onSliceClick,
      onSelect,
      selectedLabel,
      otherLabel,
    ],
  );

  if (loading) return <ChartLoading height={height} />;
  if (displayValues.length === 0 || displayValues.every((v) => v === 0)) {
    return <ChartEmpty height={height} />;
  }

  // % bazlı dizilim — büyükten küçüğe.
  const items = displayLabels
    .map((label, i) => {
      const v = displayValues[i] ?? 0;
      return {
        label,
        value: v,
        pct: total > 0 ? (v / total) * 100 : 0,
        color: CHART_PALETTE[i % CHART_PALETTE.length] ?? CHART_PALETTE[0]!,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  const isClickable = !!onSliceClick || !!onSelect;

  return (
    // `@container` + container queries ile dar kartlarda (örn. 1/3 genişlikte
    // Overview kanal kartı) dikey stack, geniş kartlarda (Ecommerce/Customer)
    // yan yana. Eskisi `minmax(0,180px)` ile dar kartta donut sıfıra çöküyordu.
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-[200px_1fr] @md:items-center">
        {/* Donut — sabit genişlik (kart dar olsa bile çökmez) */}
        <div className="mx-auto w-full max-w-[220px]">
          <ChartErrorBoundary height={height}>
            <ApexChart
              options={options}
              series={displayValues}
              type="donut"
              height={height}
            />
          </ChartErrorBoundary>
        </div>

        {/* HTML legend — scrollable, full-label. Stack modunda (dar kart)
         * height limit kalkar — tüm satırlar göründüğü kadar açık. */}
        <ul
          className="space-y-1.5 text-sm @md:max-h-[260px] @md:overflow-y-auto @md:pr-1"
          role="list"
        >
          {items.map((it) => {
            const dimmed =
              selectedLabel !== null &&
              selectedLabel !== undefined &&
              selectedLabel !== it.label;
            const active = selectedLabel === it.label;
            return (
              <li
                key={it.label}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors",
                  "hover:bg-surface-2/50",
                  isClickable && "cursor-pointer",
                  active && "bg-surface-2",
                  dimmed && "opacity-40",
                )}
                onClick={
                  isClickable && it.label !== otherLabel
                    ? () => {
                        onSelect?.(it.label, displayLabels.indexOf(it.label));
                        onSliceClick?.(active ? null : it.label);
                      }
                    : undefined
                }
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-foreground" title={it.label}>
                    {it.label}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2 text-xs tabular-nums">
                  <span className="font-semibold text-foreground">
                    {fmt(it.value)}
                  </span>
                  <span className="w-12 text-right text-text-muted">
                    {it.pct.toFixed(1).replace(".", ",")}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
