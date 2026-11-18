import type { Request, Response } from 'express';
import type { IssueDocument } from '../models/issue.model';
import type { ProjectDocument } from '../models/project.model';
import type {
  CreateIssueInput,
  ListAllIssuesQuery,
  ListIssuesQuery,
  UpdateIssueInput,
  UpdateIssueStatusInput,
} from '../routes/issue.schemas';
import * as issueService from '../services/issue.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): issueService.IssueActor {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

function requireProject(req: Request): ProjectDocument {
  if (!req.project) {
    throw new ApiError(404, 'Project not found');
  }

  return req.project;
}

function requireIssue(req: Request): IssueDocument {
  if (!req.issue) {
    throw new ApiError(404, 'Issue not found');
  }

  return req.issue;
}

export async function listAllIssues(req: Request, res: Response): Promise<void> {
  const result = await issueService.listAllIssues(
    requireActor(req),
    req.query as unknown as ListAllIssuesQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit, 'Issues retrieved');
}

export async function listProjectIssues(req: Request, res: Response): Promise<void> {
  const result = await issueService.listIssues(
    requireProject(req),
    req.query as unknown as ListIssuesQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit, 'Issues retrieved');
}

export async function createProjectIssue(req: Request, res: Response): Promise<void> {
  const issue = await issueService.createIssue(
    requireProject(req),
    requireActor(req),
    req.body as CreateIssueInput,
  );

  sendSuccess(res, { issue }, 'Issue raised', 201);
}

export async function getIssue(req: Request, res: Response): Promise<void> {
  const issue = await issueService.getIssue(requireIssue(req).id);
  sendSuccess(res, { issue }, 'Issue retrieved');
}

export async function updateIssue(req: Request, res: Response): Promise<void> {
  const issue = await issueService.updateIssue(
    requireIssue(req),
    requireProject(req),
    requireActor(req),
    req.body as UpdateIssueInput,
  );

  sendSuccess(res, { issue }, 'Issue updated');
}

export async function changeIssueStatus(req: Request, res: Response): Promise<void> {
  const issue = await issueService.changeIssueStatus(
    requireIssue(req),
    requireActor(req),
    req.body as UpdateIssueStatusInput,
  );

  sendSuccess(res, { issue }, 'Issue status updated');
}

export async function convertIssueToTask(req: Request, res: Response): Promise<void> {
  const task = await issueService.convertIssueToTask(
    requireIssue(req),
    requireProject(req),
    requireActor(req),
  );

  sendSuccess(res, { task }, 'Issue converted to task', 201);
}
