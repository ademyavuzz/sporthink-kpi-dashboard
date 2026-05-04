import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui standart `cn` helper'ı.
 * Tailwind class'larını clsx ile birleştirir, çakışan utility'leri
 * tailwind-merge ile çözer (örn: `cn('p-2', isLg && 'p-4')` → `'p-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
