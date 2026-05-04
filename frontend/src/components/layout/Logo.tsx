import wordmarkBlack from "@/assets/brand/sporthink-wordmark-black.png";
import wordmarkWhite from "@/assets/brand/sporthink-wordmark-white.png";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/useThemeStore";

interface LogoProps {
  /** Sidebar collapsed gibi dar alanlar için ikonik (S tile) gösterim. */
  small?: boolean;
  className?: string;
}

/**
 * Sporthink wordmark.
 *
 * - `small=true` → sadece "S" tile (sidebar collapsed).
 * - Aksi halde tema-bilinçli wordmark PNG (`assets/brand/`).
 *   Light bg → siyah varyant, dark bg → beyaz varyant.
 */
export function Logo({ small, className }: LogoProps) {
  const theme = useThemeStore((s) => s.theme);

  if (small) {
    return (
      <img
        src="/favicon.png"
        alt="Sporthink"
        draggable={false}
        className={cn("size-9 select-none", className)}
      />
    );
  }

  const src = theme === "dark" ? wordmarkWhite : wordmarkBlack;

  return (
    <img
      src={src}
      alt="Sporthink"
      draggable={false}
      className={cn("h-8 w-auto select-none", className)}
    />
  );
}
