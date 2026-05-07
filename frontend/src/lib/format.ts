/**
 * Sayı/para/yüzde/tarih formatlama yardımcıları.
 *
 * Tüm sayılar TR locale ile (`1.234.567,89`); para birimi TRY (`₺`).
 * Bkz: kök CLAUDE.md §4.4.
 */

const _tr = new Intl.NumberFormat("tr-TR");

const _trCurrency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const _trCurrencyDecimal = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const _trCompact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Eksen/tooltip için ultra kompakt: 1.234.567 → "1,2M" (TR'de "Mn"
 * gösterimi okunaksız geliyor; uluslararası standart "M/B/T" ile gösterelim). */
const _internalCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Chart eksenleri için kısa sayı formatı.
 * 1.234.567 → "1.2M" · 12.345 → "12.3K" · 145 → "145"
 */
export function formatAxisNumber(v: number): string {
  if (Math.abs(v) < 1000) return Math.round(v).toString();
  return _internalCompact.format(v);
}

/** Chart eksenlerinde TRY: kısa formatı `₺` ile. */
export function formatAxisCurrency(v: number): string {
  return `${formatAxisNumber(v)} ₺`;
}

/** Decimal string ya da number → number; null güvenli. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatCount(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : _tr.format(n);
}

/** Büyük sayı kompakt: 1.234.567 → "1,2 Mn". */
export function formatCompact(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : _trCompact.format(n);
}

/** TRY: küçük sayılar için 2 ondalık, büyük (>1000) için tam sayı. */
export function formatCurrency(
  v: string | number | null | undefined,
  options: { compact?: boolean } = {},
): string {
  const n = toNumber(v);
  if (n === null) return "—";
  if (options.compact && Math.abs(n) >= 1000) {
    return `${_trCompact.format(n)} ₺`;
  }
  return Math.abs(n) < 100 ? _trCurrencyDecimal.format(n) : _trCurrency.format(n);
}

/** Yüzde — backend zaten 0-100 aralığında veriyor. */
export function formatPercent(
  v: string | number | null | undefined,
  fractionDigits = 2,
): string {
  const n = toNumber(v);
  if (n === null) return "—";
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }) + "%";
}

export function formatMultiplier(v: string | number | null | undefined): string {
  const n = toNumber(v);
  if (n === null) return "—";
  return `${n.toFixed(2)}x`;
}

/** Saniye → "2dk 35sn" (~ 1500sn → "25dk 0sn", 30sn → "30sn"). */
export function formatDurationSeconds(v: string | number | null | undefined): string {
  const n = toNumber(v);
  if (n === null) return "—";
  const total = Math.round(n);
  if (total < 60) return `${total}sn`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}dk ${s}sn`;
}

/** KPIResult.unit'e göre uygun formatter'ı seç. */
export function formatKPIValue(
  value: string | number | null | undefined,
  unit: "currency" | "percent" | "count" | "multiplier" | "duration_seconds",
): string {
  switch (unit) {
    case "currency":
      return formatCurrency(value, { compact: true });
    case "percent":
      return formatPercent(value);
    case "multiplier":
      return formatMultiplier(value);
    case "duration_seconds":
      return formatDurationSeconds(value);
    case "count":
    default:
      return formatCompact(value);
  }
}

/** Yüzde değişim — backend Decimal string verir (12.45 = +%12.45). */
export function formatChange(v: string | number | null | undefined): string {
  const n = toNumber(v);
  if (n === null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
