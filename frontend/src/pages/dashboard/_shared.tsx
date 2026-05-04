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
  range: DateRangeValue;
  onChangeRange: (next: DateRangeValue) => void;
  /** Sağ taraftaki ek aksiyonlar (örn: Export butonu). */
  actions?: ReactNode;
}

export function DashboardHeader({
  title,
  range,
  onChangeRange,
  actions,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {dayjs(range.date_from).format("DD.MM.YYYY")} –{" "}
          {dayjs(range.date_to).format("DD.MM.YYYY")}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
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
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-accent transition-colors"
    >
      {children}
    </button>
  );
}
