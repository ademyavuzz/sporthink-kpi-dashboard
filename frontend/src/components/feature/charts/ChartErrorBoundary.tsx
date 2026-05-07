import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

interface State {
  hasError: boolean;
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
    console.warn("Chart render error (isolated):", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ height: this.props.height ?? 300 }}
          className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-text-muted"
        >
          <AlertTriangle className="h-6 w-6 opacity-40" />
          <p className="text-xs">Grafik render edilemedi.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
