import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api/admin";

interface PermissionPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const CATEGORY_ORDER = ["view", "data", "admin", "system"];

/**
 * Rol oluşturma/düzenleme için kategori-bazlı izin seçici.
 *
 * - 4 kategori (Veri Görüntüleme, Veri İşlemleri, Kullanıcı/Rol, Sistem)
 * - Her kategoride "tümünü seç" toggle
 * - 37 izin bütün olarak seçim, kategori başlığında sayaç (3/9 gibi)
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

  if (q.isPending) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
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

  // Kategorileri sıralı göster
  const orderedEntries = CATEGORY_ORDER.flatMap((key) => {
    const items = q.data?.[key];
    return items ? [[key, items] as const] : [];
  });

  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
      {orderedEntries.map(([cat, items]) => {
        const codes = items.map((i) => i.code);
        const selectedInCat = codes.filter((c) => selectedSet.has(c)).length;
        const allInCat = codes.length;
        const allSelected = selectedInCat === allInCat;

        return (
          <div key={cat} className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                <Label
                  htmlFor={`cat-${cat}`}
                  className="font-medium cursor-pointer"
                >
                  {items[0]?.category_label ?? cat}
                </Label>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedInCat} / {allInCat}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pl-6">
              {items.map((p) => (
                <div key={p.code} className="flex items-start gap-2">
                  <Checkbox
                    id={`perm-${p.code}`}
                    checked={selectedSet.has(p.code)}
                    onCheckedChange={() => !disabled && togglePermission(p.code)}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={`perm-${p.code}`}
                      className="text-sm cursor-pointer block leading-tight"
                    >
                      {p.description ?? p.code}
                    </Label>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {p.code}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground text-right">
        Toplam seçili: <strong>{selected.length}</strong> izin
      </p>
    </div>
  );
}
