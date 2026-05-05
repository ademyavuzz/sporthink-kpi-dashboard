import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Eye,
  MousePointerClick,
  Package,
  Percent,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { formatChange, formatKPIValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KPIResult } from "@/types/dashboard";

type IconCmp = React.ComponentType<{ className?: string }>;

/** kpi_id → semantic ikon mapping. */
const ICON_REGISTRY: Record<string, IconCmp> = {
  // E-ticaret
  revenue: Wallet,
  orders: ShoppingBag,
  items_sold: Package,
  aov: ShoppingCart,
  revenue_per_user: Sparkles,
  // GA4 / trafik
  sessions: Eye,
  users: Users,
  new_users: UserPlus,
  bounce_rate: TrendingDown,
  pages_per_session: BarChart3,
  avg_session_duration: BarChart3,
  conversion_rate: Percent,
  // Reklam
  ad_spend: Wallet,
  impressions: Eye,
  clicks: MousePointerClick,
  ctr: Percent,
  cpc: Wallet,
  cpm: Wallet,
  ad_conversions: ShoppingBag,
  cost_per_conversion: Wallet,
  roas: TrendingUp,
  frequency: BarChart3,
  // Müşteri
  total_customers: Users,
  new_customers: UserPlus,
  repeat_rate: Sparkles,
  avg_customer_value: Wallet,
  avg_orders_per_customer: ShoppingBag,
  newsletter_subscription_rate: Percent,
  // Kanal
  active_channels: Target,
  top_channel_revenue: Wallet,
  avg_roas: TrendingUp,
  avg_conversion_rate: Percent,
};

function pickIcon(kpiId: string): IconCmp {
  return ICON_REGISTRY[kpiId] ?? BarChart3;
}

interface KPICardProps {
  kpi: KPIResult;
  loading?: boolean;
  /** Sıkışık layout için (sm: 4-6 sütun) - daha kısa padding ve değer. */
  compact?: boolean;
  /** İkon override — verilmezse `kpi.kpi_id`'ye göre otomatik seçilir. */
  icon?: IconCmp;
}

/**
 * KPI kartı — TailAdmin tile pattern.
 *
 * Yapı:
 * - Sol: gri ikon chip (h-12 w-12 rounded-xl bg-gray-100/dark:gray-800)
 * - Sağ: label (gray-500), value (text-title-sm bold), rounded-FULL delta pill
 *
 * `value === null` → "veri yok" gösterilir (örn. 0/0 hesaplaması).
 * `change_percentage === null` → trend gizlenir, gürültü oluşturulmaz.
 * `is_positive` → success-50/600 yeşil pill, aksi halde error-50/600.
 */
export function KPICard({
  kpi,
  loading,
  compact,
  icon,
}: KPICardProps) {
  if (loading) return <KPICardSkeleton compact={compact} />;

  const Icon = icon ?? pickIcon(kpi.kpi_id);
  const value = formatKPIValue(kpi.value, kpi.unit);
  const change = formatChange(kpi.change_percentage);
  const TrendIcon = kpi.direction === "down" ? ArrowDown : ArrowUp;
  // Backend `kpi_id` üzerinden i18n key çözeriz; sözlükte yoksa
  // backward-compat için backend'den gelen `label_tr`'a düşeriz.
  const { t } = useTranslation("dashboard");
  const label = t(`kpi.${kpi.kpi_id}`, { defaultValue: kpi.label_tr });

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-colors hover:border-gray-300 dark:hover:border-gray-700",
      )}
    >
      <CardContent className={cn(compact ? "p-5" : "p-5 md:p-6")}>
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800",
            compact ? "size-11" : "size-12",
          )}
        >
          <Icon
            className={cn(
              "text-gray-800 dark:text-white/90",
              compact ? "size-5" : "size-[22px]",
            )}
          />
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1"
              title={label}
            >
              {label}
            </p>
            <p
              className={cn(
                "mt-2 font-bold tabular-nums text-gray-800 dark:text-white/90 leading-tight",
                compact ? "text-[24px]" : "text-[28px]",
              )}
            >
              {value}
            </p>
          </div>

          {kpi.change_percentage !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-2.5 text-xs font-medium shrink-0",
                kpi.is_positive
                  ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                  : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
              )}
            >
              <TrendIcon className="size-3 fill-current" />
              <span className="tabular-nums">{change}</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KPICardSkeleton({ compact }: { compact?: boolean } = {}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className={cn(compact ? "p-5" : "p-5 md:p-6")}>
        <div
          className={cn(
            "rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse",
            compact ? "size-11" : "size-12",
          )}
        />
        <div className="mt-5 space-y-2">
          <div className="h-3.5 w-20 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-7 w-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
