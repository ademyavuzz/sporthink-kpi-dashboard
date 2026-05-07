import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CardInfoTooltipProps {
  /** Tooltip içeriği (kısa açıklama, ~80 karakter). */
  content: string;
  /** Custom aria-label (default: "Hakkında"). */
  label?: string;
  /** İkon boyutu — section header'larda 14px, kompakt yerlerde 12px. */
  size?: "sm" | "md";
  /** Ekstra class — örn. negative margin için. */
  className?: string;
}

/**
 * Section card başlıklarında "ne hakkında" tooltip'i.
 *
 * Klavye erişimi: button olarak render edildiği için Tab ile odaklanabilir.
 * Hover + focus tetikler. Mobile'da tap → toggle.
 */
export function CardInfoTooltip({
  content,
  label,
  size = "md",
  className,
}: CardInfoTooltipProps) {
  const { t } = useTranslation("common");
  const ariaLabel = label ?? t("info_about", { defaultValue: "Hakkında" });
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-text-muted/60 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
          )}
        >
          <Info className={iconSize} strokeWidth={2.2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-[280px]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
