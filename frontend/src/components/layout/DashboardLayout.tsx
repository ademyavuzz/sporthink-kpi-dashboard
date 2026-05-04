import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import { PageLoader } from "@/components/common/PageLoader";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Dashboard layout — Sidebar + TopBar + main outlet (lazy sayfalar için Suspense).
 *
 * Auth/permission guard'ı `<ProtectedRoute>` üzerinden her route'ta tekrar
 * uygulanır; bu layout sadece kompozisyon yapar.
 */
export function DashboardLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-background">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
