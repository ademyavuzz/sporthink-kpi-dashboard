import { useQuery } from "@tanstack/react-query";
import { BarChart3, KeyRound, Loader2, Settings, Shield, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

interface PermissionPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const CATEGORY_ORDER = ["view", "data", "admin", "system"] as const;

/** Her kategori için ikon + tema rengi (UI'da hiyerarşiyi pekiştirir). */
const CATEGORY_META: Record<
  string,
  { icon: typeof BarChart3; toneClass: string }
> = {
  view: {
    icon: BarChart3,
    toneClass: "text-brand-blue bg-brand-blue/10",
  },
  data: {
    icon: KeyRound,
    toneClass:
      "text-success-600 bg-success-500/10 dark:text-success-500",
  },
  admin: {
    icon: Users,
    toneClass: "text-primary bg-primary/10",
  },
  system: {
    icon: Settings,
    toneClass:
      "text-warning-600 bg-warning-500/10 dark:text-warning-500",
  },
};

/**
 * Rol oluşturma/düzenleme için kategori-bazlı izin seçici.
 *
 * - 4 kategori, her biri kendi card'ında (view/data/admin/system)
 * - Kategori başlığında ikon + label + sayaç + "Tümü" / "Temizle" toggle
 * - Tek tıkla satır seçimi (label tıklanabilir, checkbox ile aynı davranış)
 * - Kategoriyi daraltıp genişletebilme
 */
export function PermissionPicker({
  selected,
  onChange,
  disabled,
}: PermissionPickerProps) {
  const q = useQuery({
    queryKey: ["permissions", "grouped"],
    queryFn: () => adminApi.listPermissions(),
    staleTime: 60 * 60_000, // 1 saat
  });

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (q.isPending) {
    return (
      <div className="py-12 text-center text-text-muted">
        <Loader2 className="size-5 animate-spin mx-auto" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <p className="text-sm text-destructive py-4 text-center">
        İzin listesi yüklenemedi.
      </p>
    );
  }

  const togglePermission = (code: string) => {
    if (selectedSet.has(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const toggleCategory = (categoryCodes: string[]) => {
    const allSelected = categoryCodes.every((c) => selectedSet.has(c));
    if (allSelected) {
      onChange(selected.filter((c) => !categoryCodes.includes(c)));
    } else {
      const newSet = new Set(selected);
      categoryCodes.forEach((c) => newSet.add(c));
      onChange(Array.from(newSet));
    }
  };

  const toggleCollapsed = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const orderedEntries = CATEGORY_ORDER.flatMap((key) => {
    const items = q.data?.[key];
    return items ? [[key, items] as const] : [];
  });

  return (
    <div className="space-y-3">
      {orderedEntries.map(([cat, items]) => {
        const codes = items.map((i) => i.code);
        const selectedInCat = codes.filter((c) => selectedSet.has(c)).length;
        const allInCat = codes.length;
        const allSelected = selectedInCat === allInCat;
        const isCollapsed = collapsed.has(cat);
        const meta = CATEGORY_META[cat] ?? { icon: Shield, toneClass: "" };
        const Icon = meta.icon;

        return (
          <div
            key={cat}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            {/* Kategori başlığı */}
            <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-3 py-2.5">
              <Checkbox
                id={`cat-${cat}`}
                checked={
                  allSelected
                    ? true
                    : selectedInCat === 0
                      ? false
                      : "indeterminate"
                }
                onCheckedChange={() => !disabled && toggleCategory(codes)}
                disabled={disabled}
              />
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
                  meta.toneClass,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <Label
                htmlFor={`cat-${cat}`}
                className="flex-1 cursor-pointer text-sm font-semibold text-foreground"
              >
                {items[0]?.category_label ?? cat}
              </Label>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  selectedInCat > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-text-muted",
                )}
              >
                {selectedInCat}
                <span className="opacity-50">/</span>
                {allInCat}
              </span>
              <button
                type="button"
                onClick={() => toggleCollapsed(cat)}
                aria-label={isCollapsed ? "Genişlet" : "Daralt"}
                className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-foreground transition-colors"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className={cn(
                    "size-3.5 transition-transform",
                    isCollapsed && "-rotate-90",
                  )}
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* İzinler grid */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-x-3 gap-y-1 p-2 sm:grid-cols-2">
                {items.map((p) => {
                  const checked = selectedSet.has(p.code);
                  return (
                    <label
                      key={p.code}
                      htmlFor={`perm-${p.code}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                        checked
                          ? "border-primary/30 bg-primary/[0.04]"
                          : "border-transparent hover:bg-muted/50",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Checkbox
                        id={`perm-${p.code}`}
                        checked={checked}
                        onCheckedChange={() =>
                          !disabled && togglePermission(p.code)
                        }
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium leading-tight text-foreground">
                          {p.description ?? p.code}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-text-dim">
                          {p.code}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
