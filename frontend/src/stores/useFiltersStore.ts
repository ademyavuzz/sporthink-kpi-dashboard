import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  computePresetRange,
  type DatePresetId,
} from "@/components/feature/DateRangePicker";

export type ComparisonMode = "sequential" | "yoy";

export interface RangeFilter {
  min: number | null;
  max: number | null;
}

/**
 * Cross-page filter state — tüm dashboard sayfaları aynı store'u okur.
 *
 * **Temel filtreler (multi-select):** kanal, cihaz, şehir, kampanya.
 * **Gelişmiş filtreler (aralık):** ciro, sipariş, ROAS, dönüşüm oranı.
 * Boş array veya `{ min: null, max: null }` "filtre yok" demektir.
 *
 * URL searchParams ile senkronize edilebilir — `useFilterUrlSync()` hook'u
 * sayfa mount'ında URL'den okur ve değişikliklerde URL'i günceller.
 */
export interface FiltersState {
  // Tarih
  preset: DatePresetId;
  date_from: string;
  date_to: string;
  comparison_mode: ComparisonMode;
  // Temel filtreler
  selected_channels: string[];
  selected_devices: string[];
  selected_cities: string[];
  selected_campaigns: string[];
  // Gelişmiş range filtreler
  revenue_range: RangeFilter;
  orders_range: RangeFilter;
  roas_range: RangeFilter;
  conversion_range: RangeFilter;

  // Setters
  setRange: (preset: DatePresetId, date_from: string, date_to: string) => void;
  setComparisonMode: (m: ComparisonMode) => void;
  setSelectedChannels: (channels: string[]) => void;
  toggleChannel: (channel: string) => void;
  setSelectedDevices: (devices: string[]) => void;
  toggleDevice: (device: string) => void;
  setSelectedCities: (cities: string[]) => void;
  toggleCity: (city: string) => void;
  setSelectedCampaigns: (campaigns: string[]) => void;
  toggleCampaign: (campaign: string) => void;
  setRevenueRange: (r: RangeFilter) => void;
  setOrdersRange: (r: RangeFilter) => void;
  setRoasRange: (r: RangeFilter) => void;
  setConversionRange: (r: RangeFilter) => void;
  /** Tüm temel + gelişmiş filtreleri sıfırlar (tarih hariç). */
  resetFilters: () => void;
  /** Kısmi state'i tek seferde set eder — URL sync ve toplu apply için. */
  applyFilters: (patch: Partial<FiltersState>) => void;
}

const _defaultRange = computePresetRange("last_30");
const _emptyRange: RangeFilter = { min: null, max: null };

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      preset: "last_30",
      date_from: _defaultRange.date_from,
      date_to: _defaultRange.date_to,
      comparison_mode: "sequential",
      selected_channels: [],
      selected_devices: [],
      selected_cities: [],
      selected_campaigns: [],
      revenue_range: { ..._emptyRange },
      orders_range: { ..._emptyRange },
      roas_range: { ..._emptyRange },
      conversion_range: { ..._emptyRange },

      setRange: (preset, date_from, date_to) => set({ preset, date_from, date_to }),
      setComparisonMode: (m) => set({ comparison_mode: m }),
      setSelectedChannels: (channels) => set({ selected_channels: channels }),
      toggleChannel: (channel) =>
        set((s) => ({
          selected_channels: s.selected_channels.includes(channel)
            ? s.selected_channels.filter((c) => c !== channel)
            : [...s.selected_channels, channel],
        })),
      setSelectedDevices: (devices) => set({ selected_devices: devices }),
      toggleDevice: (device) =>
        set((s) => ({
          selected_devices: s.selected_devices.includes(device)
            ? s.selected_devices.filter((d) => d !== device)
            : [...s.selected_devices, device],
        })),
      setSelectedCities: (cities) => set({ selected_cities: cities }),
      toggleCity: (city) =>
        set((s) => ({
          selected_cities: s.selected_cities.includes(city)
            ? s.selected_cities.filter((c) => c !== city)
            : [...s.selected_cities, city],
        })),
      setSelectedCampaigns: (campaigns) => set({ selected_campaigns: campaigns }),
      toggleCampaign: (campaign) =>
        set((s) => ({
          selected_campaigns: s.selected_campaigns.includes(campaign)
            ? s.selected_campaigns.filter((c) => c !== campaign)
            : [...s.selected_campaigns, campaign],
        })),
      setRevenueRange: (r) => set({ revenue_range: r }),
      setOrdersRange: (r) => set({ orders_range: r }),
      setRoasRange: (r) => set({ roas_range: r }),
      setConversionRange: (r) => set({ conversion_range: r }),
      resetFilters: () =>
        set({
          selected_channels: [],
          selected_devices: [],
          selected_cities: [],
          selected_campaigns: [],
          revenue_range: { ..._emptyRange },
          orders_range: { ..._emptyRange },
          roas_range: { ..._emptyRange },
          conversion_range: { ..._emptyRange },
        }),
      applyFilters: (patch) => set(patch as FiltersState),
    }),
    {
      name: "sporthink-filters",
    },
  ),
);

/** Kaç tane aktif filtre var? (toplam görsel için) */
export function countActiveFilters(s: FiltersState): number {
  let n = 0;
  n += s.selected_channels.length > 0 ? 1 : 0;
  n += s.selected_devices.length > 0 ? 1 : 0;
  n += s.selected_cities.length > 0 ? 1 : 0;
  n += s.selected_campaigns.length > 0 ? 1 : 0;
  n += s.revenue_range.min !== null || s.revenue_range.max !== null ? 1 : 0;
  n += s.orders_range.min !== null || s.orders_range.max !== null ? 1 : 0;
  n += s.roas_range.min !== null || s.roas_range.max !== null ? 1 : 0;
  n +=
    s.conversion_range.min !== null || s.conversion_range.max !== null ? 1 : 0;
  return n;
}
