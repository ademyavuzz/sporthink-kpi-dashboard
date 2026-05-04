import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

/**
 * Tema tercihi (persist edilir). Default: dark — mock'taki başlangıç.
 *
 * `<html>` element'ine `.dark` class ekleme/kaldırma `applyThemeToDocument`
 * tarafından main.tsx'te ve store değişiminde yapılır.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "sporthink_theme" },
  ),
);

export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
