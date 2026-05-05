/**
 * Dashboard sayfaları için ortak helper'lar — header, preset butonları,
 * tarih aralığı state pattern'i.
 */
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";

import {
  DateRangePicker,
  computePresetRange,
  type DateRangeValue,
} from "@/components/feature/DateRangePicker";
import { dayjs } from "@/lib/dayjs";

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
          Son 30 gün
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
          Tüm dönem
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
