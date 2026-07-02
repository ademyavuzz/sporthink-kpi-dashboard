import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  Filter,
  GitBranch,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Megaphone,
  Package,
  Settings,
  Sparkles,
  ShoppingCart,
  Target,
  TrendingUp,
  UserCog,
  Upload,
  UserRound,
} from "lucide-react";

import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";

export interface NavItem {
  /** Hem URL slug hem `common.nav.<id>` translation key. */
  id: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Kullanıcının görmesi için gerekli izin.
   *
   * `undefined` → her oturum açan kullanıcı görür (kişisel sayfalar:
   * bildirimler, kendi profil/güvenlik ayarları).
   */
  permission?: PermissionCode;
}

/** Sidebar'da nav item'larını gruplama anahtarı (i18n: `common.nav_group.<id>`). */
export type NavGroupId = "dashboard" | "data" | "system";

export interface NavGroup {
  id: NavGroupId;
  items: readonly NavItem[];
}

/**
 * Üç bölüme ayrılmış sidebar nav grupları.
 *
 * - `dashboard`: KPI / analiz sayfaları
 * - `data`: import, raporlar, kanal eşleme
 * - `system`: bildirimler, denetim, kullanıcı/rol yönetimi
 *
 * Sidebar bu listeyi kullanıcı izinleriyle filtreler — boş kalan grup
 * tamamen render dışı kalır.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "dashboard",
    items: [
      { id: "overview", path: "/overview", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
      { id: "traffic", path: "/traffic", icon: TrendingUp, permission: PERMISSIONS.TRAFFIC_VIEW },
      { id: "meta_ads", path: "/meta-ads", icon: Megaphone, permission: PERMISSIONS.META_ADS_VIEW },
      { id: "google_ads", path: "/google-ads", icon: Target, permission: PERMISSIONS.GOOGLE_ADS_VIEW },
      { id: "ecommerce", path: "/ecommerce", icon: ShoppingCart, permission: PERMISSIONS.ECOMMERCE_VIEW },
      { id: "campaigns", path: "/campaigns", icon: Sparkles, permission: PERMISSIONS.CAMPAIGNS_VIEW },
      { id: "funnel", path: "/funnel", icon: Filter, permission: PERMISSIONS.FUNNEL_VIEW },
      { id: "cohort", path: "/cohort", icon: BarChart3, permission: PERMISSIONS.COHORT_VIEW },
      { id: "products", path: "/products", icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW },
      { id: "customers", path: "/customers", icon: UserRound, permission: PERMISSIONS.CUSTOMERS_VIEW },
      { id: "channel_analysis", path: "/channel-analysis", icon: LineChartIcon, permission: PERMISSIONS.CHANNEL_ANALYSIS_VIEW },
    ],
  },
  {
    id: "data",
    items: [
      { id: "import", path: "/import", icon: Upload, permission: PERMISSIONS.IMPORTS_VIEW },
      { id: "reports", path: "/reports", icon: FileText, permission: PERMISSIONS.REPORTS_VIEW },
      { id: "channel_mapping", path: "/channel-mappings", icon: GitBranch, permission: PERMISSIONS.MAPPINGS_VIEW },
    ],
  },
  {
    id: "system",
    items: [
      { id: "notifications", path: "/notifications", icon: Bell },
      { id: "audit_logs", path: "/audit-logs", icon: Activity, permission: PERMISSIONS.LOGS_VIEW_AUDIT },
      { id: "user_management", path: "/users", icon: UserCog, permission: PERMISSIONS.USERS_VIEW },
      { id: "settings", path: "/settings", icon: Settings },
    ],
  },
] as const;

