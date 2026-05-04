import { useQuery } from "@tanstack/react-query";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
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
 * - Temel filtreler: kanal, cihaz, şehir (multi-select chips)
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

  const toggle = (
    field: "channels" | "devices" | "cities",
    value: string,
  ) => {
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
            <ChipGroup
              label={t("filters:channel")}
              options={channelsQ.data ?? []}
              selected={draft.channels}
              loading={channelsQ.isPending}
              onToggle={(v) => toggle("channels", v)}
            />
            <ChipGroup
              label={t("filters:device")}
              options={devicesQ.data ?? []}
              selected={draft.devices}
              loading={devicesQ.isPending}
              onToggle={(v) => toggle("devices", v)}
            />
            <ChipGroup
              label={t("filters:city")}
              options={citiesQ.data ?? []}
              selected={draft.cities}
              loading={citiesQ.isPending}
              onToggle={(v) => toggle("cities", v)}
              capPreview
            />
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

function ChipGroup({
  label,
  options,
  selected,
  loading,
  onToggle,
  capPreview,
}: {
  label: string;
  options: string[];
  selected: string[];
  loading?: boolean;
  onToggle: (value: string) => void;
  /** Çok sayıda seçenekte ilk 30'u göster + "Daha fazla" toggle. */
  capPreview?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const limit = capPreview && !showAll ? 30 : options.length;
  const visible = options.slice(0, limit);
  const more = options.length - visible.length;

  return (
    <div className="space-y-2">
      <Label className="text-[12px] font-medium text-foreground">{label}</Label>
      {loading ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="h-7 w-20 rounded-full bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : options.length === 0 ? (
        <p className="text-xs text-text-muted">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-text-muted hover:bg-muted hover:text-foreground",
                )}
              >
                {opt}
              </button>
            );
          })}
          {more > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center rounded-full border border-dashed border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-muted"
            >
              +{more}
            </button>
          )}
        </div>
      )}
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
        <span className="text-text-dim">–</span>
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
