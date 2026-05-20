import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

import { emptyEcomFilter, type EcomFilterValue } from "./ecomFilter";

interface EcommerceFiltersProps {
  value: EcomFilterValue;
  onChange: (value: EcomFilterValue) => void;
}

/**
 * E-ticaret sayfası özelinde filtre çubuğu (kategori, marka, durum,
 * ödeme yöntemi). Her dropdown bir popover; seçim
 * değişikliği üst sayfaya `onChange` ile yansır ve sayfa veriyi
 * yeniden çeker.
 */
export function EcommerceFilters({ value, onChange }: EcommerceFiltersProps) {
  const { t } = useTranslation(["dashboard", "filters", "common"]);

  const categoriesQ = useQuery({
    queryKey: ["filters", "categories"],
    queryFn: () => adminApi.filterCategories(),
    staleTime: 30 * 60 * 1000,
  });
  const brandsQ = useQuery({
    queryKey: ["filters", "brands"],
    queryFn: () => adminApi.filterBrands(),
    staleTime: 30 * 60 * 1000,
  });
  const statusesQ = useQuery({
    queryKey: ["filters", "order-statuses"],
    queryFn: () => adminApi.filterOrderStatuses(),
    staleTime: 60 * 60 * 1000,
  });
  const paymentMethodsQ = useQuery({
    queryKey: ["filters", "payment-methods"],
    queryFn: () => adminApi.filterPaymentMethods(),
    staleTime: 60 * 60 * 1000,
  });

  const setField = <K extends keyof EcomFilterValue>(
    key: K,
    next: EcomFilterValue[K],
  ) => onChange({ ...value, [key]: next });

  const clearAll = () => onChange(emptyEcomFilter);

  const activeCount =
    value.categories.length +
    value.brands.length +
    value.statuses.length +
    value.payment_methods.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectDropdown
        label={t("dashboard:ecom.filter_category")}
        options={categoriesQ.data ?? []}
        loading={categoriesQ.isPending}
        selected={value.categories}
        onChange={(next) => setField("categories", next)}
      />
      <MultiSelectDropdown
        label={t("dashboard:ecom.filter_brand")}
        options={brandsQ.data ?? []}
        loading={brandsQ.isPending}
        selected={value.brands}
        onChange={(next) => setField("brands", next)}
        searchable
      />
      <MultiSelectDropdown
        label={t("dashboard:ecom.filter_status")}
        options={statusesQ.data ?? []}
        loading={statusesQ.isPending}
        selected={value.statuses}
        onChange={(next) => setField("statuses", next)}
        renderOption={(o) => t(`dashboard:ecom.status_${o}`, { defaultValue: o })}
      />
      <MultiSelectDropdown
        label={t("dashboard:ecom.filter_payment")}
        options={paymentMethodsQ.data ?? []}
        loading={paymentMethodsQ.isPending}
        selected={value.payment_methods}
        onChange={(next) => setField("payment_methods", next)}
        renderOption={(o) => t(`dashboard:ecom.payment_${o}`, { defaultValue: o })}
      />
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-9 gap-1 text-text-muted hover:text-foreground"
        >
          <X className="size-3.5" />
          {t("filters:clear_all")}
          <span className="ml-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
            {activeCount}
          </span>
        </Button>
      )}
    </div>
  );
}

interface MultiSelectProps {
  label: string;
  options: string[];
  loading?: boolean;
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  renderOption?: (value: string) => string;
}

function MultiSelectDropdown({
  label,
  options,
  loading,
  selected,
  onChange,
  searchable,
  renderOption,
}: MultiSelectProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return options.filter((o) => o.toLocaleLowerCase("tr-TR").includes(q));
  }, [options, query, searchable]);

  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 px-3 text-xs font-medium",
            selected.length > 0 && "border-primary/50 bg-primary/5 text-primary",
          )}
        >
          <span>{label}</span>
          {selected.length > 0 && (
            <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {searchable && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
        )}
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 w-full animate-pulse rounded bg-muted/40"
                />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="p-3 text-center text-xs text-text-muted">—</p>
          ) : (
            visible.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    checked
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="truncate">
                    {renderOption ? renderOption(opt) : opt}
                  </span>
                  {checked && <Check className="size-3.5 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-start gap-1 text-xs text-text-muted hover:text-foreground"
              onClick={() => onChange([])}
            >
              <X className="size-3" />
              {t("clear")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

