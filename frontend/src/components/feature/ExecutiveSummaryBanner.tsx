import { ArrowDown, ArrowUp, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { formatKPIValue, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KPIResult, KPISummary } from "@/types/dashboard";

/** KPI'ları öncelik sırasıyla anlatım için seç (revenue/orders/roas headline). */
const NARRATIVE_ATTRS: (keyof KPISummary)[] = ["revenue", "orders", "roas"];

/** Wins/Concerns sıralaması için bakılacak tüm summary KPI'ları. */
const RANKED_ATTRS: (keyof KPISummary)[] = [
  "revenue",
  "orders",
  "aov",
  "sessions",
  "users",
  "conversion_rate",
  "bounce_rate",
  "ad_spend",
  "roas",
];

interface Props {
  summary: KPISummary | undefined;
  loading?: boolean;
}

/**
 * Yönetici Özeti — sayfanın en üstünde anlatım + 3 öne çıkan + 3 dikkat madde.
 *
 * `change_percentage` doluysa wins/concerns oluşur (sequential mode'da önceki
 * eşit uzunluktaki dönemle karşılaştırma). Boş periyot durumunda kullanıcıya
 * "daha kısa bir aralık seç" notu gösterilir.
 */
export function ExecutiveSummaryBanner({ summary, loading }: Props) {
  const { t } = useTranslation("dashboard");

  const { narrative, wins, concerns, hasComparison } = useMemo(() => {
    if (!summary) return { narrative: null, wins: [], concerns: [], hasComparison: false };

    // Anlatım — revenue + orders + roas
    const parts: string[] = [];
    const rev = summary.revenue;
    const revStr = formatKPIValue(rev.value, rev.unit);
    const revDelta = formatSignedPct(rev.change_percentage);
    parts.push(
      revDelta ? `Toplam gelir ${revStr} (${revDelta})` : `Toplam gelir ${revStr}`,
    );
    if (summary.orders.value !== null) {
      parts.push(`${formatKPIValue(summary.orders.value, summary.orders.unit)} sipariş alındı`);
    }
    if (summary.roas.value !== null) {
      parts.push(`reklam ROAS ${formatKPIValue(summary.roas.value, summary.roas.unit)}`);
    }
    const narrative = parts.join(", ") + ".";

    // Wins/Concerns — change'e göre |abs| sırala, ilk 3+3
    type Ranked = { kpi: KPIResult; absChange: number };
    const ranked: Ranked[] = [];
    for (const a of RANKED_ATTRS) {
      const k = summary[a] as KPIResult;
      if (!k || k.change_percentage === null || k.value === null) continue;
      const abs = Math.abs(toNumber(k.change_percentage) ?? 0);
      ranked.push({ kpi: k, absChange: abs });
    }
    ranked.sort((a, b) => b.absChange - a.absChange);
    const wins: KPIResult[] = [];
    const concerns: KPIResult[] = [];
    for (const r of ranked) {
      if (r.kpi.is_positive && wins.length < 3) wins.push(r.kpi);
      else if (!r.kpi.is_positive && concerns.length < 3) concerns.push(r.kpi);
      if (wins.length >= 3 && concerns.length >= 3) break;
    }

    const hasComparison = ranked.length > 0;
    void NARRATIVE_ATTRS;
    return { narrative, wins, concerns, hasComparison };
  }, [summary]);

  if (loading || !summary) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted/30" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
            <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Info className="size-4" />
          </span>
          <h2 className="text-base font-semibold text-foreground">
            {t("overview.exec_summary_title")}
          </h2>
        </div>

        {narrative && (
          <p className="rounded-lg border-l-[3px] border-primary bg-surface-2/40 px-4 py-3 text-sm leading-relaxed text-foreground">
            {narrative}
          </p>
        )}

        {!hasComparison ? (
          <p className="text-xs text-text-muted italic">
            {t("overview.exec_no_comparison")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InsightColumn
              tone="positive"
              title={t("overview.exec_wins_title")}
              items={wins}
              empty={t("overview.exec_no_wins")}
            />
            <InsightColumn
              tone="negative"
              title={t("overview.exec_concerns_title")}
              items={concerns}
              empty={t("overview.exec_no_concerns")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightColumn({
  tone,
  title,
  items,
  empty,
}: {
  tone: "positive" | "negative";
  title: string;
  items: KPIResult[];
  empty: string;
}) {
  const { t } = useTranslation("dashboard");
  const isPos = tone === "positive";
  const Icon = isPos ? TrendingUp : TrendingDown;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        isPos
          ? "border-success-100 dark:border-success-500/20"
          : "border-error-100 dark:border-error-500/20",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full",
            isPos
              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
              : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs italic text-text-dim">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((kpi) => (
            <InsightLine key={kpi.kpi_id} kpi={kpi} />
          ))}
        </ul>
      )}
      <span className="sr-only">{t("overview.subtitle_compared_to_prev")}</span>
    </div>
  );
}

function InsightLine({ kpi }: { kpi: KPIResult }) {
  const { t } = useTranslation("dashboard");
  const label = t(`kpi.${kpi.kpi_id}`, { defaultValue: kpi.label_tr });
  const valueStr = formatKPIValue(kpi.value, kpi.unit);
  const deltaStr = formatSignedPct(kpi.change_percentage);
  const TrendIcon = kpi.direction === "down" ? ArrowDown : ArrowUp;
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="truncate text-foreground">
        <span className="font-medium">{label}:</span>{" "}
        <span className="tabular-nums text-text-muted">{valueStr}</span>
      </span>
      {deltaStr && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            kpi.is_positive
              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
              : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
          )}
        >
          <TrendIcon className="size-3 fill-current" />
          {deltaStr}
        </span>
      )}
    </li>
  );
}

function formatSignedPct(pct: string | number | null): string | null {
  const n = toNumber(pct);
  if (n === null) return null;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}
