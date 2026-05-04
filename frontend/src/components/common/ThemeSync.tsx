import { useEffect } from "react";

import { applyThemeToDocument, useThemeStore } from "@/stores/useThemeStore";

/**
 * Persisted theme'i `<html>`'e uygular ve store değişimini canlı takip eder.
 * `<App>` ağacının dışında, `<BrowserRouter>` ve provider'ların altında durur.
 */
export function ThemeSync({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);
  return <>{children}</>;
}
