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
}

/**
 * Yonetilen (surukle-birak siralanabilir + goster/gizle) tablo basligi satiri.
 * Yalnizca gorunur kolonlari, kullanicinin sirasinda render eder. Govde
 * (TableBody) her sayfada kendi zengin hucre render'i ile ayrik kalir; bu
 * bilesen tablolar arasinda paylasilan tek soyutlamadir.
 */
export function ManagedColumnHeader<TCol extends ColumnDef>({
  manager,
  ns,
  headClassName,
  rowClassName,
}: ManagedColumnHeaderProps<TCol>) {
  const { t } = useTranslation(ns);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return (
    <TableHeader>
      <TableRow
        className={cn(
          "border-b border-border bg-surface-2 hover:bg-surface-2",
          rowClassName,
        )}
      >
        {manager.visibleColumns.map((col) => (
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
            className={cn(
              "px-3 py-3 text-[11px] uppercase tracking-wider text-text-dim",
              headClassName?.(col),
            )}
          >
            {t(col.labelKey)}
          </DraggableTableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
