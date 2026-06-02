import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export interface MetricOption {
  /** Stabil tanimlayici (seri adindan bagimsiz, state key olarak kullanilir). */
  id: string;
  /** Kullaniciya gosterilen etiket (cagiran tarafta i18n ile cozulmus). */
  label: string;
  /** Bu metrigin grafikteki seri rengi — chip uzerindeki nokta. */
  color?: string;
}

interface MetricTogglesProps {
  /** Secilebilir metrik listesi. */
  options: MetricOption[];
  /** Su anda secili metrik id'leri. */
  selected: string[];
  /** Secim degisince cagrilir. En az 1 metrik her zaman secili kalir. */
  onChange: (next: string[]) => void;
  className?: string;
}

/**
 * Trend/zaman-serisi grafikleri icin metrik secici. Chip/toggle grubu olarak
 * render edilir; kullanici hangi metrikleri gormek/karsilastirmak istedigini
 * secer. Tek grafikte coklu metrik gosterilebilir.
 *
 * Kurallar:
 * - En az 1 metrik her zaman secili kalir (son secili kapatilamaz).
 * - Secim sayfa-local state (persist edilmez), cagiran taraf yonetir.
 * - Renk noktasi seri rengiyle ayni, boylece grafikle birebir eslesir.
 */
export function MetricToggles({
  options,
  selected,
  onChange,
  className,
}: MetricTogglesProps) {
  const { t } = useTranslation("dashboard");

  if (options.length < 2) return null;

  const toggle = (id: string) => {
    const isActive = selected.includes(id);
    // Son secili metrik kapatilamaz — en az 1 acik kalir.
    if (isActive && selected.length === 1) return;
    const next = isActive
      ? selected.filter((m) => m !== id)
      : [...selected, id];
    onChange(next);
  };

  return (
    <div
      role="group"
      aria-label={t("chart_metrics.aria_label")}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {options.map((opt) => {
        const isActive = selected.includes(opt.id);
        const isLastActive = isActive && selected.length === 1;
        return (
          <button
            key={opt.id}
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-disabled={isLastActive || undefined}
            title={isLastActive ? t("chart_metrics.keep_one") : undefined}
            onClick={() => toggle(opt.id)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
              isActive
                ? "border-border bg-surface-2 text-foreground"
                : "border-transparent bg-transparent text-text-muted hover:bg-surface-2/60 hover:text-foreground",
              isLastActive && "cursor-default",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full transition-opacity",
                isActive ? "opacity-100" : "opacity-30",
              )}
              style={
                opt.color ? { backgroundColor: opt.color } : undefined
              }
            />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
