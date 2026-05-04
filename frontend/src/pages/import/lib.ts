import type { ImportStatus } from "@/types/imports";

/** Bytes → "1.2 MB" gibi okunabilir string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Saniye → "1m 23s" / "12s". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Status → shadcn Badge variant ("default" yeşil yok, secondary'yi nötr için kullanırız). */
export function statusToBadgeVariant(
  status: ImportStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "failed":
    case "cancelled":
      return "destructive";
    case "pending":
    case "parsing":
    case "validating":
    case "committing":
      return "secondary";
    default:
      return "outline";
  }
}

/** Browser'da blob'u dosya olarak indir. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
