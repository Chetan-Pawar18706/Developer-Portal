export interface ApiErrorDetails {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details: ApiErrorDetails[];

  constructor(statusCode: number, message: string, details: ApiErrorDetails[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, ApiError);
  }
}
