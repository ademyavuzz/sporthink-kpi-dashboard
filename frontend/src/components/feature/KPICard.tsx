import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Eye,
  Info,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatChange, formatKPIValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KPIResult } from "@/types/dashboard";

type IconCmp = React.ComponentType<{
  className?: string;
  strokeWidth?: number | string;
}>;

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

type AccentTone = "primary" | "violet" | "blue" | "emerald" | "amber" | "neutral";

/** kpi_id → renk tonu. Aynı domain (e-ticaret, reklam, trafik, dönüşüm)
 * aynı tona düşer; göz hierarchy'yi okumayı kolaylaştırır. */
const TONE_REGISTRY: Record<string, AccentTone> = {
  // Para — primary tone
  revenue: "primary",
  orders: "primary",
  items_sold: "primary",
  aov: "primary",
  revenue_per_user: "primary",
  top_channel_revenue: "primary",
  avg_customer_value: "primary",
  // Reklam — violet
  ad_spend: "violet",
  impressions: "violet",
  clicks: "violet",
  ctr: "violet",
  cpc: "violet",
  cpm: "violet",
  ad_conversions: "violet",
  cost_per_conversion: "violet",
  roas: "violet",
  frequency: "violet",
  avg_roas: "violet",
  // Trafik — blue
  sessions: "blue",
  users: "blue",
  new_users: "blue",
  pages_per_session: "blue",
  avg_session_duration: "blue",
  total_customers: "blue",
  new_customers: "blue",
  active_channels: "blue",
  // Dönüşüm/iyi performans göstergeleri — emerald
  conversion_rate: "emerald",
  avg_conversion_rate: "emerald",
  repeat_rate: "emerald",
  newsletter_subscription_rate: "emerald",
  // İstenmeyen yöne giden ratio — amber (ne tehlike kırmızı ne yeşil)
  bounce_rate: "amber",
  refund_rate: "amber",
};

/** Tone → ikon chip arka plan + ikon rengi sınıfları. Light/dark her ikisi. */
const TONE_CLASSES: Record<AccentTone, { bg: string; fg: string }> = {
  primary: {
    bg: "bg-primary/10 dark:bg-primary/15",
    fg: "text-primary dark:text-primary",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/15",
    fg: "text-violet-600 dark:text-violet-400",
  },
  blue: {
    bg: "bg-sky-50 dark:bg-sky-500/15",
    fg: "text-sky-600 dark:text-sky-400",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/15",
    fg: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/15",
    fg: "text-amber-600 dark:text-amber-400",
  },
  neutral: {
    bg: "bg-gray-100 dark:bg-gray-800",
    fg: "text-gray-700 dark:text-gray-300",
  },
};

function pickIcon(kpiId: string): IconCmp {
  return ICON_REGISTRY[kpiId] ?? BarChart3;
}

function pickTone(kpiId: string): AccentTone {
  return TONE_REGISTRY[kpiId] ?? "neutral";
}

interface KPICardProps {
  kpi: KPIResult;
  loading?: boolean;
  /** Sıkışık layout için (sm: 4-6 sütun) - daha kısa padding ve değer. */
  compact?: boolean;
  /** İkon override — verilmezse `kpi.kpi_id`'ye göre otomatik seçilir. */
  icon?: IconCmp;
  /**
   * Sağ üstte info ikonu + tooltip. Boş geçerse otomatik olarak
   * `kpi_help.<id>` locale key'inden çekilir. Açıklama yoksa ikon
   * render edilmez.
   */
  info?: string;
}

export function KPICard({ kpi, loading, compact, icon, info }: KPICardProps) {
  const { t } = useTranslation(["dashboard", "common"]);

  if (loading) return <KPICardSkeleton compact={compact} />;

  const Icon = icon ?? pickIcon(kpi.kpi_id);
  const tone = TONE_CLASSES[pickTone(kpi.kpi_id)];
  const value = formatKPIValue(kpi.value, kpi.unit);
  const change = formatChange(kpi.change_percentage);
  const TrendIcon = kpi.direction === "down" ? ArrowDown : ArrowUp;
  const label = t(`kpi.${kpi.kpi_id}`, { defaultValue: kpi.label_tr });
  const helpText =
    info ?? t(`kpi_help.${kpi.kpi_id}`, { defaultValue: "" });

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-150",
        "hover:border-gray-300 hover:shadow-sm",
        "dark:hover:border-gray-700",
      )}
    >
      <CardContent className={cn(compact ? "p-3.5" : "p-4")}>
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg",
              tone.bg,
              compact ? "size-7" : "size-8",
            )}
          >
            <Icon
              className={cn(tone.fg, compact ? "size-3.5" : "size-4")}
              strokeWidth={2.2}
            />
          </div>
          <p
            className="min-w-0 flex-1 truncate text-[12px] font-medium text-text-muted"
            title={label}
          >
            {label}
          </p>
          {helpText && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("common:info_about", {
                    defaultValue: "Hakkında",
                  })}
                  className="shrink-0 rounded-full p-0.5 text-text-muted/60 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Info className="size-3.5" strokeWidth={2.2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-[260px]">
                {helpText}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "font-semibold tabular-nums leading-none tracking-tight text-foreground",
              compact ? "text-[20px]" : "text-[22px] md:text-[24px]",
            )}
          >
            {value}
          </p>
          {kpi.change_percentage !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold shrink-0",
                kpi.is_positive
                  ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500"
                  : "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500",
              )}
              title={t("kpi_change_tooltip", {
                defaultValue: "Önceki döneme göre",
              })}
            >
              <TrendIcon className="size-2.5 -ml-0.5" strokeWidth={3} />
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
      <CardContent className={cn(compact ? "p-3.5" : "p-4")}>
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse",
              compact ? "size-7" : "size-8",
            )}
          />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <div
            className={cn(
              "rounded bg-gray-100 dark:bg-gray-800 animate-pulse",
              compact ? "h-5 w-24" : "h-6 w-28",
            )}
          />
          <div className="h-[18px] w-12 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
