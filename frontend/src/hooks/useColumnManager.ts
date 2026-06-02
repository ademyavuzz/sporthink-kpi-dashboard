import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Bir tablo kolonunun statik tanimi. `id` kolonu benzersiz tanimlar ve
 * kullanici tercihinin (sira/gizlilik) localStorage'da saklanma anahtaridir.
 */
export interface ColumnDef {
  /** Benzersiz, stabil kolon kimligi. Sira/gizlilik bu id ile saklanir. */
  id: string;
  /** Kolon basligi i18n key (t() ile cozulur). */
  labelKey: string;
  /**
   * Kolon zorunlu mu? Zorunlu kolonlar gizlenemez ve surukle-birak ile
   * tasinamaz (orn: siralama sutunu "#" gibi yapisal kolonlar).
   */
  required?: boolean;
}

/** localStorage'da saklanan kullanici tercihi sekli. */
interface StoredPreference {
  order: string[];
  hidden: string[];
}

export interface ColumnManager<TCol extends ColumnDef = ColumnDef> {
  /** Goruntulenecek kolonlar — kullanici sirasinda, gizliler haric. */
  visibleColumns: TCol[];
  /** Menude listelenecek tum kolonlar — kullanici sirasinda. */
  orderedColumns: TCol[];
  /** Bir kolon su an gorunur mu? */
  isVisible: (id: string) => boolean;
  /** Bir kolonun gorunurlugunu degistir (zorunlu kolonlar yok sayilir). */
  toggleVisibility: (id: string) => void;
  /** `fromId` kolonunu `toId` kolonunun bulundugu konuma tasi. */
  reorder: (fromId: string, toId: string) => void;
  /** Tum tercihleri varsayilana dondur. */
  reset: () => void;
  /** Varsayilandan sapma var mi? (reset butonunu gosterip gizlemek icin) */
  isCustomized: boolean;
}

const STORAGE_PREFIX = "table-columns:";

function readPreference(storageKey: string): StoredPreference | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as StoredPreference).order) &&
      Array.isArray((parsed as StoredPreference).hidden)
    ) {
      return parsed as StoredPreference;
    }
  } catch {
    // Bozuk/erisilemeyen storage — varsayilana dus.
  }
  return null;
}

function writePreference(storageKey: string, pref: StoredPreference): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(pref));
  } catch {
    // Storage dolu/erisilemez — sessizce gec, UI yine de calisir.
  }
}

/**
 * Kolonlari, gecerli tanimla cakismayacak sekilde verilen sirayla diz.
 * Saklanan siralamada olmayan yeni kolonlar (sonradan eklenmis) sona eklenir;
 * artik var olmayan kolon id'leri yok sayilir.
 */
function applyOrder<TCol extends ColumnDef>(
  columns: TCol[],
  order: string[],
): TCol[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const result: TCol[] = [];
  for (const id of order) {
    const col = byId.get(id);
    if (col) {
      result.push(col);
      byId.delete(id);
    }
  }
  // Saklanan sirada bulunmayan kolonlari orijinal sirayla sona ekle.
  for (const col of columns) {
    if (byId.has(col.id)) result.push(col);
  }
  return result;
}

/**
 * Tablolarda kolon sirasini (surukle-birak) ve gorunurlugunu (goster/gizle)
 * yoneten, tercihi localStorage'da kalici tutan hafif hook. Dis bagimlilik yok.
 *
 * @param storageKey Tabloyu benzersiz tanimlayan anahtar (orn: "ecom-orders").
 * @param columns Statik kolon tanimlari (sabit referans onerilir, orn useMemo).
 */
export function useColumnManager<TCol extends ColumnDef>(
  storageKey: string,
  columns: TCol[],
): ColumnManager<TCol> {
  const defaultOrder = useMemo(() => columns.map((c) => c.id), [columns]);

  const [order, setOrder] = useState<string[]>(() => {
    const pref = readPreference(storageKey);
    return pref ? applyOrder(columns, pref.order).map((c) => c.id) : defaultOrder;
  });
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const pref = readPreference(storageKey);
    return new Set(pref?.hidden ?? []);
  });

  // Kolon tanimi degisirse (orn: dil/sayfa degisimi) gecerli id'lere sterilize et.
  useEffect(() => {
    const validIds = new Set(defaultOrder);
    setOrder((prev) => {
      const next = applyOrder(columns, prev).map((c) => c.id);
      const same =
        next.length === prev.length && next.every((id, i) => id === prev[i]);
      return same ? prev : next;
    });
    setHidden((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [columns, defaultOrder]);

  // Tercihi her degisiklikte sakla (varsayilansa anahtari temizle).
  useEffect(() => {
    const isDefaultOrder =
      order.length === defaultOrder.length &&
      order.every((id, i) => id === defaultOrder[i]);
    if (isDefaultOrder && hidden.size === 0) {
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + storageKey);
      } catch {
        // yok say
      }
      return;
    }
    writePreference(storageKey, { order, hidden: [...hidden] });
  }, [storageKey, order, hidden, defaultOrder]);

  const orderedColumns = useMemo(() => applyOrder(columns, order), [columns, order]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !hidden.has(c.id)),
    [orderedColumns, hidden],
  );

  const isVisible = useCallback((id: string) => !hidden.has(id), [hidden]);

  const toggleVisibility = useCallback(
    (id: string) => {
      const col = columns.find((c) => c.id === id);
      if (col?.required) return; // zorunlu kolon gizlenemez
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [columns],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const fromCol = columns.find((c) => c.id === fromId);
      const toCol = columns.find((c) => c.id === toId);
      // Zorunlu kolonlar yapisal — surukle-birak ile yeri sabit kalir.
      if (fromCol?.required || toCol?.required) return;
      setOrder((prev) => {
        const next = [...prev];
        const fromIdx = next.indexOf(fromId);
        const toIdx = next.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, fromId);
        return next;
      });
    },
    [columns],
  );

  const reset = useCallback(() => {
    setOrder(defaultOrder);
    setHidden(new Set());
  }, [defaultOrder]);

  const isCustomized = useMemo(() => {
    const isDefaultOrder =
      order.length === defaultOrder.length &&
      order.every((id, i) => id === defaultOrder[i]);
    return !isDefaultOrder || hidden.size > 0;
  }, [order, hidden, defaultOrder]);

  return {
    visibleColumns,
    orderedColumns,
    isVisible,
    toggleVisibility,
    reorder,
    reset,
    isCustomized,
  };
}
