import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type WizardStep = "select" | "preview" | "importing" | "done";

interface StepIndicatorProps {
  current: WizardStep;
}

const STEP_ORDER: WizardStep[] = ["select", "preview", "importing", "done"];

const STEP_KEYS: Record<WizardStep, string> = {
  select: "wizard.step_1",
  preview: "wizard.step_2",
  importing: "wizard.step_3",
  done: "wizard.step_4",
};

/** Wizard'ın 4 adımını gösteren progress indicator. */
export function StepIndicator({ current }: StepIndicatorProps) {
  const { t } = useTranslation("imports");
  const currentIdx = STEP_ORDER.indexOf(current);

  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_ORDER.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1">
            <div
              className={cn(
                "flex items-center gap-2 flex-1",
                isActive && "text-foreground",
                !isActive && !isCompleted && "text-muted-foreground",
                isCompleted && "text-foreground",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "border-border",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                {t(STEP_KEYS[step]).replace(/^\d+\.\s*/, "")}
              </span>
            </div>
            {idx < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2",
                  idx < currentIdx ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
