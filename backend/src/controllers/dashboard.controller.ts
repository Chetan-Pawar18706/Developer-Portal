import type { Request, Response } from 'express';
import type { DashboardActor } from '../services/dashboard.service';
import * as dashboardService from '../services/dashboard.service';
import { buildProjectReportPdf } from '../services/projectReportPdf.service';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/response';

function requireActor(req: Request): DashboardActor {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

function requireProjectId(req: Request): string {
  const id = req.params.id;

  if (!id) {
    throw new ApiError(400, 'Project id is required');
  }

  return id;
}

export async function getProjectDashboard(req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getProjectDashboard(requireProjectId(req));
  sendSuccess(res, result, 'Project dashboard generated');
}

export async function getProjectPmDashboard(req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getProjectPmDashboard(requireProjectId(req));
  sendSuccess(res, result, 'PM dashboard generated');
}

export async function getAdminDashboard(req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getAdminDashboard(requireActor(req));
  sendSuccess(res, result, 'Admin dashboard generated');
}

export async function getMeDashboard(req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getMeDashboard(requireActor(req));
  sendSuccess(res, result, 'Dashboard generated');
}

export async function downloadProjectReport(req: Request, res: Response): Promise<void> {
  const projectId = requireProjectId(req);
  const pdf = await buildProjectReportPdf(projectId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="project-report-${projectId.slice(0, 8)}.pdf"`,
  );
  res.setHeader('Content-Length', pdf.length);
  res.status(200).send(pdf);
}
