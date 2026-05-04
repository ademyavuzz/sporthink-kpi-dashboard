import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  DataTypeMeta,
  ImportDataType,
  ImportDetailResponse,
  ImportListItem,
  ImportPreviewResponse,
  ImportRunResult,
} from "@/types/imports";

/**
 * Imports API — backend `/api/v1/imports/*` ile birebir.
 *
 * Wizard'ın 4 adımı (08-import-system.md §8):
 * - 1. adım: `getDataTypes()` → dropdown
 * - 2. adım: `preview(file, type)` → header diff + ilk 10 satır
 * - 3. adım: `run(file, type)` → gerçek import (sync)
 * - 4. adım: `errorsCsvUrl(id)` → sonuç ekranında "Hataları indir"
 */
export const importsApi = {
  async getDataTypes(): Promise<DataTypeMeta[]> {
    const r = await apiClient.get<ApiEnvelope<DataTypeMeta[]>>("/imports/data-types");
    return unwrap(r);
  },

  async preview(file: File, dataType: ImportDataType): Promise<ImportPreviewResponse> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("data_type", dataType);
    const r = await apiClient.post<ApiEnvelope<ImportPreviewResponse>>(
      "/imports/preview",
      fd,
    );
    return unwrap(r);
  },

  async run(file: File, dataType: ImportDataType): Promise<ImportRunResult> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("data_type", dataType);
    // Sync import — büyük dosyalarda 10+ sn sürebilir; client timeout'u uzat.
    const r = await apiClient.post<ApiEnvelope<ImportRunResult>>("/imports", fd, {
      timeout: 5 * 60_000,
    });
    return unwrap(r);
  },

  async list(): Promise<ImportListItem[]> {
    const r = await apiClient.get<ApiEnvelope<ImportListItem[]>>("/imports");
    return unwrap(r);
  },

  async get(id: number): Promise<ImportDetailResponse> {
    const r = await apiClient.get<ApiEnvelope<ImportDetailResponse>>(`/imports/${id}`);
    return unwrap(r);
  },

  async deleteById(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`/imports/${id}`);
  },

  /**
   * "Hataları indir" butonu için tam URL — `<a href>` veya `window.open`'da
   * kullanılır. Authorization header'ı interceptor'da otomatik eklenmediği
   * için Bearer token query string yerine fetch + blob ile indirilmesi
   * gerekir; aşağıdaki helper o akışı kapsar.
   */
  errorsCsvPath(id: number): string {
    return `/imports/${id}/errors.csv`;
  },

  async downloadErrorsCsv(id: number): Promise<Blob> {
    const r = await apiClient.get(this.errorsCsvPath(id), { responseType: "blob" });
    return r.data as Blob;
  },
};
