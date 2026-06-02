import { GripVertical } from "lucide-react";
import { useState } from "react";
import type { DragEvent, ReactNode } from "react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DraggableTableHeadProps {
  /** Kolon kimligi (useColumnManager ile ayni id). */
  columnId: string;
  /** Su an suruklenmekte olan kolon id'si (parent state). */
  draggingId: string | null;
  /** Surukleme baslayinca cagrilir. */
  onDragStart: (id: string) => void;
  /** Surukleme bitince cagrilir. */
  onDragEnd: () => void;
  /** `fromId` kolonunu bu kolonun uzerine birakinca cagrilir. */
  onDropColumn: (fromId: string) => void;
  /** Bu kolon yapisal/zorunlu mu? Zorunlu kolon surukle-birak disidir. */
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Surukle-birak ile yeniden siralanabilen tablo basligi hucresi. Native HTML5
 * drag-and-drop kullanir; ek bagimlilik yoktur. Zorunlu kolonlar normal
 * TableHead gibi davranir (surukleme tutamaci gosterilmez).
 */
export function DraggableTableHead({
  columnId,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropColumn,
  required,
  className,
  children,
}: DraggableTableHeadProps) {
  const [isOver, setIsOver] = useState(false);

  if (required) {
    return <TableHead className={className}>{children}</TableHead>;
  }

  const isDragging = draggingId === columnId;
  // Surukleme aktifken ve bu hucre kaynak degilse birakma hedefi olabilir.
  const canDrop = draggingId !== null && draggingId !== columnId;

  const handleDragStart = (e: DragEvent<HTMLTableCellElement>) => {
    e.dataTransfer.effectAllowed = "move";
    // Firefox surukleme baslamasi icin veri set edilmesini ister.
    e.dataTransfer.setData("text/plain", columnId);
    onDragStart(columnId);
  };

  const handleDragOver = (e: DragEvent<HTMLTableCellElement>) => {
    if (!canDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = () => {
    if (isOver) setIsOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLTableCellElement>) => {
    if (!canDrop) return;
    e.preventDefault();
    setIsOver(false);
    const fromId = e.dataTransfer.getData("text/plain") || draggingId;
    if (fromId) onDropColumn(fromId);
  };

  return (
    <TableHead
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => {
        setIsOver(false);
        onDragEnd();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-dragging={isDragging || undefined}
      data-drop-target={isOver || undefined}
      className={cn(
        "group/col cursor-grab select-none border-l-2 border-l-transparent active:cursor-grabbing",
        isDragging && "opacity-40",
        isOver && "border-l-primary bg-primary/10",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        <GripVertical
          aria-hidden
          className="size-3 shrink-0 text-text-dim opacity-0 transition-opacity group-hover/col:opacity-100"
        />
        {children}
      </span>
    </TableHead>
  );
}
