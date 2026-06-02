import { Check, ChevronDown, RotateCcw, Search } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterMultiSelectProps {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  options: string[];
  selected: string[];
  loading?: boolean;
  searchable?: boolean;
  /** Tetikleyici buton için ek sınıf (ör. panelde `w-full`). */
  className?: string;
  /** Yeni seçim listesi — store'a anında yazılır (instant-apply). */
  onChange: (next: string[]) => void;
}

/**
 * Inline çoklu-seçim filtre dropdown'u (instant-apply).
 *
 * Tetikleyici buton seçili durumu özetler (etiket + ilk değer / "N seçili" +
 * sayaç rozeti). Popover içinde aranabilir checkbox listesi. Her tıklamada
 * `onChange` çağrılır → store güncellenir → TanStack Query otomatik refetch.
 */
export function FilterMultiSelect({
  label,
  icon: Icon,
  options,
  selected,
  loading,
  searchable,
  className,
  onChange,
}: FilterMultiSelectProps) {
  const { t } = useTranslation(["filters", "common"]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return options.filter((o) => o.toLocaleLowerCase("tr-TR").includes(q));
  }, [options, query, searchable]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const active = selected.length > 0;
  const summary = !active
    ? t("filters:all_option")
    : selected.length === 1
      ? selected[0]
      : t("filters:n_selected", { count: selected.length });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            active
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border bg-surface text-text-muted hover:bg-muted hover:text-foreground",
            loading && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          {Icon && (
            <Icon
              className={cn("size-3.5", active ? "text-primary" : "text-text-dim")}
            />
          )}
          <span className={cn(active ? "text-text-muted" : "")}>{label}</span>
          <span className="max-w-[120px] truncate font-semibold text-foreground">
            {summary}
          </span>
          {selected.length > 1 && (
            <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto size-3.5 shrink-0 opacity-60 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        {searchable && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common:search")}
                className="h-8 pl-7 text-xs"
                autoFocus
              />
            </div>
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {loading ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 animate-pulse rounded-md bg-muted/40" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="p-3 text-center text-xs text-text-muted">
              {t("filters:no_option")}
            </p>
          ) : (
            visible.map((opt) => {
              const isOn = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    isOn
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      isOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {isOn && <Check className="size-3" />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })
          )}
        </div>
        {active && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-start gap-1.5 text-xs text-text-muted hover:text-foreground"
              onClick={() => onChange([])}
            >
              <RotateCcw className="size-3" />
              {t("filters:clear_selection")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
