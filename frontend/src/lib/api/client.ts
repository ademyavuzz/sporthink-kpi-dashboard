import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import { useAuthStore } from "@/stores/useAuthStore";
import type { ApiEnvelope, ErrorEnvelope, SuccessEnvelope } from "@/types/api";

/**
 * Tek axios instance + interceptor'lar (frontend/CLAUDE.md §6.1).
 *
 * - `withCredentials: true` → backend'in httpOnly refresh cookie'sini taşır.
 * - 401 alındığında refresh cookie ile `/auth/refresh` denenir; başarılıysa
 *   orijinal istek yeni token'la tekrar atılır. Başarısızsa auth temizlenir.
 *
 * Backend her zaman `{success, data}` veya `{success: false, error}`
 * döndürür; başarılı response'larda `unwrap()` zarfı açar, hata durumunda
 * `ApiError` fırlatılır.
 */

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export class ApiError extends Error {
  code: string;
  status: number;
  field?: string;
  params?: Record<string, unknown>;

  constructor(envelope: ErrorEnvelope, status: number) {
    super(envelope.error.message);
    this.code = envelope.error.code;
    this.status = status;
    this.field = envelope.error.field;
    this.params = envelope.error.params;
  }
}

export class NetworkError extends Error {
  code = "NETWORK_ERROR";
  status = 0;
  constructor() {
    super("Cannot reach server");
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// 401 → refresh → tek seferlik retry
let refreshInFlight: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  try {
    const { data } = await axios.post<SuccessEnvelope<{ access_token: string }>>(
      `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    if (data.success) {
      const newToken = data.data.access_token;
      useAuthStore.getState().setAccessToken(newToken);
      return newToken;
    }
    return null;
  } catch {
    useAuthStore.getState().clearAuth();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorEnvelope>) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // Ağ hatası — backend'e ulaşılamıyor
    if (!error.response) {
      return Promise.reject(new NetworkError());
    }

    // 401 + bu istek refresh denemesi değilse → refresh + retry
    const isRefreshCall = config?.url?.endsWith("/auth/refresh");
    if (status === 401 && config && !config._retry && !isRefreshCall) {
      config._retry = true;
      // Eşzamanlı 401'leri tek refresh çağrısına yönlendir
      refreshInFlight ??= attemptRefresh().finally(() => {
        refreshInFlight = null;
      });
      const newToken = await refreshInFlight;
      if (newToken) {
        config.headers.set("Authorization", `Bearer ${newToken}`);
        return apiClient.request(config);
      }
    }

    // Yapılandırılmış hata zarfı varsa ApiError'a sar; yoksa generic
    if (error.response.data && typeof error.response.data === "object") {
      const envelope = error.response.data as ErrorEnvelope;
      if (envelope.success === false && envelope.error) {
        return Promise.reject(new ApiError(envelope, status ?? 500));
      }
    }
    return Promise.reject(error);
  },
);

/** `{success, data}` zarfını açan helper — başarısızsa ApiError fırlatır. */
export function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  if (response.data.success) {
    return response.data.data;
  }
  throw new ApiError(response.data, response.status);
}
