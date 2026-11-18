import type { Request, Response } from 'express';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ListProjectsQuery,
  SignOffProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
} from '../routes/project.schemas';
import * as projectService from '../services/project.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): projectService.ProjectActor {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

function requireProject(req: Request) {
  if (!req.project) {
    throw new ApiError(404, 'Project not found');
  }

  return req.project;
}

export async function listProjects(req: Request, res: Response): Promise<void> {
  const result = await projectService.listProjects(
    requireActor(req),
    req.query as unknown as ListProjectsQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit);
}

export async function createProject(req: Request, res: Response): Promise<void> {
  const project = await projectService.createProject(
    requireActor(req),
    req.body as CreateProjectInput,
  );

  sendSuccess(res, { project }, 'Project created', 201);
}

export async function getProject(req: Request, res: Response): Promise<void> {
  const project = await projectService.getProject(requireProject(req).id);

  sendSuccess(res, { project }, 'Project retrieved');
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  const project = await projectService.updateProject(
    requireProject(req),
    requireActor(req),
    req.body as UpdateProjectInput,
  );

  sendSuccess(res, { project }, 'Project updated');
}

export async function archiveProject(req: Request, res: Response): Promise<void> {
  const project = await projectService.archiveProject(
    requireProject(req),
    requireActor(req),
  );

  sendSuccess(res, { project }, 'Project archived');
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const project = await projectService.addProjectMember(
    requireProject(req),
    requireActor(req),
    req.body as AddProjectMemberInput,
  );

  sendSuccess(res, { project }, 'Project member added');
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const project = await projectService.removeProjectMember(
    requireProject(req),
    requireActor(req),
    req.params.userId,
  );

  sendSuccess(res, { project }, 'Project member removed');
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  const project = await projectService.changeProjectStatus(
    requireProject(req),
    requireActor(req),
    req.body as UpdateProjectStatusInput,
  );

  sendSuccess(res, { project }, 'Project status updated');
}

export async function signOff(req: Request, res: Response): Promise<void> {
  const project = await projectService.signOffProject(
    requireProject(req),
    requireActor(req),
    req.body as SignOffProjectInput,
  );

  sendSuccess(res, { project }, 'Delivery signed off');
}

export async function getActivity(req: Request, res: Response): Promise<void> {
  const activities = await projectService.getProjectActivity(requireProject(req).id);

  sendSuccess(res, { activities }, 'Project activity retrieved');
}
