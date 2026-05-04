import {
  BarChart3,
  Filter,
  LayoutDashboard,
  Megaphone,
  Package,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";

export interface NavItem {
  /** Hem URL slug hem `common.nav.<id>` translation key. */
  id: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: PermissionCode;
}

/**
 * 11 üst seviye nav item — mock'taki NAV_ITEMS sırasıyla birebir.
 * Sidebar bu listeyi kullanıcı izinleriyle filtreler.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "overview", path: "/overview", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  { id: "traffic", path: "/traffic", icon: TrendingUp, permission: PERMISSIONS.TRAFFIC_VIEW },
  { id: "meta_ads", path: "/meta-ads", icon: Megaphone, permission: PERMISSIONS.META_ADS_VIEW },
  { id: "google_ads", path: "/google-ads", icon: Target, permission: PERMISSIONS.GOOGLE_ADS_VIEW },
  { id: "ecommerce", path: "/ecommerce", icon: ShoppingCart, permission: PERMISSIONS.ECOMMERCE_VIEW },
  { id: "campaigns", path: "/campaigns", icon: Sparkles, permission: PERMISSIONS.CAMPAIGNS_VIEW },
  { id: "funnel", path: "/funnel", icon: Filter, permission: PERMISSIONS.FUNNEL_VIEW },
  { id: "cohort", path: "/cohort", icon: BarChart3, permission: PERMISSIONS.COHORT_VIEW },
  { id: "products", path: "/products", icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW },
  { id: "import", path: "/import", icon: Upload, permission: PERMISSIONS.IMPORTS_VIEW },
  { id: "user_management", path: "/users", icon: Users, permission: PERMISSIONS.USERS_VIEW },
] as const;
