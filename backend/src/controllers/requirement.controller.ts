import type { Request, Response } from 'express';
import type { ProjectDocument } from '../models/project.model';
import type { RequirementDocument } from '../models/requirement.model';
import type {
  CreateChangeRequestInput,
  CreateRequirementInput,
  ListRequirementsQuery,
  UpdateRequirementInput,
  UpdateRequirementStatusInput,
} from '../routes/requirement.schemas';
import * as requirementService from '../services/requirement.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): requirementService.RequirementActor {
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

export async function listProjectRequirements(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await requirementService.listRequirements(
    requireProject(req).id,
    req.query as unknown as ListRequirementsQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit);
}

export async function createProjectRequirement(
  req: Request,
  res: Response,
): Promise<void> {
  const requirement = await requirementService.createRequirement(
    requireProject(req),
    requireActor(req),
    req.body as CreateRequirementInput,
  );

  sendSuccess(res, { requirement }, 'Requirement created', 201);
}

export async function getRequirement(req: Request, res: Response): Promise<void> {
  const requirement = await requirementService.getRequirement(
    requireRequirement(req).id,
  );

  sendSuccess(res, { requirement }, 'Requirement retrieved');
}

export async function updateRequirement(req: Request, res: Response): Promise<void> {
  const requirement = await requirementService.updateRequirement(
    requireRequirement(req),
    requireProject(req),
    requireActor(req),
    req.body as UpdateRequirementInput,
  );

  sendSuccess(res, { requirement }, 'Requirement updated');
}

export async function changeRequirementStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const requirement = await requirementService.changeRequirementStatus(
    requireRequirement(req),
    requireProject(req),
    requireActor(req),
    req.body as UpdateRequirementStatusInput,
  );

  sendSuccess(res, { requirement }, 'Requirement status updated');
}

export async function createChangeRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const requirement = await requirementService.createRequirementChangeRequest(
    requireRequirement(req),
    requireProject(req),
    requireActor(req),
    req.body as CreateChangeRequestInput,
  );

  sendSuccess(res, { requirement }, 'Change request created', 201);
}
