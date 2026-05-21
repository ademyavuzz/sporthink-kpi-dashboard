import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "primary" | "violet" | "blue" | "emerald" | "amber";

const TONE_CLASSES: Record<Tone, { bg: string; fg: string }> = {
  primary: {
    bg: "bg-primary/10 dark:bg-primary/15",
    fg: "text-primary",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/15",
    fg: "text-violet-600 dark:text-violet-400",
  },
  blue: {
    bg: "bg-sky-50 dark:bg-sky-500/15",
    fg: "text-sky-600 dark:text-sky-400",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/15",
    fg: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/15",
    fg: "text-amber-600 dark:text-amber-400",
  },
};

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: Tone;
}

/**
 * Overview sayfasındaki bölüm başlığı — ikon chip + başlık + alt açıklama.
 *
 * 5 bölümü görsel olarak ayırır (Hero / Pazarlama / E-ticaret / Müşteri /
 * Ürün), her birine domain-spesifik bir ton verir. KPI kartlarındaki ton
 * sistemiyle (primary/violet/blue/emerald/amber) aynı dil.
 */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
}: SectionHeaderProps) {
  const { bg, fg } = TONE_CLASSES[tone];
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-md",
          bg,
        )}
      >
        <Icon className={cn(fg, "size-[18px]")} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
