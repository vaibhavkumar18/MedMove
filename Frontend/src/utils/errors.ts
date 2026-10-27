
import axios from 'axios';

import type { ApiErrorBody } from '../types/contracts';

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;

    if (body?.error?.message) {
      return body.error.message;
    }

    if (typeof body?.detail === 'string') {
      return body.detail;
    }

    if (Array.isArray(body?.detail)) {
      return (
        body.detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join(', ') || fallback
      );
    }

    if (!error.response) {
      if (
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT'
      ) {
        return 'The request took too long. Please try again.';
      }

      return 'Unable to reach the MedMove API. Check the backend URL and try again.';
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : fallback;
}
