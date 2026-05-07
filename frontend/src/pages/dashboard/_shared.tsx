/**
 * Dashboard sayfaları için ortak helper'lar — header, preset butonları,
 * tarih aralığı state pattern'i.
 */
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DateRangePicker,
  computePresetRange,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { dayjs } from "@/lib/dayjs";
import { formatMultiplier, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboardRange(
  initial?: Partial<DateRangeValue>,
): [DateRangeValue, Dispatch<SetStateAction<DateRangeValue>>] {
  return useState<DateRangeValue>(() => ({
    preset: "custom",
    date_from: "2024-10-01",
    date_to: "2025-03-31",
    ...initial,
  }));
}

interface DashboardHeaderProps {
  title: string;
  /** Opsiyonel açıklama. Verilmezse seçili tarih aralığı muted text olarak gösterilir. */
  subtitle?: string;
  range: DateRangeValue;
  onChangeRange: (next: DateRangeValue) => void;
  /** Sağ taraftaki ek aksiyonlar (örn: Export butonu). */
  actions?: ReactNode;
}

export function DashboardHeader({
  title,
  subtitle,
  range,
  onChangeRange,
  actions,
}: DashboardHeaderProps) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-title-sm font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {subtitle ? (
            subtitle
          ) : (
            <span className="tabular-nums">
              {dayjs(range.date_from).format("DD.MM.YYYY")}
              <span className="mx-1 text-text-dim">–</span>
              {dayjs(range.date_to).format("DD.MM.YYYY")}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PresetButton
          onClick={() =>
            onChangeRange({ preset: "last_30", ...computePresetRange("last_30") })
          }
        >
          {t("overview.preset_last_30")}
        </PresetButton>
        <PresetButton
          onClick={() =>
            onChangeRange({
              preset: "custom",
              date_from: "2024-10-01",
              date_to: "2025-03-31",
            })
          }
        >
          {t("overview.preset_all")}
        </PresetButton>
        <DateRangePicker value={range} onChange={onChangeRange} />
        {actions}
      </div>
    </div>
  );
}

function PresetButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-muted hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

/**
 * Sayfa kök sarmalayıcısı — tüm dashboard sayfalarında aynı genişlik/padding.
 * `<PageShell>...</PageShell>`
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto max-w-[1400px] space-y-5 px-6 py-6">
      {children}
    </div>
  );
}

/**
 * ROAS değerine göre renkli pill — kanal/kampanya tablolarında kullanılır.
 * 4+ → success, 1-4 → info, <1 → error, null → neutral.
 */
export function RoasPill({ value }: { value: number | string | null }) {
  const num = value === null ? null : toNumber(value);
  if (num === null || !Number.isFinite(num)) {
    return <span className="text-text-dim">—</span>;
  }
  const tone =
    num >= 4
      ? "bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/10 dark:text-success-500 dark:ring-success-500/20"
      : num >= 1
        ? "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20"
        : "bg-error-50 text-error-700 ring-error-100 dark:bg-error-500/10 dark:text-error-500 dark:ring-error-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset",
        tone,
      )}
    >
      {formatMultiplier(num)}
    </span>
  );
}
