import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import type { DragEvent, PointerEvent, ReactNode } from "react";

import { TableHead } from "@/components/ui/table";
import type { SortDirection } from "@/hooks/useColumnManager";
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
  /**
   * Bu kolon siralanabilir mi? `false` ise baslik tiklanamaz ve siralama
   * ikonu gosterilmez (or. aksiyon kolonu). Varsayilan `true`.
   */
  sortable?: boolean;
  /** Bu kolon su an siralamada aktif mi? */
  sortActive?: boolean;
  /** Aktif yon (yalnizca `sortActive` ise anlamlidir). */
  sortDir?: SortDirection;
  /** Baslik tiklanip siralama istendiginde cagrilir (gercek surukleme haric). */
  onToggleSort?: (id: string) => void;
  /** Erisilebilirlik / tooltip etiketleri (i18n disiplini: parent t() ile saglar). */
  sortLabels?: {
    /** "Artana gore sirala" gibi tooltip/aria-label metni. */
    asc: string;
    /** "Azalana gore sirala". */
    desc: string;
    /** "Siralamayi kaldir". */
    none: string;
  };
  className?: string;
  children: ReactNode;
}

/** Gercek suruklemeyi tiklamadan ayirmak icin esik (piksel). */
const DRAG_THRESHOLD_PX = 4;

/**
 * Aktif siralama yonune gore uygun lucide ikonunu doner. Siralama yokken notr
 * (ArrowUpDown) ikon, hover'da soluk gosterilir; aktifken yon oku tam opaklik.
 */
function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
  if (active && dir === "asc") {
    return <ChevronUp aria-hidden className="size-3.5 shrink-0 text-primary" />;
  }
  if (active && dir === "desc") {
    return <ChevronDown aria-hidden className="size-3.5 shrink-0 text-primary" />;
  }
  return (
    <ArrowUpDown
      aria-hidden
      className="size-3 shrink-0 text-text-dim opacity-0 transition-opacity group-hover/col:opacity-50"
    />
  );
}

/**
 * Surukle-birak ile yeniden siralanabilen VE basligina tiklayinca veriyi
 * siralayabilen tablo basligi hucresi. Native HTML5 drag-and-drop kullanir;
 * ek bagimlilik yoktur.
 *
 * Surukleme/tiklama cakismasi: pointerdown ile baslangic konumu kaydedilir;
 * pointerup'ta hareket esigi (DRAG_THRESHOLD_PX) asilmadiysa tiklama = siralama
 * kabul edilir. Gercek bir suruklemede (esik asilmis veya HTML5 drag tetiklenmis)
 * siralama tetiklenmez.
 *
 * Zorunlu (required) kolonlar surukle-birak disidir ama yine de siralanabilir
 * (sortable !== false ise).
 */
export function DraggableTableHead({
  columnId,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropColumn,
  required,
  sortable = true,
  sortActive = false,
  sortDir = null,
  onToggleSort,
  sortLabels,
  className,
  children,
}: DraggableTableHeadProps) {
  const [isOver, setIsOver] = useState(false);
  // Pointer hareketini izleyerek tiklama (sort) ile suruklemeyi ayirir.
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  const canSort = sortable && !!onToggleSort;

  const ariaSort: "ascending" | "descending" | "none" | undefined = canSort
    ? sortActive && sortDir === "asc"
      ? "ascending"
      : sortActive && sortDir === "desc"
        ? "descending"
        : "none"
    : undefined;

  // Bir sonraki tiklamada uygulanacak siralamaya gore aria-label/tooltip.
  const nextSortLabel = sortLabels
    ? sortActive && sortDir === "asc"
      ? sortLabels.desc
      : sortActive && sortDir === "desc"
        ? sortLabels.none
        : sortLabels.asc
    : undefined;

  const handlePointerDown = (e: PointerEvent<HTMLTableCellElement>) => {
    if (!canSort) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
  };

  const handlePointerMove = (e: PointerEvent<HTMLTableCellElement>) => {
    if (!canSort || !pointerStart.current || didDrag.current) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
      didDrag.current = true;
    }
  };

  const handleClick = () => {
    if (!canSort) return;
    // Gercek suruklemeden sonra gelen click'i yut (HTML5 drag de didDrag yapar).
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onToggleSort?.(columnId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (!canSort) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleSort?.(columnId);
    }
  };

  // Sayisal (sag hizali) kolonlarda etiketin sag kenari, hucredeki sayinin sag
  // kenariyla hizalansin diye siralama ikonu etiketten ONCE gelir; sol hizali
  // kolonlarda SONRA. Eski grip ikonu kaldirildi: opacity-0 olsa da yer kapladigi
  // icin baslik metnini saga itip "kayma" yaratiyordu. Surukle-birak yine tum
  // baslik hucresinden (draggable) yapilir; cursor-grab affordance korunur.
  const alignRight =
    !!className && /text-right|justify-end|ml-auto/.test(className);
  const content = (
    <span className="inline-flex max-w-full items-center gap-1 align-middle">
      {alignRight && canSort && <SortIcon active={sortActive} dir={sortDir} />}
      <span className="truncate">{children}</span>
      {!alignRight && canSort && <SortIcon active={sortActive} dir={sortDir} />}
    </span>
  );

  // Tiklama/klavye/erisilebilirlik ortak prop'lari (hem required hem normal).
  const sortInteractionProps = canSort
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-sort": ariaSort,
        "aria-label": nextSortLabel,
        title: nextSortLabel,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
      }
    : {};

  // --- Zorunlu kolon: surukle-birak yok, ama siralanabilir olabilir. ---
  if (required) {
    return (
      <TableHead
        {...sortInteractionProps}
        className={cn(
          "group/col select-none",
          canSort && "cursor-pointer",
          className,
        )}
      >
        {content}
      </TableHead>
    );
  }

  const isDragging = draggingId === columnId;
  // Surukleme aktifken ve bu hucre kaynak degilse birakma hedefi olabilir.
  const canDrop = draggingId !== null && draggingId !== columnId;

  const handleDragStart = (e: DragEvent<HTMLTableCellElement>) => {
    // HTML5 surukleme basladi -> bu bir tiklama degil, click'i yut.
    didDrag.current = true;
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
      {...sortInteractionProps}
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
      {content}
    </TableHead>
  );
}
