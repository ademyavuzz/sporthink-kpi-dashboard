import { useQuery } from "@tanstack/react-query";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FilterMultiSelect } from "@/components/feature/filters/FilterMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import { useFiltersStore, type RangeFilter } from "@/stores/useFiltersStore";

export type FilterField = "channels" | "devices" | "cities";

const RANGE_KEYS = ["revenue", "orders", "roas", "conversion"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];
const RANGE_HINT: Record<RangeKey, string | undefined> = {
  revenue: "₺",
  orders: undefined,
  roas: "x",
  conversion: "%",
};

interface FilterSheetProps {
  fields: FilterField[];
  showRanges?: boolean;
  trigger: ReactNode;
}

interface Draft {
  channels: string[];
  devices: string[];
  cities: string[];
  ranges: Record<RangeKey, RangeFilter>;
}

/**
 * Sağdan açılan gelişmiş filtre paneli — sayfanın TÜM filtreleri tek yerde,
 * kategorilere ayrılmış. Taslak state'te toplanır; "Uygula" ile store'a yazılır
 * (tüm bağlı sorgular tek seferde refetch eder). `fields`/`showRanges` ile
 * sayfaya göre yapılandırılır.
 */
export function FilterSheet({ fields, showRanges = false, trigger }: FilterSheetProps) {
  const { t } = useTranslation(["filters", "common"]);
  const store = useFiltersStore();
  const [open, setOpen] = useState(false);

  const channelsQ = useQuery({
    queryKey: ["filters", "channels"],
    queryFn: () => adminApi.filterChannels(),
    staleTime: 30 * 60 * 1000,
    enabled: open && fields.includes("channels"),
  });
  const devicesQ = useQuery({
    queryKey: ["filters", "devices"],
    queryFn: () => adminApi.filterDevices(),
    staleTime: 30 * 60 * 1000,
    enabled: open && fields.includes("devices"),
  });
  const citiesQ = useQuery({
    queryKey: ["filters", "cities"],
    queryFn: () => adminApi.filterCities(),
    staleTime: 30 * 60 * 1000,
    enabled: open && fields.includes("cities"),
  });

  const snapshot = (): Draft => ({
    channels: store.selected_channels,
    devices: store.selected_devices,
    cities: store.selected_cities,
    ranges: {
      revenue: { ...store.revenue_range },
      orders: { ...store.orders_range },
      roas: { ...store.roas_range },
      conversion: { ...store.conversion_range },
    },
  });
  const [draft, setDraft] = useState<Draft>(snapshot);

  useEffect(() => {
    if (open) setDraft(snapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setRangeSide = (k: RangeKey, side: "min" | "max", v: string) => {
    const num = v === "" ? null : Number(v);
    setDraft((d) => ({
      ...d,
      ranges: { ...d.ranges, [k]: { ...d.ranges[k], [side]: Number.isFinite(num) ? num : null } },
    }));
  };

  const draftCount =
    (draft.channels.length ? 1 : 0) +
    (draft.devices.length ? 1 : 0) +
    (draft.cities.length ? 1 : 0) +
    (showRanges
      ? RANGE_KEYS.filter((k) => draft.ranges[k].min !== null || draft.ranges[k].max !== null).length
      : 0);

  const apply = () => {
    store.applyFilters({
      selected_channels: draft.channels,
      selected_devices: draft.devices,
      selected_cities: draft.cities,
      ...(showRanges
        ? {
            revenue_range: draft.ranges.revenue,
            orders_range: draft.ranges.orders,
            roas_range: draft.ranges.roas,
            conversion_range: draft.ranges.conversion,
          }
        : {}),
    });
    setOpen(false);
  };

  const clear = () =>
    setDraft({
      channels: [],
      devices: [],
      cities: [],
      ranges: {
        revenue: { min: null, max: null },
        orders: { min: null, max: null },
        roas: { min: null, max: null },
        conversion: { min: null, max: null },
      },
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </span>
            {t("filters:panel_title")}
            {draftCount > 0 && (
              <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {draftCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
              {t("filters:section_basic")}
            </h4>
            <div className="space-y-2.5">
              {fields.includes("channels") && (
                <FilterMultiSelect
                  label={t("filters:channel")}
                  className="w-full"
                  options={channelsQ.data ?? []}
                  selected={draft.channels}
                  loading={channelsQ.isPending}
                  onChange={(v) => setDraft((d) => ({ ...d, channels: v }))}
                />
              )}
              {fields.includes("devices") && (
                <FilterMultiSelect
                  label={t("filters:device")}
                  className="w-full"
                  options={(devicesQ.data ?? []).filter((x) => x !== "all")}
                  selected={draft.devices}
                  loading={devicesQ.isPending}
                  onChange={(v) => setDraft((d) => ({ ...d, devices: v }))}
                />
              )}
              {fields.includes("cities") && (
                <FilterMultiSelect
                  label={t("filters:city")}
                  className="w-full"
                  options={citiesQ.data ?? []}
                  selected={draft.cities}
                  loading={citiesQ.isPending}
                  searchable
                  onChange={(v) => setDraft((d) => ({ ...d, cities: v }))}
                />
              )}
            </div>
          </section>

          {showRanges && (
            <section className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                {t("filters:section_advanced")}
              </h4>
              <div className="space-y-3">
                {RANGE_KEYS.map((k) => (
                  <div key={k} className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <Label className="text-[12px] font-medium">{t(`filters:${k}_range`)}</Label>
                      {RANGE_HINT[k] && (
                        <span className="text-[10px] text-text-dim">{RANGE_HINT[k]}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder={t("filters:min")}
                        className="h-9 text-xs"
                        value={draft.ranges[k].min ?? ""}
                        onChange={(e) => setRangeSide(k, "min", e.target.value)}
                      />
                      <span className="text-text-dim">–</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder={t("filters:max")}
                        className="h-9 text-xs"
                        value={draft.ranges[k].max ?? ""}
                        onChange={(e) => setRangeSide(k, "max", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-5 py-4">
          <Button
            variant="ghost"
            className={cn("gap-1.5 text-text-muted hover:text-foreground")}
            onClick={clear}
          >
            <RotateCcw className="size-4" />
            {t("filters:clear_all")}
          </Button>
          <Button onClick={apply}>{t("filters:apply")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
