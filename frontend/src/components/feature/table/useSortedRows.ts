import { useMemo } from "react";

import type { SortDirection } from "@/hooks/useColumnManager";

/**
 * Bir satirdan, bir kolonun siralanabilir ham degerini cikaran fonksiyon.
 * Donen deger:
 *  - `number` -> sayisal karsilastirma
 *  - `string` -> tr-TR locale ile karsilastirma; ISO tarih string'i de buraya
 *    girer (ISO sirasi alfabetik sira ile uyumludur, dogru siralanir)
 *  - `null`/`undefined` -> "veri yok"; her zaman sona gider (asc ve desc)
 */
export type SortValue = number | string | null | undefined;

/** Kolon id -> o kolonun siralama deger cikaricisi. */
export type SortAccessors<TRow> = Record<string, (row: TRow) => SortValue>;

const collator = new Intl.Collator("tr", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Iki ham siralama degerini, NULL'lar her zaman sona gidecek sekilde
 * karsilastirir. Donus pozitifse `a` sonra gelir.
 *
 * - NULL/undefined her zaman digerinin altinda (sona) — yon ne olursa olsun.
 * - Ayni tipte degiller veya farkli tipteyse: sayilar string'lerden once gelir
 *   (deterministik olmasi yeterli; pratikte bir kolon tek tiptedir).
 */
function compareValues(a: SortValue, b: SortValue): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  // NULL'lar daima sona — bu yondan bagimsizdir, bu yuzden sort'tan SONRA
  // tersine cevrilmemelidir (bkz. sortRows: yon yalnizca dolu degerlere uygulanir).
  if (aNull && bNull) return 0;
  if (aNull) return 1; // a sona
  if (bNull) return -1; // b sona

  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }
  // En az biri string: ikisini de string'e cevirip locale karsilastir.
  return collator.compare(String(a), String(b));
}

/**
 * Verilen satirlari, kolon `accessor`'i ile cikarilan degere gore STABIL ve
 * NULL-sona kuraliyla siralar. Orijinal diziyi mutate ETMEZ; yeni dizi doner.
 *
 * @param rows     Siralanacak satirlar.
 * @param accessor Bir satirdan siralama degerini cikaran fonksiyon
 *                 (or. `(r) => r.revenue`). `undefined` ise siralama yapilmaz.
 * @param dir      `"asc"` | `"desc"` | `null`. `null` -> orijinal sira korunur.
 *
 * Stabillik: esit degerlerde (NULL gruplari dahil) girdi sirasi korunur.
 * Yon: yalnizca dolu (non-null) degerler arasinda ters cevrilir; NULL'lar
 * her iki yonde de sona kalir.
 */
export function sortRows<TRow>(
  rows: readonly TRow[],
  accessor: ((row: TRow) => SortValue) | undefined,
  dir: SortDirection,
): TRow[] {
  if (dir === null || !accessor) return rows.slice();

  // Stabil siralama icin orijinal index'i sakla; karsilastirma esitse index'e dus.
  const indexed = rows.map((row, index) => ({
    row,
    index,
    value: accessor(row),
  }));

  indexed.sort((a, b) => {
    const aNull = a.value === null || a.value === undefined;
    const bNull = b.value === null || b.value === undefined;
    // NULL daima sona — yondan bagimsiz.
    if (aNull && bNull) return a.index - b.index;
    if (aNull) return 1;
    if (bNull) return -1;
    const cmp = compareValues(a.value, b.value);
    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.index - b.index; // stabil: esitlerde orijinal sira
  });

  return indexed.map((e) => e.row);
}

/**
 * `sortRows`'in memoize edilmis hook sarmalayicisi. Sayfalar tabloyu render
 * etmeden once satirlari siralamak icin kullanir.
 *
 * @param rows        Ham satirlar (or. API'den gelen liste).
 * @param accessors   Kolon id -> deger cikarici eslemesi.
 * @param sortColumnId Aktif siralama kolonu (useColumnManager'dan).
 * @param sortDir     Aktif yon (useColumnManager'dan).
 *
 * @example
 * const sorted = useSortedRows(rows, accessors, mgr.sortColumnId, mgr.sortDir);
 */
export function useSortedRows<TRow>(
  rows: readonly TRow[],
  accessors: SortAccessors<TRow>,
  sortColumnId: string | null,
  sortDir: SortDirection,
): TRow[] {
  return useMemo(() => {
    if (sortColumnId === null || sortDir === null) return rows.slice();
    return sortRows(rows, accessors[sortColumnId], sortDir);
  }, [rows, accessors, sortColumnId, sortDir]);
}
