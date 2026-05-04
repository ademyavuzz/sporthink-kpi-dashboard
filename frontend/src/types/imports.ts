/**
 * Imports modülü tipleri — backend `app/schemas/imports.py` ile birebir.
 */

/** Backend `ImportDataType` enum'unun string değerleri. */
export type ImportDataType =
  | "products"
  | "customers"
  | "campaigns"
  | "orders"
  | "order_items"
  | "ga4_traffic"
  | "ga4_items"
  | "meta_ads"
  | "meta_breakdowns"
  | "google_ads";

/** Coerce/validation tipleri (parser ColumnSpec.type). */
export type ColumnCoerceType =
  | "str"
  | "int"
  | "decimal"
  | "date_iso"
  | "date_yyyymmdd"
  | "datetime_iso"
  | "bool"
  | "enum_str";

export interface DataTypeColumn {
  csv_header: string;
  db_column: string;
  type: ColumnCoerceType;
  required: boolean;
}

export interface DataTypeMeta {
  data_type: ImportDataType;
  label_tr: string;
  target_table: string;
  csv_headers: DataTypeColumn[];
  dedup_keys: string[];
  fk_count: number;
}

export interface ImportSampleError {
  source_row_number: number;
  field_name: string | null;
  error_code: string;
  error_message: string | null;
}

export interface ImportPreviewSummary {
  previewed_rows: number;
  valid_rows: number;
  error_rows: number;
}

export interface ImportPreviewResponse {
  data_type: string;
  file_name: string;
  file_size_bytes: number;
  detected_headers: string[];
  missing_required: string[];
  unknown_headers: string[];
  sample_rows: Array<Record<string, unknown>>;
  sample_errors: ImportSampleError[];
  summary: ImportPreviewSummary;
}

export type ImportStatus =
  | "pending"
  | "parsing"
  | "validating"
  | "committing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ImportListItem {
  id: number;
  file_name: string;
  data_type: string;
  status: ImportStatus;
  total_rows: number | null;
  valid_rows: number | null;
  invalid_rows: number | null;
  /** Dedup nedeniyle atlanan satır sayısı (zaten DB'de mevcut). */
  skipped_rows: number | null;
  inserted_rows: number | null;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ImportDetailResponse extends ImportListItem {
  error_message: string | null;
  sample_errors: ImportSampleError[];
}

export type ImportRunResult = ImportDetailResponse;
