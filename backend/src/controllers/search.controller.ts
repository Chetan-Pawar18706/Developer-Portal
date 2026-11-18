import type { Request, Response } from 'express';
import type { SearchQuery } from '../routes/search.schemas';
import { searchWorkspace } from '../services/search.service';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/response';

export async function search(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const result = await searchWorkspace(req.user, req.query as unknown as SearchQuery);
  sendSuccess(res, result, 'Search completed');
}
