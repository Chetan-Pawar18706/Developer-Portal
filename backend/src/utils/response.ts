import type { Response } from 'express';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): Response {
  const payload: SuccessResponse<T> = { success: true, data, message };
  return res.status(statusCode).json(payload);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success',
): Response {
  const payload: PaginatedData<T> = { data, total, page, limit };
  return sendSuccess(res, payload, message);
}
