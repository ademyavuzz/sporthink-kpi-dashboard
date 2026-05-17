/**
 * API zarf tipleri — backend `app/schemas/common.py` ve
 * `app/core/exceptions.py` ile birebir.
 */

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
}

export interface PaginatedEnvelope<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    params?: Record<string, unknown>;
  };
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
export type PaginatedApiEnvelope<T> = PaginatedEnvelope<T> | ErrorEnvelope;
