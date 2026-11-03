import type { Response } from 'express';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
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
