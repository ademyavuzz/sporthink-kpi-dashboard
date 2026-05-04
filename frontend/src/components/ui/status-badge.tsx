import * as React from "react";

import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  size?: "sm" | "md";
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  warning:
    "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  neutral:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
} as const;

/**
 * TailAdmin pattern status pill — `rounded-full bg-{tone}-50 text-{tone}-600`.
 *
 * KPI delta'larında, tablo durum kolonlarında, alert chip'lerinde tutarlı
 * bir vocabulary için kullanılır.
 */
export function StatusBadge({
  tone = "neutral",
  size = "sm",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
