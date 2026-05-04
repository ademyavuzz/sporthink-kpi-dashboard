import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  computePresetRange,
  type DatePresetId,
} from "@/components/feature/DateRangePicker";

export type ComparisonMode = "sequential" | "yoy";

/**
 * Cross-page filter state — tüm dashboard sayfaları aynı filter store'u
 * okur. URL searchParams ile senkronize edilebilir (Sprint 9.1.5).
 *
 * `selected_*`: multi-select filter'lar (boş array → tüm değerler).
 */
export interface FiltersState {
  preset: DatePresetId;
  date_from: string;
  date_to: string;
  comparison_mode: ComparisonMode;
  selected_channels: string[];
  selected_devices: string[];
  selected_cities: string[];

  setRange: (preset: DatePresetId, date_from: string, date_to: string) => void;
  setComparisonMode: (m: ComparisonMode) => void;
  setSelectedChannels: (channels: string[]) => void;
  toggleChannel: (channel: string) => void;
  setSelectedDevices: (devices: string[]) => void;
  toggleDevice: (device: string) => void;
  setSelectedCities: (cities: string[]) => void;
  toggleCity: (city: string) => void;
  resetFilters: () => void;
}

const _defaultRange = computePresetRange("last_30");

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
      resetFilters: () =>
        set({
          selected_channels: [],
          selected_devices: [],
          selected_cities: [],
        }),
    }),
    {
      name: "sporthink-filters",
      // Dialog/modal kapanınca reset olmasın diye filter ve date persist edilir.
    },
  ),
);
