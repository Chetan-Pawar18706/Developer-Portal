import type { Request, Response } from 'express';
import type { ProjectDocument } from '../models/project.model';
import type { RequirementDocument } from '../models/requirement.model';
import type { TaskDocument } from '../models/task.model';
import type {
  AddTimeLogInput,
  ClientReviewInput,
  CreateTaskInput,
  ListTasksQuery,
  MoveTaskInput,
  UpdateSubtasksInput,
  UpdateTaskInput,
} from '../routes/task.schemas';
import * as taskService from '../services/task.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): taskService.TaskActor {
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

function requireRequirement(req: Request): RequirementDocument {
  if (!req.requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  return req.requirement;
}

function requireTask(req: Request): TaskDocument {
  if (!req.task) {
    throw new ApiError(404, 'Task not found');
  }

  return req.task;
}

export async function listProjectTasks(req: Request, res: Response): Promise<void> {
  const result = await taskService.listProjectTasks(
    requireProject(req).id,
    req.query as unknown as ListTasksQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit);
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const task = await taskService.createTask(
    requireProject(req),
    requireActor(req),
    req.body as CreateTaskInput,
  );

  sendSuccess(res, { task }, 'Task created', 201);
}

export async function getTask(req: Request, res: Response): Promise<void> {
  const task = await taskService.getTask(requireTask(req).id);
  sendSuccess(res, { task }, 'Task retrieved');
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const task = await taskService.updateTask(
    requireTask(req),
    requireProject(req),
    requireActor(req),
    req.body as UpdateTaskInput,
  );

  sendSuccess(res, { task }, 'Task updated');
}

export async function moveTask(req: Request, res: Response): Promise<void> {
  const task = await taskService.moveTask(
    requireTask(req),
    requireProject(req),
    requireActor(req),
    req.body as MoveTaskInput,
  );

  sendSuccess(res, { task }, 'Task moved');
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  await taskService.deleteTask(requireTask(req), requireActor(req));
  sendSuccess(res, null, 'Task deleted');
}

export async function addTimeLog(req: Request, res: Response): Promise<void> {
  const task = await taskService.addTimeLog(
    requireTask(req),
    requireActor(req),
    req.body as AddTimeLogInput,
  );

  sendSuccess(res, { task }, 'Time logged');
}

export async function updateSubtasks(req: Request, res: Response): Promise<void> {
  const task = await taskService.updateSubtasks(
    requireTask(req),
    requireActor(req),
    req.body as UpdateSubtasksInput,
  );

  sendSuccess(res, { task }, 'Subtasks updated');
}

export async function reviewTask(req: Request, res: Response): Promise<void> {
  const task = await taskService.reviewTaskAsClient(
    requireTask(req),
    requireProject(req),
    requireActor(req),
    req.body as ClientReviewInput,
  );

  sendSuccess(res, { task }, 'Client review recorded');
}

export async function getRequirementProgress(
  req: Request,
  res: Response,
): Promise<void> {
  const progress = await taskService.getRequirementProgress(requireRequirement(req));
  sendSuccess(res, { progress }, 'Requirement task progress retrieved');
}
