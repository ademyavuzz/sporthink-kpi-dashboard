import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthBootstrap } from "./components/common/AuthBootstrap";
import { PageLoader } from "./components/common/PageLoader";
import { ThemeSync } from "./components/common/ThemeSync";
// i18n + dayjs config side-effect imports (store-aware kurulum).
import "./lib/i18n";
import "./lib/dayjs";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync>
        <BrowserRouter>
          <AuthBootstrap>
            <Suspense fallback={<PageLoader />}>
              <App />
            </Suspense>
          </AuthBootstrap>
        </BrowserRouter>
      </ThemeSync>
    </QueryClientProvider>
  </StrictMode>,
);
