/**
 * Permission code mirror — backend `app/core/permissions.py` ile **birebir** senkron.
 *
 * Frontend permission kontrolü sadece UX içindir; asıl güvenlik backend'de
 * `require_permission` ile yapılır (frontend/CLAUDE.md §17 row 20).
 *
 * Yeni izin eklendiğinde aynı PR'da hem backend enum hem buradaki sabit
 * güncellenir. Eksik karşılık varsa CI fail eder.
 */

export const PERMISSIONS = {
  // Kategori 1: Veri Görüntüleme (9)
  DASHBOARD_VIEW: "dashboard.view",
  TRAFFIC_VIEW: "traffic.view",
  META_ADS_VIEW: "meta_ads.view",
  GOOGLE_ADS_VIEW: "google_ads.view",
  ECOMMERCE_VIEW: "ecommerce.view",
  CAMPAIGNS_VIEW: "campaigns.view",
  FUNNEL_VIEW: "funnel.view",
  COHORT_VIEW: "cohort.view",
  PRODUCTS_VIEW: "products.view",

  // Kategori 2: Veri İşlemleri (20)
  IMPORTS_VIEW: "imports.view",
  IMPORTS_CREATE: "imports.create",
  IMPORTS_DELETE: "imports.delete",
  MAPPINGS_VIEW: "mappings.view",
  MAPPINGS_CREATE: "mappings.create",
  MAPPINGS_UPDATE: "mappings.update",
  MAPPINGS_DELETE: "mappings.delete",
  SEGMENTS_VIEW: "segments.view",
  SEGMENTS_CREATE: "segments.create",
  SEGMENTS_UPDATE: "segments.update",
  SEGMENTS_DELETE: "segments.delete",
  VIEWS_VIEW: "views.view",
  VIEWS_CREATE: "views.create",
  VIEWS_UPDATE: "views.update",
  VIEWS_DELETE: "views.delete",
  EXPORT_CSV: "export.csv",
  EXPORT_REPORT: "export.report",
  REPORTS_VIEW: "reports.view",
  REPORTS_CREATE: "reports.create",
  REPORTS_DELETE: "reports.delete",

  // Kategori 3: Kullanıcı ve Rol Yönetimi (9)
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_RESET_PASSWORD: "users.reset_password",
  ROLES_VIEW: "roles.view",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",

  // Kategori 4: Sistem ve Loglar (5)
  LOGS_VIEW_API: "logs.view_api",
  LOGS_VIEW_AUDIT: "logs.view_audit",
  LOGS_VIEW_IMPORTS: "logs.view_imports",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_UPDATE: "settings.update",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
