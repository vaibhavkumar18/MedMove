import axios from 'axios';

const baseURL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

export const httpClient = axios.create({
  baseURL,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = error.config?.url ?? '';
    const pathname = requestUrl.split('?')[0].replace(/\/+$/, '');
    const isPublicAuthRequest = /\/auth\/(login|me)$/.test(pathname);

    if (isPublicAuthRequest) {
      return Promise.reject(error);
    }

    window.dispatchEvent(new Event('medmove:unauthorized'));
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          detail?: string | Array<{ msg?: string }> | { code?: string; message?: string };
          message?: string;
          error?: { message?: string };
        }
      | undefined;

    if (typeof data?.error?.message === 'string') return data.error.message;
    if (typeof data?.detail === 'string') return data.detail;
    if (
      data?.detail &&
      typeof data.detail === 'object' &&
      !Array.isArray(data.detail) &&
      typeof data.detail.message === 'string'
    ) {
      return data.detail.message;
    }
    if (Array.isArray(data?.detail)) {
      return data.detail.map((item) => item.msg).filter(Boolean).join(', ') || fallback;
    }
    if (typeof data?.message === 'string') return data.message;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'The request took too long. Please try again.';
    }
    if (!error.response) {
      return 'Cannot connect to the server. Check that the backend is running.';
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Extract a structured error code from an Axios error response.
 * Returns undefined when no structured code is present.
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          detail?: string | Array<{ msg?: string }> | { code?: string };
          error?: { code?: string };
        }
      | undefined;

    if (data?.error?.code) return data.error.code;
    if (
      data?.detail &&
      typeof data.detail === 'object' &&
      !Array.isArray(data.detail) &&
      typeof data.detail.code === 'string'
    ) {
      return data.detail.code;
    }
  }
  return undefined;
}
