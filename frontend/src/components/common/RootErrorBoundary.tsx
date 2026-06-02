import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface State {
  error: Error | null;
}

/** Yeni deploy sonrasi eski chunk yuklenememesinden kaynaklanan hata mi? */
function isChunkLoadError(error: Error): boolean {
  const m = (error?.message ?? "").toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("unable to preload")
  );
}

/** Sonsuz reload dongusunu engelle: 10 sn icinde ikinci kez tetiklenmesin. */
function shouldAutoReload(): boolean {
  try {
    const KEY = "sporthink_chunk_reload_at";
    const last = Number(sessionStorage.getItem(KEY) ?? "0");
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

// HMR'in class+function karışımıyla uğraşmasını önlemek için disable —
// fallback UI sadece error state'inde mount olur, hot-reload'da etkisiz.
// eslint-disable-next-line react-refresh/only-export-components
function ErrorFallback({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}) {
  const { t } = useTranslation("errors");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mb-1 text-lg font-semibold text-foreground">
          {t("boundary_title")}
        </h1>
        <p className="mb-4 text-sm text-text-muted">
          {t("boundary_description")}
        </p>
        <pre className="mb-4 max-h-40 overflow-auto rounded-md bg-surface-2 p-2 text-left text-[11px] text-text-muted">
          {message}
        </pre>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => location.reload()}>
            <RefreshCw className="mr-1.5 size-3.5" />
            {t("boundary_reload")}
          </Button>
          <Button onClick={onReset}>{t("boundary_retry")}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * App kök hata sınırı. Render veya commit aşamasında yakalanmamış bir
 * hata olursa app silinmeden bir geri kazanım ekranı gösterir.
 *
 * `react-apexcharts` gibi 3rd party kütüphaneler unmount sırasında
 * bazen `undefined` ref hatası fırlatır — bu hatalar normalde React
 * 18'de tüm root'u söker ve kullanıcı bombos sayfa görür.
 */
export class RootErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Yeni deploy sonrasi tarayicida eski index.html kalinca lazy-loaded chunk
    // dosya adlari uymaz ("Failed to fetch dynamically imported module"). Bu
    // durumda sayfayi bir kez otomatik yenile (sonsuz dongu guard'i ile).
    if (isChunkLoadError(error) && shouldAutoReload()) {
      location.reload();
      return;
    }
    // Vite prod build esbuild.drop ile production bundle'dan strip eder.
    console.error("Root error boundary caught:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback message={this.state.error.message} onReset={this.reset} />
      );
    }
    return this.props.children;
  }
}
