import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Tüm filtreleri tek dialog'da yöneten panel.
 *
 * - Temel filtreler: kanal, cihaz, şehir (multi-select dropdown)
 * - Gelişmiş filtreler: ciro, sipariş, ROAS, dönüşüm aralığı (min/max input)
 * - Local state'te tutar; "Uygula" basılınca store'a yazar (URL otomatik
 *   senkronize olur — useFilterUrlSync üzerinden)
 */
export function FilterPanel({ open, onOpenChange }: FilterPanelProps) {
  const { t } = useTranslation(["filters", "common"]);
  const store = useFiltersStore();

  // Filter dropdown opsiyonları (channel/device/city)
  const channelsQ = useQuery({
    queryKey: ["filters", "channels"],
    queryFn: () => adminApi.filterChannels(),
    staleTime: 30 * 60 * 1000,
  });
  const devicesQ = useQuery({
    queryKey: ["filters", "devices"],
    queryFn: () => adminApi.filterDevices(),
    staleTime: 30 * 60 * 1000,
  });
  const citiesQ = useQuery({
    queryKey: ["filters", "cities"],
    queryFn: () => adminApi.filterCities(),
    staleTime: 30 * 60 * 1000,
  });

  // Local draft state — Uygula bastıkça store'a yazılır
  const [draft, setDraft] = useState({
    channels: store.selected_channels,
    devices: store.selected_devices,
    cities: store.selected_cities,
    revenue: { ...store.revenue_range },
    orders: { ...store.orders_range },
    roas: { ...store.roas_range },
    conversion: { ...store.conversion_range },
  });

  // Açılınca güncel store değerlerini yükle
  useEffect(() => {
    if (open) {
      setDraft({
        channels: store.selected_channels,
        devices: store.selected_devices,
        cities: store.selected_cities,
        revenue: { ...store.revenue_range },
        orders: { ...store.orders_range },
        roas: { ...store.roas_range },
        conversion: { ...store.conversion_range },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (field: "channels" | "devices" | "cities", value: string) => {
    setDraft((d) => {
      const arr = d[field];
      return {
        ...d,
        [field]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
  };

  const clearField = (field: "channels" | "devices" | "cities") => {
    setDraft((d) => ({ ...d, [field]: [] }));
  };

  const setRange = (
    field: "revenue" | "orders" | "roas" | "conversion",
    side: "min" | "max",
    value: string,
  ) => {
    const num = value === "" ? null : Number(value);
    setDraft((d) => ({
      ...d,
      [field]: { ...d[field], [side]: Number.isFinite(num) ? num : null },
    }));
  };

  const handleApply = () => {
    store.applyFilters({
      selected_channels: draft.channels,
      selected_devices: draft.devices,
      selected_cities: draft.cities,
      revenue_range: draft.revenue,
      orders_range: draft.orders,
      roas_range: draft.roas,
      conversion_range: draft.conversion,
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    setDraft({
      channels: [],
      devices: [],
      cities: [],
      revenue: { min: null, max: null },
      orders: { min: null, max: null },
      roas: { min: null, max: null },
      conversion: { min: null, max: null },
    });
  };

  const activeCount = countActiveFilters(store);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b border-border/60 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </span>
            <span>{t("filters:panel_title")}</span>
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-7 overflow-y-auto px-6 py-5">
          {/* Temel Filtreler */}
          <Section title={t("filters:section_basic")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MultiSelect
                label={t("filters:channel")}
                options={channelsQ.data ?? []}
                selected={draft.channels}
                loading={channelsQ.isPending}
                onToggle={(v) => toggle("channels", v)}
                onClear={() => clearField("channels")}
              />
              <MultiSelect
                label={t("filters:device")}
                options={devicesQ.data ?? []}
                selected={draft.devices}
                loading={devicesQ.isPending}
                onToggle={(v) => toggle("devices", v)}
                onClear={() => clearField("devices")}
              />
              <MultiSelect
                label={t("filters:city")}
                options={citiesQ.data ?? []}
                selected={draft.cities}
                loading={citiesQ.isPending}
                onToggle={(v) => toggle("cities", v)}
                onClear={() => clearField("cities")}
                searchable
              />
            </div>
          </Section>

          {/* Gelişmiş Filtreler */}
          <Section title={t("filters:section_advanced")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RangeRow
                label={t("filters:revenue_range")}
                hint="₺"
                value={draft.revenue}
                onChange={(side, v) => setRange("revenue", side, v)}
              />
              <RangeRow
                label={t("filters:orders_range")}
                value={draft.orders}
                onChange={(side, v) => setRange("orders", side, v)}
              />
              <RangeRow
                label={t("filters:roas_range")}
                hint="x"
                value={draft.roas}
                onChange={(side, v) => setRange("roas", side, v)}
              />
              <RangeRow
                label={t("filters:conversion_range")}
                hint="%"
                value={draft.conversion}
                onChange={(side, v) => setRange("conversion", side, v)}
              />
            </div>
          </Section>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button
            variant="ghost"
            onClick={handleClear}
            className="gap-1.5 text-text-muted hover:text-foreground"
          >
            <RotateCcw className="size-4" />
            {t("filters:clear_all")}
          </Button>
          <Button onClick={handleApply}>{t("filters:apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Çoklu seçim dropdown — tetikleyici buton + popover içinde checkbox listesi. */
function MultiSelect({
  label,
  options,
  selected,
  loading,
  onToggle,
  onClear,
  searchable,
}: {
  label: string;
  options: string[];
  selected: string[];
  loading?: boolean;
  onToggle: (value: string) => void;
  onClear: () => void;
  searchable?: boolean;
}) {
  const { t } = useTranslation(["filters", "common"]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return options.filter((o) => o.toLocaleLowerCase("tr-TR").includes(q));
  }, [options, query, searchable]);

  const summary =
    selected.length === 0
      ? t("filters:all_option")
      : selected.length === 1
        ? selected[0]
        : t("filters:n_selected", { count: selected.length });

  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium text-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={loading}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-xs font-medium transition-colors",
              selected.length > 0
                ? "border-primary/50 bg-primary/5 text-foreground"
                : "border-border bg-surface text-text-muted hover:bg-muted",
              loading && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="truncate">{summary}</span>
            <span className="flex shrink-0 items-center gap-1">
              {selected.length > 0 && (
                <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {selected.length}
                </span>
              )}
              <ChevronDown className="size-3.5 opacity-60" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
        >
          {searchable && (
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common:search")}
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <p className="p-3 text-center text-xs text-text-muted">
                {t("filters:no_option")}
              </p>
            ) : (
              visible.map((opt) => {
                const active = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onToggle(opt)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="truncate">{opt}</span>
                    {active && <Check className="size-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start gap-1 text-xs text-text-muted hover:text-foreground"
                onClick={onClear}
              >
                <RotateCcw className="size-3" />
                {t("filters:clear_selection")}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RangeRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: RangeFilter;
  onChange: (side: "min" | "max", v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-[12px] font-medium">{label}</Label>
        {hint && <span className="text-[10px] text-text-dim">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="min"
          className="h-9 text-xs"
          value={value.min ?? ""}
          onChange={(e) => onChange("min", e.target.value)}
        />
        <span className="text-text-dim">/</span>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="max"
          className="h-9 text-xs"
          value={value.max ?? ""}
          onChange={(e) => onChange("max", e.target.value)}
        />
      </div>
    </div>
  );
}
