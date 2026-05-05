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
}

/**
 * KPI kartı — yumuşak tonlu ikon + rafine tipografi + smooth hover.
 *
 * Yapı:
 * - Sol-üst: semantic-tone yumuşak renkli rounded-xl ikon chip
 *   (revenue → primary, ads → violet, traffic → sky, conv → emerald,
 *   bounce/refund → amber)
 * - Etiket: küçük, harf aralığı geniş, yumuşak gri
 * - Değer: tabular-nums, sıkı letter-spacing, kalın
 * - Delta pill: küçük, tonlu (yeşil/kırmızı), `is_positive`'a göre
 *
 * `value === null` → "—" gösterilir. `change_percentage === null` → pill
 * gizlenir.
 */
export function KPICard({ kpi, loading, compact, icon }: KPICardProps) {
  // Backend `kpi_id` üzerinden i18n key çözeriz; sözlükte yoksa
  // backward-compat için backend'den gelen `label_tr`'a düşeriz.
  const { t } = useTranslation("dashboard");

  if (loading) return <KPICardSkeleton compact={compact} />;

  const Icon = icon ?? pickIcon(kpi.kpi_id);
  const tone = TONE_CLASSES[pickTone(kpi.kpi_id)];
  const value = formatKPIValue(kpi.value, kpi.unit);
  const change = formatChange(kpi.change_percentage);
  const TrendIcon = kpi.direction === "down" ? ArrowDown : ArrowUp;
  const label = t(`kpi.${kpi.kpi_id}`, { defaultValue: kpi.label_tr });

  return (
    <Card
      className={cn(
        "group gap-0 py-0 transition-all duration-150",
        "hover:-translate-y-px hover:border-gray-300 hover:shadow-sm",
        "dark:hover:border-gray-700",
      )}
    >
      <CardContent className={cn(compact ? "p-5" : "p-5 md:p-6")}>
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-[1.03]",
              tone.bg,
              compact ? "size-11" : "size-12",
            )}
          >
            <Icon
              className={cn(
                tone.fg,
                compact ? "size-5" : "size-[22px]",
              )}
              strokeWidth={2.2}
            />
          </div>

          {kpi.change_percentage !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0",
                "ring-1 ring-inset",
                kpi.is_positive
                  ? "bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20"
                  : "bg-error-50 text-error-700 ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20",
              )}
              title={t("kpi_change_tooltip", {
                defaultValue: "Önceki döneme göre",
              })}
            >
              <TrendIcon className="size-3 -ml-0.5" strokeWidth={3} />
              <span className="tabular-nums">{change}</span>
            </span>
          )}
        </div>

        <div className="mt-5">
          <p
            className="text-[13px] font-medium uppercase tracking-[0.04em] text-text-muted line-clamp-1"
            title={label}
          >
            {label}
          </p>
          <p
            className={cn(
              "mt-1.5 font-bold tabular-nums leading-[1.1] text-foreground",
              "tracking-tight",
              compact ? "text-[26px]" : "text-[30px] md:text-[32px]",
            )}
            style={{ fontFeatureSettings: '"tnum", "lnum"' }}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function KPICardSkeleton({ compact }: { compact?: boolean } = {}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className={cn(compact ? "p-5" : "p-5 md:p-6")}>
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse",
              compact ? "size-11" : "size-12",
            )}
          />
          <div className="h-5 w-14 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-3.5 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div
            className={cn(
              "rounded bg-gray-100 dark:bg-gray-800 animate-pulse",
              compact ? "h-7 w-28" : "h-8 w-32",
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
