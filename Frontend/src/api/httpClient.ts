
import axios from 'axios';

const TOKEN_KEY = 'medmove_access_token';
const DEMO_SESSION_KEY = 'medmove_demo_session';

const baseURL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

export const httpClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Demo mode is a frontend preview, not a backend-authenticated session.
httpClient.interceptors.request.use((config) => {
  if (sessionStorage.getItem(DEMO_SESSION_KEY)) {
    return Promise.reject(
      new Error(
        'This action is unavailable in demo mode. Sign in with a real account to use live data.',
      ),
    );
  }

  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401
    ) {
      return Promise.reject(error);
    }

    const requestUrl = error.config?.url ?? '';
    const pathname = requestUrl
      .split('?')[0]
      .replace(/\/+$/, '');

    const isLoginRequest = /\/auth\/login$/.test(pathname);
    const isSignupRequest = /\/auth\/signup$/.test(pathname);
    const isSessionRestoreRequest = /\/auth\/me$/.test(pathname);

    if (
      isLoginRequest ||
      isSignupRequest ||
      isSessionRestoreRequest
    ) {
      return Promise.reject(error);
    }

    sessionStorage.removeItem(TOKEN_KEY);
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
          detail?: string | Array<{ msg?: string }>;
          message?: string;
          error?: { message?: string };
        }
      | undefined;

    if (typeof data?.error?.message === 'string') {
      return data.error.message;
    }

    if (typeof data?.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return (
        data.detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join(', ') || fallback
      );
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT'
    ) {
      return 'The request took too long. Please try again.';
    }

    if (!error.response) {
      return 'Cannot connect to the server. Check that the backend is running.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
