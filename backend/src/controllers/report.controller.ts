import type { Request, Response } from 'express';
import type { ReportQuery } from '../routes/report.schemas';
import * as reportService from '../services/report.service';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/response';

export async function getReport(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const report = await reportService.getPortfolioReport(req.user, req.query as ReportQuery);
  sendSuccess(res, report, 'Report generated');
}
