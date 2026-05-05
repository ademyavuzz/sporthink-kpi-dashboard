import type { ImportListItem, ImportStatus } from "@/types/imports";

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

/**
 * Bir import'un kullanıcıya gösterilecek **outcome** etiketi.
 *
 * `status` tek başına yeterli değil: "completed" satırı, dosyanın tüm
 * satırları zaten DB'de varken (skip) ya da bazı satırlar hatalıyken de
 * "tamamlandı" döner. Burada `inserted_rows`/`skipped_rows`/`invalid_rows`'a
 * bakıp daha anlamlı bir kategori türetiyoruz:
 *
 *   - `running`     — pending / parsing / validating / committing
 *   - `failed`      — status=failed
 *   - `cancelled`   — status=cancelled
 *   - `duplicate`   — completed, hiçbir şey yazılmadı, hepsi zaten mevcut
 *   - `partial`     — completed, bir kısmı yazıldı, bir kısmı dedup ile atlandı
 *   - `with_errors` — completed, satır hataları var (ama yine de yazıldı)
 *   - `completed`   — completed, taze veri yazıldı, atlanan/hatalı yok
 *   - `empty`       — completed ama hiç satır yoktu (boş dosya / sadece header)
 */
export type ImportOutcome =
  | "running"
  | "failed"
  | "cancelled"
  | "duplicate"
  | "partial"
  | "with_errors"
  | "completed"
  | "empty";

const _RUNNING: ReadonlySet<ImportStatus> = new Set([
  "pending",
  "parsing",
  "validating",
  "committing",
]);

export function deriveImportOutcome(
  item: Pick<
    ImportListItem,
    | "status"
    | "total_rows"
    | "inserted_rows"
    | "skipped_rows"
    | "invalid_rows"
  >,
): ImportOutcome {
  if (item.status === "failed") return "failed";
  if (item.status === "cancelled") return "cancelled";
  if (_RUNNING.has(item.status)) return "running";
  // status === "completed" — şimdi sayılarla kategori türetelim
  const inserted = item.inserted_rows ?? 0;
  const skipped = item.skipped_rows ?? 0;
  const invalid = item.invalid_rows ?? 0;
  const total = item.total_rows ?? 0;
  if (total === 0) return "empty";
  if (inserted === 0 && skipped > 0) return "duplicate";
  if (skipped > 0 && inserted > 0) return "partial";
  if (invalid > 0) return "with_errors";
  return "completed";
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
