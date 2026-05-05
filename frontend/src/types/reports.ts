/**
 * Reports modülü tipleri — backend `app/schemas/reports.py` ile birebir.
 */

export type ReportSectionKey =
  | "overview"
  | "ga4"
  | "ads"
  | "ecommerce"
  | "funnel"
  | "top";

export type ReportStatus = "pending" | "generating" | "completed" | "failed";

export type ReportLanguage = "tr" | "en";

export interface ReportSectionMeta {
  key: ReportSectionKey;
  label_tr: string;
  label_en: string;
  description_tr: string;
  description_en: string;
}

export interface ReportListItem {
  id: number;
  name: string;
  date_from: string; // ISO date "YYYY-MM-DD"
  date_to: string;
  sections: ReportSectionKey[];
  language: string;
  status: ReportStatus;
  file_size_bytes: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type ReportDetail = ReportListItem;

export interface ReportCreatePayload {
  name?: string;
  date_from: string;
  date_to: string;
  sections: ReportSectionKey[];
  language: ReportLanguage;
}
