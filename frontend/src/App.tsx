import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ComingSoonPage } from "@/components/common/ComingSoonPage";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { NAV_ITEMS } from "@/components/layout/nav-items";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const OverviewPage = lazy(() => import("@/pages/dashboard/OverviewPage"));
const TrafficPage = lazy(() => import("@/pages/dashboard/TrafficPage"));
const MetaAdsPage = lazy(() => import("@/pages/dashboard/MetaAdsPage"));
const GoogleAdsPage = lazy(() => import("@/pages/dashboard/GoogleAdsPage"));
const EcommercePage = lazy(() => import("@/pages/dashboard/EcommercePage"));
const CampaignsPage = lazy(() => import("@/pages/dashboard/CampaignsPage"));
const FunnelPage = lazy(() => import("@/pages/dashboard/FunnelPage"));
const CohortPage = lazy(() => import("@/pages/dashboard/CohortPage"));
const ProductsPage = lazy(() => import("@/pages/dashboard/ProductsPage"));
const ImportPage = lazy(() => import("@/pages/import/ImportPage"));
const ImportHistoryPage = lazy(() => import("@/pages/import/ImportHistoryPage"));
const UserManagementPage = lazy(() => import("@/pages/admin/UserManagementPage"));
const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage"));
const ChannelMappingPage = lazy(() => import("@/pages/admin/ChannelMappingPage"));
const SegmentsPage = lazy(() => import("@/pages/admin/SegmentsPage"));
const ForbiddenPage = lazy(() => import("@/pages/error/ForbiddenPage"));
const NotFoundPage = lazy(() => import("@/pages/error/NotFoundPage"));

/**
 * Router (frontend/CLAUDE.md §9).
 *
 * - `/login`, `/403`, `/404` → public (auth gerektirmez).
 * - DashboardLayout altındaki tüm route'lar `<ProtectedRoute permission=...>`
 *   ile sarılır; izin yoksa /403'e redirect.
 * - `/` → kullanıcının erişebildiği ilk sayfaya redirect (Sidebar logic ile aynı).
 *
 * 11 nav item'ından sadece `overview` gerçek bir sayfaya bağlı; diğerleri
 * `ComingSoonPage` placeholder gösterir. Her biri yine de doğru permission
 * kontrolünden geçer — sonraki sprint'lerde içerik bu route'lara gelir.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />

        <Route
          path="/overview"
          element={
            <ProtectedRoute permission="dashboard.view">
              <OverviewPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/traffic"
          element={
            <ProtectedRoute permission="traffic.view">
              <TrafficPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meta-ads"
          element={
            <ProtectedRoute permission="meta_ads.view">
              <MetaAdsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/google-ads"
          element={
            <ProtectedRoute permission="google_ads.view">
              <GoogleAdsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ecommerce"
          element={
            <ProtectedRoute permission="ecommerce.view">
              <EcommercePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute permission="campaigns.view">
              <CampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/funnel"
          element={
            <ProtectedRoute permission="funnel.view">
              <FunnelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cohort"
          element={
            <ProtectedRoute permission="cohort.view">
              <CohortPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permission="products.view">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute permission="imports.view">
              <ImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import/history"
          element={
            <ProtectedRoute permission="imports.view">
              <ImportHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute permission="users.view">
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute permission="logs.view_audit">
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channel-mappings"
          element={
            <ProtectedRoute permission="settings.update">
              <ChannelMappingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/segments"
          element={
            <ProtectedRoute permission="segments.view">
              <SegmentsPage />
            </ProtectedRoute>
          }
        />

        {NAV_ITEMS.filter(
          (n) =>
            ![
              "overview",
              "traffic",
              "meta_ads",
              "google_ads",
              "ecommerce",
              "campaigns",
              "funnel",
              "cohort",
              "products",
              "import",
              "segments",
              "user_management",
              "audit_logs",
              "channel_mapping",
            ].includes(n.id),
        ).map((n) => (
          <Route
            key={n.id}
            path={n.path}
            element={
              <ProtectedRoute permission={n.permission}>
                <ComingSoonPage navKey={n.id} />
              </ProtectedRoute>
            }
          />
        ))}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
