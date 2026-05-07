import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface State {
  hasError: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
function ChartErrorFallback({ height }: { height?: number }) {
  const { t } = useTranslation("errors");
  return (
    <div
      style={{ height: height ?? 300 }}
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-text-muted"
    >
      <AlertTriangle className="h-6 w-6 opacity-40" />
      <p className="text-xs">{t("chart_render_failed")}</p>
    </div>
  );
}

/**
 * Tek bir chart için error boundary.
 *
 * `react-apexcharts`'in StrictMode + remount yarışında zaman zaman
 * `Cannot read properties of undefined (reading 'node')` /
 * `beforeMount` hataları fırlattığı bilinmektedir. Bu hatalar
 * chart'ı çevreleyen tüm sayfanın çökmesine sebep olur — bu boundary
 * hatayı izole edip sadece chart yerine kibar bir mesaj gösterir.
 */
export class ChartErrorBoundary extends Component<
  { children: ReactNode; height?: number },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Vite prod build esbuild.drop ile production bundle'dan strip eder.
    console.warn("Chart render error (isolated):", error.message);
  }

  render() {
    if (this.state.hasError) {
      return <ChartErrorFallback height={this.props.height} />;
    }
    return this.props.children;
  }
}
