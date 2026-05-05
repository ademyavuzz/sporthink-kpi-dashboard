import { apiClient, unwrap } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  ReportCreatePayload,
  ReportDetail,
  ReportListItem,
  ReportSectionMeta,
} from "@/types/reports";

/**
 * Reports API — backend `/api/v1/reports/*` ile birebir.
 *
 * Akış:
 * 1. `getSections()` → bölüm meta listesi (UI checkbox grid)
 * 2. `create({...})` → Celery enqueue, `pending` status'lu kayıt döner
 * 3. `get(id)` → polling ile `completed` veya `failed` bekle
 * 4. `download(id)` → blob → File-saver ile kullanıcıya indirt
 * 5. `deleteById(id)` → soft delete + dosya temizle
 */
export const reportsApi = {
  async getSections(): Promise<ReportSectionMeta[]> {
    const r = await apiClient.get<ApiEnvelope<ReportSectionMeta[]>>(
      "/reports/sections",
    );
    return unwrap(r);
  },

  async list(): Promise<ReportListItem[]> {
    const r = await apiClient.get<ApiEnvelope<ReportListItem[]>>("/reports");
    return unwrap(r);
  },

  async get(id: number): Promise<ReportDetail> {
    const r = await apiClient.get<ApiEnvelope<ReportDetail>>(`/reports/${id}`);
    return unwrap(r);
  },

  async create(payload: ReportCreatePayload): Promise<ReportDetail> {
    const r = await apiClient.post<ApiEnvelope<ReportDetail>>(
      "/reports",
      payload,
    );
    return unwrap(r);
  },

  async deleteById(id: number): Promise<void> {
    await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`/reports/${id}`);
  },

  async download(id: number): Promise<Blob> {
    const r = await apiClient.get(`/reports/${id}/download`, {
      responseType: "blob",
    });
    return r.data as Blob;
  },
};
