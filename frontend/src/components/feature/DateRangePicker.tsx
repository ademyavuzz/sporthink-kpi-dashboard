import { Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dayjs } from "@/lib/dayjs";

export type DatePresetId =
  | "today"
  | "yesterday"
  | "last_7"
  | "last_14"
  | "last_28"
  | "last_30"
  | "last_90"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export interface DateRangeValue {
  preset: DatePresetId;
  date_from: string; // YYYY-MM-DD
  date_to: string;
}

const PRESET_LABELS: Record<DatePresetId, string> = {
  today: "Bugün",
  yesterday: "Dün",
  last_7: "Son 7 Gün",
  last_14: "Son 14 Gün",
  last_28: "Son 28 Gün",
  last_30: "Son 30 Gün",
  last_90: "Son 90 Gün",
  this_month: "Bu Ay",
  last_month: "Geçen Ay",
  this_year: "Bu Yıl",
  last_year: "Geçen Yıl",
  custom: "Özel",
};

/** Verilen preset için [from, to] tarihlerini hesaplar (TR İstanbul TZ). */
export function computePresetRange(
  preset: DatePresetId,
  reference: string = dayjs().tz("Europe/Istanbul").format("YYYY-MM-DD"),
): { date_from: string; date_to: string } {
  const ref = dayjs.tz(reference, "Europe/Istanbul");
  switch (preset) {
    case "today":
      return { date_from: ref.format("YYYY-MM-DD"), date_to: ref.format("YYYY-MM-DD") };
    case "yesterday": {
      const y = ref.subtract(1, "day");
      return { date_from: y.format("YYYY-MM-DD"), date_to: y.format("YYYY-MM-DD") };
    }
    case "last_7":
      return {
        date_from: ref.subtract(6, "day").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "last_14":
      return {
        date_from: ref.subtract(13, "day").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "last_28":
      return {
        date_from: ref.subtract(27, "day").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "last_30":
      return {
        date_from: ref.subtract(29, "day").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "last_90":
      return {
        date_from: ref.subtract(89, "day").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "this_month":
      return {
        date_from: ref.startOf("month").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "last_month": {
      const lm = ref.subtract(1, "month");
      return {
        date_from: lm.startOf("month").format("YYYY-MM-DD"),
        date_to: lm.endOf("month").format("YYYY-MM-DD"),
      };
    }
    case "this_year":
      return {
        date_from: ref.startOf("year").format("YYYY-MM-DD"),
        date_to: ref.format("YYYY-MM-DD"),
      };
    case "last_year": {
      const ly = ref.subtract(1, "year");
      return {
        date_from: ly.startOf("year").format("YYYY-MM-DD"),
        date_to: ly.endOf("year").format("YYYY-MM-DD"),
      };
    }
    case "custom":
    default:
      // custom için varsayılan: bugün
      return { date_from: ref.format("YYYY-MM-DD"), date_to: ref.format("YYYY-MM-DD") };
  }
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

/**
 * Sticky-top tarih seçici — şimdilik sadece preset dropdown.
 * Sprint 9'da custom calendar (react-day-picker) eklenecek.
 */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t: _t } = useTranslation("common");

  const handlePresetChange = (preset: DatePresetId) => {
    if (preset === "custom") {
      onChange({ ...value, preset });
      return;
    }
    const range = computePresetRange(preset);
    onChange({ preset, ...range });
  };

  const display = `${dayjs(value.date_from).format("DD.MM.YYYY")} – ${dayjs(value.date_to).format("DD.MM.YYYY")}`;

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      <Select value={value.preset} onValueChange={(v) => handlePresetChange(v as DatePresetId)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PRESET_LABELS) as DatePresetId[]).map((p) => (
            <SelectItem key={p} value={p}>
              {PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
        {display}
      </span>
    </div>
  );
}
