/**
 * Filter store ↔ URL searchParams çevirimi.
 *
 * Kullanım:
 *   const [searchParams, setSearchParams] = useSearchParams();
 *   useFilterUrlSync(searchParams, setSearchParams);
 *
 * URL formatı (örn): `?channels=Direct,Paid+Search&revenue_min=10000`
 * Multi-select'ler virgülle, range'ler ayrı `_min`/`_max` keyleri.
 */
import { useEffect, useRef } from "react";

import {
  useFiltersStore,
  type FiltersState,
  type RangeFilter,
} from "@/stores/useFiltersStore";

const MULTI_KEYS: Array<{
  url: string;
  store: keyof Pick<
    FiltersState,
    | "selected_channels"
    | "selected_devices"
    | "selected_cities"
    | "selected_campaigns"
  >;
}> = [
  { url: "channels", store: "selected_channels" },
  { url: "devices", store: "selected_devices" },
  { url: "cities", store: "selected_cities" },
  { url: "campaigns", store: "selected_campaigns" },
];

const RANGE_KEYS: Array<{
  url: string;
  store: keyof Pick<
    FiltersState,
    "revenue_range" | "orders_range" | "roas_range" | "conversion_range"
  >;
}> = [
  { url: "revenue", store: "revenue_range" },
  { url: "orders", store: "orders_range" },
  { url: "roas", store: "roas_range" },
  { url: "conversion", store: "conversion_range" },
];

function parseList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRange(
  params: URLSearchParams,
  prefix: string,
): RangeFilter | null {
  const min = params.get(`${prefix}_min`);
  const max = params.get(`${prefix}_max`);
  if (min === null && max === null) return null;
  return {
    min: min === null ? null : Number(min),
    max: max === null ? null : Number(max),
  };
}

/** URL → store. Sayfa mount'ında çağırılır. */
export function readFiltersFromUrl(
  searchParams: URLSearchParams,
): Partial<FiltersState> {
  const patch: Partial<FiltersState> = {};
  for (const { url, store } of MULTI_KEYS) {
    const list = parseList(searchParams.get(url));
    if (list.length > 0) {
      (patch as Record<string, unknown>)[store] = list;
    }
  }
  for (const { url, store } of RANGE_KEYS) {
    const range = parseRange(searchParams, url);
    if (range) {
      (patch as Record<string, unknown>)[store] = range;
    }
  }
  return patch;
}

/** Store → URL. Geriye `URLSearchParams` döner; çağıran setSearchParams'a verir. */
export function writeFiltersToUrl(
  searchParams: URLSearchParams,
  state: FiltersState,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const { url, store } of MULTI_KEYS) {
    const list = state[store];
    if (list.length > 0) next.set(url, list.join(","));
    else next.delete(url);
  }
  for (const { url, store } of RANGE_KEYS) {
    const r = state[store];
    if (r.min !== null) next.set(`${url}_min`, String(r.min));
    else next.delete(`${url}_min`);
    if (r.max !== null) next.set(`${url}_max`, String(r.max));
    else next.delete(`${url}_max`);
  }
  return next;
}

/**
 * Sayfa mount'ında URL'den store'u doldurur, store değişince URL'e yansıtır.
 *
 * `setSearchParams` çağrısı `replace: true` ile yapılır — history kirletmez.
 */
export function useFilterUrlSync(
  searchParams: URLSearchParams,
  setSearchParams: (
    next: URLSearchParams,
    options?: { replace?: boolean },
  ) => void,
): void {
  const initialised = useRef(false);

  // Sayfa açılışında URL → store
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const patch = readFiltersFromUrl(searchParams);
    if (Object.keys(patch).length > 0) {
      useFiltersStore.getState().applyFilters(patch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store değişince → URL
  useEffect(() => {
    const unsub = useFiltersStore.subscribe((state) => {
      const next = writeFiltersToUrl(
        new URLSearchParams(window.location.search),
        state,
      );
      const current = window.location.search.replace(/^\?/, "");
      if (next.toString() !== current) {
        setSearchParams(next, { replace: true });
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
