import { Check, CheckCircle2, Eye, Loader2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type WizardStep = "select" | "preview" | "importing" | "done";

interface StepIndicatorProps {
  current: WizardStep;
}

const STEP_ORDER: WizardStep[] = ["select", "preview", "importing", "done"];

const STEP_META: Record<
  WizardStep,
  { icon: typeof Upload; labelKey: string }
> = {
  select: { icon: Upload, labelKey: "wizard.step_1" },
  preview: { icon: Eye, labelKey: "wizard.step_2" },
  importing: { icon: Loader2, labelKey: "wizard.step_3" },
  done: { icon: CheckCircle2, labelKey: "wizard.step_4" },
};

/** Wizard'ın 4 adımını gösteren progress indicator. */
export function StepIndicator({ current }: StepIndicatorProps) {
  const { t } = useTranslation("imports");
  const currentIdx = STEP_ORDER.indexOf(current);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
      {STEP_ORDER.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;
        const Icon = STEP_META[step].icon;
        const label = t(STEP_META[step].labelKey).replace(/^\d+\.\s*/, "");
        return (
          <div
            key={step}
            className="flex flex-1 items-center gap-2 first:pl-1 last:pr-1"
          >
            <span
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                isCompleted &&
                  "border-success-500 bg-success-500/10 text-success-600 dark:text-success-500",
                isActive &&
                  "border-primary bg-primary text-primary-foreground shadow-sm",
                !isActive &&
                  !isCompleted &&
                  "border-border bg-surface-2 text-text-dim",
              )}
            >
              {isCompleted ? (
                <Check className="size-4" />
              ) : isActive && step === "importing" ? (
                <Icon className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
            </span>
            <div className="hidden min-w-0 flex-1 sm:block">
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-success-600 dark:text-success-500"
                      : "text-text-dim",
                )}
              >
                {String(idx + 1).padStart(2, "0")}
              </p>
              <p
                className={cn(
                  "truncate text-sm font-semibold leading-tight",
                  isActive || isCompleted
                    ? "text-foreground"
                    : "text-text-muted",
                )}
              >
                {label}
              </p>
            </div>
            {idx < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-px flex-1 transition-colors",
                  idx < currentIdx ? "bg-success-500" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
