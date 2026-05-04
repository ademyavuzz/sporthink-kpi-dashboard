import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "tr" | "en";

interface LanguageState {
  lang: Lang;
  setLanguage: (lang: Lang) => void;
}

/**
 * Dil tercihi (persist edilir).
 * Default: TR. Browser dilinden algılama yapmıyoruz — proje varsayılı TR.
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: "tr",
      setLanguage: (lang) => set({ lang }),
    }),
    { name: "sporthink_lang" },
  ),
);
