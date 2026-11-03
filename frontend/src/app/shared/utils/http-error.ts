import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  message?: unknown;
  details?: Array<{ field?: unknown; message?: unknown }>;
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  const body = error.error as ApiErrorBody | null;

  if (body && typeof body.message === 'string' && body.message.length > 0) {
    if (Array.isArray(body.details) && body.details.length > 0) {
      const detail = body.details[0];
      if (detail && typeof detail.message === 'string' && detail.message.length > 0) {
        return detail.message;
      }
    }

    return body.message;
  }

  switch (error.status) {
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'That value is already in use.';
    case 422:
      return 'Some of the submitted values are invalid.';
    case 429:
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return error.status >= 500
        ? 'The server ran into a problem. Please try again shortly.'
        : fallback;
  }
}
