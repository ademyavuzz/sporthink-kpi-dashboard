import { useState } from "react";
import { useTranslation } from "react-i18next";

import { TableHeader, TableRow } from "@/components/ui/table";
import type { ColumnDef, ColumnManager } from "@/hooks/useColumnManager";
import { cn } from "@/lib/utils";

import { DraggableTableHead } from "./DraggableTableHead";

interface ManagedColumnHeaderProps<TCol extends ColumnDef> {
  /** Kolon yoneticisi (useColumnManager cikti). */
  manager: ColumnManager<TCol>;
  /** Kolon basligi cevirisi icin namespace (orn: "dashboard"). */
  ns: string;
  /** Her gorunur kolonun TableHead'ine eklenecek ek sinif (orn: hizalama). */
  headClassName?: (col: TCol) => string | undefined;
  /** <TableRow>'a eklenecek ek sinif. */
  rowClassName?: string;
  /**
   * Bir kolonun siralanabilir olup olmadigini belirler. `false` donen kolon
   * (or. aksiyon/buton kolonu) tiklanamaz ve siralama ikonu gostermez.
   * Belirtilmezse tum kolonlar siralanabilir kabul edilir.
   */
  isSortable?: (col: TCol) => boolean;
}

/**
 * Yonetilen (surukle-birak siralanabilir + goster/gizle + tikla-sirala) tablo
 * basligi satiri. Yalnizca gorunur kolonlari, kullanicinin sirasinda render
 * eder. Govde (TableBody) her sayfada kendi zengin hucre render'i ile ayrik
 * kalir; bu bilesen tablolar arasinda paylasilan tek baslik soyutlamasidir.
 *
 * Siralama: kolon basligina tiklayinca `manager.toggleSort(col.id)` cagrilir
 * (asc -> desc -> kapali dongusu). Aktif yonu gosteren ok ikonu gosterilir ve
 * `aria-sort` ile erisilebilirlik saglanir. Asil satir siralamasini sayfa,
 * `useSortedRows` ile `manager.sortColumnId/sortDir`'e gore yapar.
 */
export function ManagedColumnHeader<TCol extends ColumnDef>({
  manager,
  ns,
  headClassName,
  rowClassName,
  isSortable,
}: ManagedColumnHeaderProps<TCol>) {
  const { t } = useTranslation([ns, "common"]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return (
    <TableHeader>
      <TableRow
        className={cn(
          "border-b border-border bg-surface-2 hover:bg-surface-2",
          rowClassName,
        )}
      >
        {manager.visibleColumns.map((col) => {
          const label = t(`${ns}:${col.labelKey}`);
          const sortable = isSortable ? isSortable(col) : true;
          const sortActive = manager.sortColumnId === col.id;
          return (
            <DraggableTableHead
              key={col.id}
              columnId={col.id}
              required={col.required}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              onDropColumn={(fromId) => {
                manager.reorder(fromId, col.id);
                setDraggingId(null);
              }}
              sortable={sortable}
              sortActive={sortActive}
              sortDir={sortActive ? manager.sortDir : null}
              onToggleSort={manager.toggleSort}
              sortLabels={{
                asc: t("common:columns.sort_asc", { column: label }),
                desc: t("common:columns.sort_desc", { column: label }),
                none: t("common:columns.sort_none", { column: label }),
              }}
              className={cn(
                "px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim",
                headClassName?.(col),
              )}
            >
              {label}
            </DraggableTableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}
