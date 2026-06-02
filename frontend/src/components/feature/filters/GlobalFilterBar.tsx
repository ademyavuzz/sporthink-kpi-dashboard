import { useQuery } from "@tanstack/react-query";
import { MapPin, MonitorSmartphone, Radio, SlidersHorizontal, X } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FilterMultiSelect } from "@/components/feature/filters/FilterMultiSelect";
import { FilterSheet, type FilterField } from "@/components/feature/filters/FilterSheet";
import { adminApi } from "@/lib/api/admin";
import {
  countActiveFilters,
  useFiltersStore,
} from "@/stores/useFiltersStore";

export type { FilterField };

interface GlobalFilterBarProps {
  /** Inline + panelde gösterilecek multi-select filtreler (sayfaya göre). */
  fields?: FilterField[];
  /** Gelişmiş aralık filtreleri (ciro/sipariş/ROAS/dönüşüm) — panelde. */
  showRanges?: boolean;
  /** Çubuğun sağına yerleşen ek kontrol(ler) — ör. tarih aralığı + karşılaştırma. */
  trailing?: ReactNode;
}

/**
 * Dashboard filtre çubuğu.
 *
 * - "Filtreler" butonu → sağdan açılan gelişmiş panel (FilterSheet): sayfanın
 *   TÜM filtreleri tek yerde, taslak + Uygula.
 * - Yanında hızlı erişim için inline dropdown'lar (anında uygulanır).
 * - `fields`/`showRanges` ile sayfaya göre yapılandırılır; her sayfada yalnız
 *   backend'in doğru desteklediği filtreler gösterilir.
 */
export function GlobalFilterBar({
  fields = ["channels", "devices"],
  showRanges = false,
  trailing,
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

  const total = countActiveFilters(store);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 shadow-theme-xs">
      <FilterSheet
        fields={fields}
        showRanges={showRanges}
        trigger={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <SlidersHorizontal className="size-3.5 text-primary" />
            {t("filters:open_button")}
            {total > 0 && (
              <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {total}
              </span>
            )}
          </button>
        }
      />

      <div className="hidden h-5 w-px bg-border/70 sm:block" />

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
          options={(devicesQ.data ?? []).filter((d) => d !== "all")}
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

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {total > 0 && (
          <button
            type="button"
            onClick={() => store.resetFilters()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-error-50 hover:text-destructive dark:hover:bg-error-500/10"
          >
            <X className="size-3.5" />
            {t("filters:clear_all")}
          </button>
        )}
        {total === 0 && !trailing && (
          <span className="hidden text-xs text-text-dim sm:inline">
            {t("filters:all_data")}
          </span>
        )}
        {trailing && (
          <>
            <div className="hidden h-5 w-px bg-border/70 sm:block" />
            {trailing}
          </>
        )}
      </div>
    </div>
  );
}
