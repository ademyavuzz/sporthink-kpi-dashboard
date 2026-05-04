/**
 * API zarf tipleri — backend `app/schemas/common.py` ve
 * `app/core/exceptions.py` ile birebir.
 */

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
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
