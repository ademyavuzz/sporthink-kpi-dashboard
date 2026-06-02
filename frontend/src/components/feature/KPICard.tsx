import {
  ArrowDown,
  ArrowUp,
  Banknote,
  BarChart3,
  Clock,
  Coins,
  CreditCard,
  Eye,
  FileText,
  Info,
  Mail,
  Megaphone,
  Minus,
  MousePointerClick,
  Network,
  Package,
  Percent,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingDown,
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

/** kpi_id → semantic ikon mapping.
 *
 * Domain ikonografisi (tutarlilik icin):
 * - Para girisi / ciro → Banknote
 * - Sipariş / dönüşüm hacmi → ShoppingBag
 * - Maliyet / harcama / birim fiyat → Wallet / Megaphone / CreditCard
 * - Reklam geliri → Coins
 * - Oran / yüzde → Percent
 * - Getiri / hedef → Target
 * - Kullanıcı → Users / UserPlus
 * - Görüntülenme → Eye, tıklama → MousePointerClick
 */
const ICON_REGISTRY: Record<string, IconCmp> = {
  // E-ticaret
  revenue: Banknote,
  orders: ShoppingBag,
  items_sold: Package,
  aov: ShoppingCart,
  revenue_per_user: Receipt,
  // GA4 / trafik
  sessions: MousePointerClick,
  users: Users,
  new_users: UserPlus,
  bounce_rate: TrendingDown,
  pages_per_session: FileText,
  avg_session_duration: Clock,
  conversion_rate: Percent,
  // Reklam
  ad_spend: Megaphone,
  ad_revenue: Coins,
  impressions: Eye,
  clicks: MousePointerClick,
  ctr: Percent,
  cpc: Wallet,
  cpm: CreditCard,
  ad_conversions: ShoppingBag,
  cost_per_conversion: Wallet,
  roas: Target,
  frequency: Repeat,
  // Müşteri
  total_customers: Users,
  new_customers: UserPlus,
  repeat_rate: Repeat,
  avg_customer_value: Banknote,
  avg_orders_per_customer: ShoppingBag,
  newsletter_subscription_rate: Mail,
  // Kanal
  active_channels: Network,
  top_channel_revenue: Banknote,
  avg_roas: Target,
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

/** Tone → ikon chip arka plan + ikon rengi + sol accent şerit sınıfları.
 * Light/dark her ikisi. `stripe` Card'ın sol kenarındaki 3px şeridi boyar. */
const TONE_CLASSES: Record<
  AccentTone,
  { bg: string; fg: string; stripe: string }
> = {
  primary: {
    bg: "bg-primary/10 dark:bg-primary/15",
    fg: "text-primary dark:text-primary",
    stripe: "bg-primary",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/15",
    fg: "text-violet-600 dark:text-violet-400",
    stripe: "bg-violet-500",
  },
  blue: {
    bg: "bg-sky-50 dark:bg-sky-500/15",
    fg: "text-sky-600 dark:text-sky-400",
    stripe: "bg-sky-500",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/15",
    fg: "text-emerald-600 dark:text-emerald-400",
    stripe: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/15",
    fg: "text-amber-600 dark:text-amber-400",
    stripe: "bg-amber-500",
  },
  neutral: {
    bg: "bg-gray-100 dark:bg-gray-800",
    fg: "text-gray-700 dark:text-gray-300",
    stripe: "bg-gray-300 dark:bg-gray-700",
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
  /**
   * Hero variant — Overview üst sıra için: daha geniş padding, büyük value
   * tipografisi (32-34px) ve daha kalın accent. `compact` ile aynı anda
   * verilemez; verilirse `hero` öncelik alır.
   */
  hero?: boolean;
  /** İkon override — verilmezse `kpi.kpi_id`'ye göre otomatik seçilir. */
  icon?: IconCmp;
  /**
   * Sağ üstte info ikonu + tooltip. Boş geçerse otomatik olarak
   * `kpi_help.<id>` locale key'inden çekilir. Açıklama yoksa ikon
   * render edilmez.
   */
  info?: string;
}

export function KPICard({
  kpi,
  loading,
  compact,
  hero,
  icon,
  info,
}: KPICardProps) {
  const { t } = useTranslation(["dashboard", "common"]);

  if (loading) return <KPICardSkeleton compact={compact} hero={hero} />;

  const Icon = icon ?? pickIcon(kpi.kpi_id);
  const tone = TONE_CLASSES[pickTone(kpi.kpi_id)];
  const value = formatKPIValue(kpi.value, kpi.unit);
  const change = formatChange(kpi.change_percentage);
  const isFlat = kpi.direction === "flat";
  const TrendIcon = isFlat ? Minus : kpi.direction === "down" ? ArrowDown : ArrowUp;
  const label = t(`kpi.${kpi.kpi_id}`, { defaultValue: kpi.label_tr });
  const helpText =
    info ?? t(`kpi_help.${kpi.kpi_id}`, { defaultValue: "" });

  return (
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden py-0 transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/30",
      )}
    >
      {/* Sol accent şeridi — KPI tonuna göre. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 rounded-r-full transition-all duration-200 group-hover:inset-y-1",
          hero ? "w-1" : "w-[3px]",
          tone.stripe,
        )}
      />
      <CardContent
        className={cn(hero ? "p-5 pl-6" : compact ? "p-4 pl-[18px]" : "p-4 pl-5")}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06] transition-transform duration-200 group-hover:scale-105",
              tone.bg,
              hero ? "size-10" : "size-9",
            )}
          >
            <Icon
              className={cn(tone.fg, hero ? "size-5" : "size-[18px]")}
              strokeWidth={2.2}
            />
          </div>
          <p
            className={cn(
              "min-w-0 flex-1 font-medium text-text-muted",
              hero
                ? "truncate text-[13px] leading-tight"
                : "line-clamp-2 text-[12px] leading-[1.25]",
            )}
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
                  className="shrink-0 rounded-full p-0.5 text-text-muted/50 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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

        <div
          className={cn(
            "flex gap-2",
            hero
              ? "mt-4 items-baseline justify-between"
              : "mt-3 flex-col items-start gap-1.5",
          )}
        >
          <p
            className={cn(
              "whitespace-nowrap font-semibold tabular-nums leading-none tracking-tight text-foreground",
              hero
                ? "text-[30px] md:text-[34px]"
                : compact
                  ? "text-[21px]"
                  : "text-[24px]",
            )}
          >
            {value}
          </p>
          {kpi.change_percentage !== null && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                isFlat
                  ? "bg-muted text-text-muted ring-border dark:bg-gray-800 dark:text-gray-400"
                  : kpi.is_positive
                    ? "bg-success-50 text-success-700 ring-success-500/20 dark:bg-success-500/10 dark:text-success-500"
                    : "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/10 dark:text-error-500",
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

export function KPICardSkeleton({
  compact,
  hero,
}: { compact?: boolean; hero?: boolean } = {}) {
  return (
    <Card className="relative gap-0 overflow-hidden py-0">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 bg-gray-200 dark:bg-gray-800",
          hero ? "w-1" : "w-[3px]",
        )}
      />
      <CardContent
        className={cn(
          hero ? "p-5 pl-6" : compact ? "p-3.5 pl-4" : "p-4 pl-[18px]",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "animate-pulse rounded-md bg-gray-100 dark:bg-gray-800",
              hero ? "size-10" : compact ? "size-7" : "size-8",
            )}
          />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        <div
          className={cn(
            "flex items-center justify-between",
            hero ? "mt-3.5" : "mt-2.5",
          )}
        >
          <div
            className={cn(
              "rounded bg-gray-100 dark:bg-gray-800 animate-pulse",
              hero ? "h-8 w-36" : compact ? "h-5 w-24" : "h-6 w-28",
            )}
          />
          <div className="h-[18px] w-12 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
