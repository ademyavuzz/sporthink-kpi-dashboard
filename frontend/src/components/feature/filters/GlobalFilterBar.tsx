import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  MonitorSmartphone,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FilterMultiSelect } from "@/components/feature/filters/FilterMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import {
  countActiveFilters,
  useFiltersStore,
  type RangeFilter,
} from "@/stores/useFiltersStore";

export type FilterField = "channels" | "devices" | "cities";

interface GlobalFilterBarProps {
  /** Hangi multi-select filtreler gösterilsin (sayfaya göre). */
  fields?: FilterField[];
  /** Gelişmiş aralık filtreleri (ciro/sipariş/ROAS/dönüşüm) — yalnız destekleyen
   *  sayfalarda (ör. Kanal Analizi). */
  showRanges?: boolean;
}

/**
 * Dashboard filtre çubuğu — inline, anında uygulanan.
 *
 * Çalışan (backend-destekli) filtreleri sayfaya göre gösterir; her seçim
 * doğrudan store'a yazılır ve TanStack Query otomatik refetch eder. Gösterilen
 * filtreler `fields`/`showRanges` ile sayfa bazında yapılandırılır — böylece
 * hiçbir sayfada "işe yaramayan" filtre gösterilmez.
 */
export function GlobalFilterBar({
  fields = ["channels", "devices"],
  showRanges = false,
}: GlobalFilterBarProps) {
  const { t } = useTranslation(["filters", "common"]);
  const store = useFiltersStore();

  const channelsQ = useQuery({
    queryKey: ["filters", "channels"],
    queryFn: () => adminApi.filterChannels(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("channels"),
  });
  const devicesQ = useQuery({
    queryKey: ["filters", "devices"],
    queryFn: () => adminApi.filterDevices(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("devices"),
  });
  const citiesQ = useQuery({
    queryKey: ["filters", "cities"],
    queryFn: () => adminApi.filterCities(),
    staleTime: 30 * 60 * 1000,
    enabled: fields.includes("cities"),
  });

  // "all" gerçek bir cihaz seçimi değil (agregat işareti) — gizlenir.
  const deviceOptions = (devicesQ.data ?? []).filter((d) => d !== "all");

  const total = countActiveFilters(store);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 shadow-theme-xs">
      <div className="flex items-center gap-1.5 pr-1 text-text-muted">
        <SlidersHorizontal className="size-3.5" />
        <span className="text-xs font-semibold">{t("filters:open_button")}</span>
      </div>

      {fields.includes("channels") && (
        <FilterMultiSelect
          label={t("filters:channel")}
          icon={Radio}
          options={channelsQ.data ?? []}
          selected={store.selected_channels}
          loading={channelsQ.isPending}
          onChange={store.setSelectedChannels}
        />
      )}
      {fields.includes("devices") && (
        <FilterMultiSelect
          label={t("filters:device")}
          icon={MonitorSmartphone}
          options={deviceOptions}
          selected={store.selected_devices}
          loading={devicesQ.isPending}
          onChange={store.setSelectedDevices}
        />
      )}
      {fields.includes("cities") && (
        <FilterMultiSelect
          label={t("filters:city")}
          icon={MapPin}
          options={citiesQ.data ?? []}
          selected={store.selected_cities}
          loading={citiesQ.isPending}
          searchable
          onChange={store.setSelectedCities}
        />
      )}

      {showRanges && <AdvancedRanges />}

      <div className="ml-auto flex items-center gap-2">
        {total > 0 ? (
          <button
            type="button"
            onClick={() => store.resetFilters()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-error-50 hover:text-destructive dark:hover:bg-error-500/10"
          >
            <X className="size-3.5" />
            {t("filters:clear_all")}
          </button>
        ) : (
          <span className="hidden text-xs text-text-dim sm:inline">
            {t("filters:all_data")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

const RANGE_KEYS = ["revenue", "orders", "roas", "conversion"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

const HINTS: Record<RangeKey, string | undefined> = {
  revenue: "₺",
  orders: undefined,
  roas: "x",
  conversion: "%",
};

/** Gelişmiş aralık filtreleri — popover içinde 4 min/max, "Uygula" ile store'a. */
function AdvancedRanges() {
  const { t } = useTranslation(["filters", "common"]);
  const store = useFiltersStore();
  const [open, setOpen] = useState(false);

  const current = (): Record<RangeKey, RangeFilter> => ({
    revenue: { ...store.revenue_range },
    orders: { ...store.orders_range },
    roas: { ...store.roas_range },
    conversion: { ...store.conversion_range },
  });
  const [draft, setDraft] = useState<Record<RangeKey, RangeFilter>>(current);

  useEffect(() => {
    if (open) setDraft(current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeCount = RANGE_KEYS.filter((k) => {
    const r = store[`${k}_range` as const];
    return r.min !== null || r.max !== null;
  }).length;

  const setSide = (k: RangeKey, side: "min" | "max", v: string) => {
    const num = v === "" ? null : Number(v);
    setDraft((d) => ({
      ...d,
      [k]: { ...d[k], [side]: Number.isFinite(num) ? num : null },
    }));
  };

  const apply = () => {
    store.applyFilters({
      revenue_range: draft.revenue,
      orders_range: draft.orders,
      roas_range: draft.roas,
      conversion_range: draft.conversion,
    });
    setOpen(false);
  };

  const clear = () => {
    const empty = { min: null, max: null };
    setDraft({
      revenue: { ...empty },
      orders: { ...empty },
      roas: { ...empty },
      conversion: { ...empty },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            activeCount > 0
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border bg-surface text-text-muted hover:bg-muted hover:text-foreground",
          )}
        >
          <SlidersHorizontal
            className={cn("size-3.5", activeCount > 0 ? "text-primary" : "text-text-dim")}
          />
          {t("filters:advanced")}
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
            {t("filters:section_advanced")}
          </h4>
        </div>
        <div className="space-y-3 p-4">
          {RANGE_KEYS.map((k) => (
            <div key={k} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label className="text-[12px] font-medium">
                  {t(`filters:${k}_range`)}
                </Label>
                {HINTS[k] && (
                  <span className="text-[10px] text-text-dim">{HINTS[k]}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={t("filters:min")}
                  className="h-8 text-xs"
                  value={draft[k].min ?? ""}
                  onChange={(e) => setSide(k, "min", e.target.value)}
                />
                <span className="text-text-dim">–</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={t("filters:max")}
                  className="h-8 text-xs"
                  value={draft[k].max ?? ""}
                  onChange={(e) => setSide(k, "max", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-text-muted hover:text-foreground"
            onClick={clear}
          >
            <RotateCcw className="size-3.5" />
            {t("filters:clear_all")}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={apply}>
            {t("filters:apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
