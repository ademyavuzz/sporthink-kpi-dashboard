import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

import { useLanguageStore } from "@/stores/useLanguageStore";

/**
 * i18next config — TR default, EN secondary.
 *
 * Namespace stratejisi: `common`, `auth`, `errors` (frontend/CLAUDE.md §7.2).
 * Çeviri dosyaları `public/locales/<lang>/<namespace>.json` üzerinden
 * HttpBackend ile lazy load edilir. Dil seçimi `useLanguageStore`
 * tarafından kalıcı tutulur ve burada başlangıçta okunur.
 */

const initialLang = useLanguageStore.getState().lang;

void i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: initialLang,
    fallbackLng: "tr",
    supportedLngs: ["tr", "en"],
    ns: [
      "common",
      "auth",
      "errors",
      "imports",
      "admin",
      "dashboard",
      "notifications",
      "settings",
      "filters",
      "reports",
    ],
    defaultNS: "common",
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });

// Store değişimini i18next ile senkronla.
useLanguageStore.subscribe((state, prev) => {
  if (state.lang !== prev.lang) {
    void i18n.changeLanguage(state.lang);
  }
});

export default i18n;
