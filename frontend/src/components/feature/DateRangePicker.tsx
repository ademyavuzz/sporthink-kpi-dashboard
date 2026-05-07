import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";

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

/** Popover'da gösterilecek preset sırası — yaygın olanlar üstte, yıllık altta. */
const PRESET_GROUPS: { title: string; items: DatePresetId[] }[] = [
  { title: "", items: ["today", "yesterday"] },
  { title: "", items: ["last_7", "last_30", "last_90"] },
  { title: "", items: ["this_month", "last_month"] },
  { title: "", items: ["this_year", "last_year"] },
];

/** Verilen preset için [from, to] tarihlerini hesaplar (TR İstanbul TZ). */
// eslint-disable-next-line react-refresh/only-export-components
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
      // Custom için varsayılanı koru — caller mevcut from/to'yu geçirir.
      return { date_from: ref.format("YYYY-MM-DD"), date_to: ref.format("YYYY-MM-DD") };
  }
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

/**
 * Popover-based tarih seçici.
 *
 * Trigger: `[📅  Son 30 Gün · 01.03.2025 – 31.03.2025  ⌄]` — preset label
 * + seçili tarih aralığı tek satırda. Tıklayınca açılan popover içinde:
 *
 *   ┌────────────────────────────────────┐
 *   │  Bugün       Son 7 gün     ...     │  ← preset chip grid
 *   │  Bugün       Son 30 gün    ...     │
 *   │                                    │
 *   │  Başlangıç [____]  Bitiş [____]    │  ← custom range
 *   │                       [ Uygula ]   │
 *   └────────────────────────────────────┘
 *
 * Preset seçilince popover kapanır ve onChange tetiklenir. Custom range
 * için iki date input + Apply butonu — Apply'a basana kadar kapanmaz.
 */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // Custom için draft — Apply'a basılana kadar parent state'i kirletmez.
  const [draftFrom, setDraftFrom] = useState(value.date_from);
  const [draftTo, setDraftTo] = useState(value.date_to);

  // Popover her açıldığında draft'ı mevcut value ile resetle.
  useEffect(() => {
    if (open) {
      setDraftFrom(value.date_from);
      setDraftTo(value.date_to);
    }
  }, [open, value.date_from, value.date_to]);

  const handlePresetClick = (preset: DatePresetId) => {
    const range = computePresetRange(preset);
    onChange({ preset, ...range });
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (!draftFrom || !draftTo) return;
    // from > to ise sessizce takasla (kötü input'tan kullanıcıyı kurtarır).
    const [f, to] =
      draftFrom > draftTo ? [draftTo, draftFrom] : [draftFrom, draftTo];
    onChange({ preset: "custom", date_from: f, date_to: to });
    setOpen(false);
  };

  const display = `${dayjs(value.date_from).format("DD.MM.YYYY")} – ${dayjs(value.date_to).format("DD.MM.YYYY")}`;
  const presetLabel = PRESET_LABELS[value.preset];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left",
            "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "transition-colors",
          )}
          aria-label={`${presetLabel} · ${display}`}
        >
          <CalendarIcon className="size-4 shrink-0 text-text-muted" />
          <span className="text-sm font-semibold text-foreground">
            {presetLabel}
          </span>
          <span className="text-xs text-text-muted opacity-70">·</span>
          <span className="text-xs tabular-nums text-text-muted">{display}</span>
          <ChevronDown className="ml-1 size-3.5 shrink-0 text-text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-3">
        {/* Preset grid */}
        <div className="space-y-1">
          {PRESET_GROUPS.map((group, gi) => (
            <div
              key={gi}
              className={cn(
                "grid grid-cols-3 gap-1",
                gi > 0 && "pt-1",
              )}
            >
              {group.items.map((p) => {
                const active = value.preset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetClick(p)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors text-center",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-surface-2/60 text-text-muted hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {PRESET_LABELS[p]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-border" />

        {/* Custom range */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            {PRESET_LABELS.custom}
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={draftFrom}
              max={draftTo || undefined}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="h-9 text-xs tabular-nums"
              aria-label="Başlangıç tarihi"
            />
            <span className="text-text-muted">–</span>
            <Input
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              onChange={(e) => setDraftTo(e.target.value)}
              className="h-9 text-xs tabular-nums"
              aria-label="Bitiş tarihi"
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleApplyCustom}
              disabled={
                !draftFrom ||
                !draftTo ||
                (draftFrom === value.date_from && draftTo === value.date_to)
              }
              className="h-8 px-3 text-xs"
            >
              Uygula
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
