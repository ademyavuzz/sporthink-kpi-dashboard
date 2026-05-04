/**
 * Avatar URL ve initials yardımcıları.
 *
 * Backend `avatar_url`'i göreli path olarak döner (örn:
 * `/uploads/avatars/12.webp?v=1234567`). Frontend, baseURL'in origin
 * kısmını alıp tam URL üretir — `/api/v1` öneki avatar URL'lerinde olmaz.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000/api/v1";

let cachedOrigin: string | null = null;

export function getApiOrigin(): string {
  if (cachedOrigin) return cachedOrigin;
  try {
    const u = new URL(API_BASE);
    cachedOrigin = `${u.protocol}//${u.host}`;
  } catch {
    cachedOrigin = "http://localhost:8000";
  }
  return cachedOrigin;
}

/** Backend'in döndüğü göreli avatar path'ini tarayıcıya açılan tam URL'e çevirir. */
export function avatarSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/")) return `${getApiOrigin()}${url}`;
  return url;
}

/** Ad-soyaddan veya e-postadan iki harfli baş harf üretir. */
export function initialsFor(input: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
}): string {
  const fn = input.first_name?.trim();
  const ln = input.last_name?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (input.full_name) {
    const parts = input.full_name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[1])
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1 && parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (input.email) return input.email[0]?.toUpperCase() ?? "?";
  return "?";
}
