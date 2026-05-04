import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/tr";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { useLanguageStore } from "@/stores/useLanguageStore";

/**
 * dayjs config (frontend/CLAUDE.md §11).
 *
 * - Backend her zaman UTC döner; UI gösterimi `Europe/Istanbul`'a çevrilir.
 * - Locale'i `useLanguageStore` ile senkron tutuyoruz.
 * - `new Date(string)` parse YASAK — daima `dayjs(...)` kullan.
 */

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

dayjs.tz.setDefault("Europe/Istanbul");

// Başlangıç locale'i
dayjs.locale(useLanguageStore.getState().lang);

useLanguageStore.subscribe((state, prev) => {
  if (state.lang !== prev.lang) {
    dayjs.locale(state.lang);
  }
});

export { dayjs };
