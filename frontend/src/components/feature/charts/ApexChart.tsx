import { useEffect, useRef } from "react";
import ApexCharts from "apexcharts";
import type { ApexOptions } from "apexcharts";

type ChartType = NonNullable<NonNullable<ApexOptions["chart"]>["type"]>;
type Series = ApexAxisChartSeries | ApexNonAxisChartSeries;

interface ApexChartProps {
  options: ApexOptions;
  series: Series;
  type: ChartType;
  height?: number | string;
  width?: number | string;
}

/**
 * React 19 + StrictMode uyumlu ApexCharts wrapper'ı.
 *
 * `react-apexcharts@1.7.0` ve doğrudan `apexcharts@4` her ikisi de StrictMode
 * dev-mode'unun zorunlu mount→cleanup→mount döngüsünde patlar:
 * - `chart.render()` Promise'i 1. mount'tan kalır
 * - cleanup `destroy()` çağırır
 * - Promise sonradan resolve olunca `globals.dom.Paper.node` undefined olur
 * - synchronous TypeError → unhandled `pageerror`
 *
 * Çözüm: chart yaratmayı `requestAnimationFrame` ile bir frame ertele.
 * StrictMode'un synchronous double-cycle'ı ilk frame'den önce tamamlanır,
 * böylece chart yalnızca ikinci (gerçek) mount'ta yaratılır.
 */
export function ApexChart({ options, series, type, height, width }: ApexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ApexCharts | null>(null);

  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) return;
      const chart = new ApexCharts(containerRef.current, {
        ...options,
        series,
        chart: { ...options.chart, type, height, width },
      });
      chartRef.current = chart;
      chart.render().catch(() => {
        // DOM zaten sökülmüşse render reject olur — boundary göstermesin
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const instance = chartRef.current;
      chartRef.current = null;
      if (!instance) return;
      try {
        instance.destroy();
      } catch {
        // İkinci unmount'ta chart yıkılmış olabilir; sessiz geç
      }
    };
    // Chart yalnızca mount'ta yaratılır; sonraki güncellemeler aşağıdaki
    // effect'ler ile updateOptions / updateSeries üzerinden yapılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      chart.updateOptions(
        { ...options, chart: { ...options.chart, type, height, width } },
        false,
        true,
        false
      );
    } catch {
      // Update sırasında DOM kaybolursa sessiz geç
    }
  }, [options, type, height, width]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      chart.updateSeries(series, false);
    } catch {
      // ignore
    }
  }, [series]);

  return <div ref={containerRef} />;
}
