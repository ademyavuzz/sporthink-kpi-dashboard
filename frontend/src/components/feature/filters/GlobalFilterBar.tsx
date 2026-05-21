import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FilterPanel } from "@/components/feature/filters/FilterPanel";
import { Button } from "@/components/ui/button";
import { formatCount, formatCurrency, formatMultiplier, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  countActiveFilters,
  useFiltersStore,
  type FiltersState,
  type RangeFilter,
} from "@/stores/useFiltersStore";

interface ActiveChip {
  id: string;
  label: string;
  onRemove: () => void;
}

function rangeText(
  r: RangeFilter,
  formatter: (v: number) => string,
): string {
  if (r.min !== null && r.max !== null) return `${formatter(r.min)}–${formatter(r.max)}`;
  if (r.min !== null) return `≥ ${formatter(r.min)}`;
  if (r.max !== null) return `≤ ${formatter(r.max)}`;
  return "";
}

function buildChips(
  s: FiltersState,
  t: (k: string) => string,
): ActiveChip[] {
  const chips: ActiveChip[] = [];

  // Multi-select: ilk değer + (n-1 daha) etiketi
  const multi: Array<{
    label: string;
    values: string[];
    setter: (v: string[]) => void;
  }> = [
    {
      label: t("filters:channel"),
      values: s.selected_channels,
      setter: s.setSelectedChannels,
    },
    {
      label: t("filters:device"),
      values: s.selected_devices,
      setter: s.setSelectedDevices,
    },
    {
      label: t("filters:city"),
      values: s.selected_cities,
      setter: s.setSelectedCities,
    },
  ];

  for (const m of multi) {
    if (m.values.length === 0) continue;
    const first = m.values[0];
    const more = m.values.length - 1;
    chips.push({
      id: `multi-${m.label}`,
      label: more > 0 ? `${m.label}: ${first} +${more}` : `${m.label}: ${first}`,
      onRemove: () => m.setter([]),
    });
  }

  // Range chips
  const ranges: Array<{
    id: string;
    label: string;
    range: RangeFilter;
    formatter: (v: number) => string;
    setter: (r: RangeFilter) => void;
  }> = [
    {
      id: "revenue",
      label: t("filters:revenue_range"),
      range: s.revenue_range,
      formatter: (v) => formatCurrency(v, { compact: true }),
      setter: s.setRevenueRange,
    },
    {
      id: "orders",
      label: t("filters:orders_range"),
      range: s.orders_range,
      formatter: (v) => formatCount(v),
      setter: s.setOrdersRange,
    },
    {
      id: "roas",
      label: t("filters:roas_range"),
      range: s.roas_range,
      formatter: (v) => formatMultiplier(v),
      setter: s.setRoasRange,
    },
    {
      id: "conversion",
      label: t("filters:conversion_range"),
      range: s.conversion_range,
      formatter: (v) => formatPercent(v, 2),
      setter: s.setConversionRange,
    },
  ];

  for (const r of ranges) {
    const txt = rangeText(r.range, r.formatter);
    if (!txt) continue;
    chips.push({
      id: `range-${r.id}`,
      label: `${r.label}: ${txt}`,
      onRemove: () => r.setter({ min: null, max: null }),
    });
  }

  return chips;
}

/**
 * Sayfa içeriğinin üstüne sticky bir bant — aktif filtreleri chip olarak
 * gösterir, "Filtrele" butonuyla `FilterPanel` açar, "Temizle" ile sıfırlar.
 *
 * Kullanım: dashboard sayfalarında PageHeader'dan sonra render edilir.
 */
export function GlobalFilterBar() {
  const { t } = useTranslation(["filters", "common"]);
  const [open, setOpen] = useState(false);
  const store = useFiltersStore();

  const chips = buildChips(store, (k) => t(k));
  const total = countActiveFilters(store);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-theme-xs">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <SlidersHorizontal className="size-3.5" />
        {t("filters:open_button")}
        {total > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {total}
          </span>
        )}
      </Button>

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.length === 0 ? (
          <span className="text-xs text-text-muted">{t("filters:none_active")}</span>
        ) : (
          chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted",
              )}
              title={t("filters:remove_chip")}
            >
              <span>{chip.label}</span>
              <X className="size-3 text-text-muted group-hover:text-destructive" />
            </button>
          ))
        )}
      </div>

      {total > 0 && (
        <button
          type="button"
          onClick={() => store.resetFilters()}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-muted hover:text-destructive transition-colors"
        >
          {t("filters:clear_all")}
        </button>
      )}

      <FilterPanel open={open} onOpenChange={setOpen} />
    </div>
  );
}
