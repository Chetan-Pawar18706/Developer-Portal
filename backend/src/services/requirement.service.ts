import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import {
  Project,
  type ProjectDocument,
  type ProjectStatus,
} from '../models/project.model';
import {
  Requirement,
  type RequirementAttributes,
  type RequirementAttachmentAttributes,
  type RequirementDocument,
  type RequirementPriority,
  type RequirementStatus,
  type RequirementType,
  type RequirementVersionAttributes,
} from '../models/requirement.model';
import type { UserRole } from '../models/user.model';
import type {
  CreateChangeRequestInput,
  CreateRequirementInput,
  ListAllRequirementsQuery,
  ListRequirementsQuery,
  UpdateRequirementInput,
  UpdateRequirementStatusInput,
} from '../routes/requirement.schemas';
import { ApiError } from '../utils/ApiError';
import { logActivity } from './activity.service';
import { notifyProjectTeam } from './notification.service';
import { buildProjectVisibilityFilter } from './project.service';

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'a',
    'code',
    'pre',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
  },
};

const REQUIREMENT_POPULATE = [
  { path: 'project', select: 'title status' },
  { path: 'createdBy', select: 'name email role avatar' },
  { path: 'versions.editedBy', select: 'name email role avatar' },
  { path: 'changeRequestOf', select: 'title status' },
];

export const REQUIREMENT_STATUS_TRANSITIONS: Record<
  RequirementStatus,
  readonly RequirementStatus[]
> = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'clarification', 'rejected'],
  clarification: ['submitted'],
  approved: [],
  rejected: [],
};

export interface RequirementActor {
  id: string;
  role: UserRole;
}

export interface RequirementUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

export interface PublicRequirementVersion {
  title: string;
  description: string;
  editedBy: RequirementUserSummary | null;
  editedAt: Date;
}

export interface PublicRequirementAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: string | null;
  uploadedAt: Date | null;
}

export interface PublicRequirementLink {
  id: string;
  title: string;
  status: RequirementStatus;
}

export interface PublicRequirement {
  id: string;
  projectId: string;
  projectTitle: string;
  projectStatus: ProjectStatus | null;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: RequirementPriority;
  type: RequirementType;
  status: RequirementStatus;
  versions: PublicRequirementVersion[];
  attachments: PublicRequirementAttachment[];
  createdBy: RequirementUserSummary | null;
  reviewNote: string;
  changeRequestOf: PublicRequirementLink | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequirementListResult {
  data: PublicRequirement[];
  total: number;
  page: number;
  limit: number;
}

interface PopulatedUserShape {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

interface PopulatedProjectShape {
  _id: Types.ObjectId;
  title: string;
  status: ProjectStatus;
}

interface PopulatedRequirementShape {
  id: string;
  project: Types.ObjectId | PopulatedProjectShape | null;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: RequirementPriority;
  type: RequirementType;
  status: RequirementStatus;
  versions: Array<{
    title: string;
    description: string;
    editedBy: PopulatedUserShape | null;
    editedAt: Date;
  }>;
  attachments: RequirementAttachmentAttributes[];
  createdBy: PopulatedUserShape | null;
  reviewNote: string;
  changeRequestOf:
    | {
        _id: Types.ObjectId;
        title: string;
        status: RequirementStatus;
      }
    | null;
  createdAt: Date;
  updatedAt: Date;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUserSummary(user: PopulatedUserShape): RequirementUserSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

function toPublicRequirement(requirement: RequirementDocument): PublicRequirement {
  const populated = requirement as unknown as PopulatedRequirementShape;
  const project = populated.project;
  const projectIsPopulated =
    project !== null && !(project instanceof Types.ObjectId);
  const projectId = projectIsPopulated ? project._id.toString() : project?.toString() ?? '';

  return {
    id: populated.id,
    projectId,
    projectTitle: projectIsPopulated ? project.title : '',
    projectStatus: projectIsPopulated ? project.status : null,
    title: populated.title,
    description: populated.description,
    acceptanceCriteria: populated.acceptanceCriteria,
    priority: populated.priority,
    type: populated.type,
    status: populated.status,
    versions: populated.versions.map((version) => ({
      title: version.title,
      description: version.description,
      editedBy: version.editedBy ? toUserSummary(version.editedBy) : null,
      editedAt: version.editedAt,
    })),
    attachments: populated.attachments.map((attachment) => ({
      name: attachment.name,
      url: attachment.url,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedBy: attachment.uploadedBy ? attachment.uploadedBy.toString() : null,
      uploadedAt: attachment.uploadedAt,
    })),
    createdBy: populated.createdBy ? toUserSummary(populated.createdBy) : null,
    reviewNote: populated.reviewNote,
    changeRequestOf: populated.changeRequestOf
      ? {
          id: populated.changeRequestOf._id.toString(),
          title: populated.changeRequestOf.title,
          status: populated.changeRequestOf.status,
        }
      : null,
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
  };
}

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, RICH_TEXT_OPTIONS).trim();
}

export function richTextToPlainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeDescription(value: string): string {
  const sanitized = sanitizeRichText(value);

  if (richTextToPlainText(sanitized).length === 0) {
    throw new ApiError(422, 'Requirement description cannot be empty', [
      { field: 'description', message: 'Write a short requirement description.' },
    ]);
  }

  return sanitized;
}

function normalizeAcceptanceCriteria(criteria: readonly string[]): string[] {
  return criteria.map((item) => item.trim()).filter((item) => item.length > 0);
}

function normalizeAttachments(
  attachments: readonly {
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }[],
  actorId: string,
): RequirementAttachmentAttributes[] {
  const now = new Date();

  return attachments.map((attachment) => ({
    name: attachment.name,
    url: attachment.url,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploadedBy: new Types.ObjectId(actorId),
    uploadedAt: now,
  }));
}

export interface RequirementVersionInput {
  title: string;
  description: string;
  editedBy: string | Types.ObjectId;
  editedAt?: Date;
}

export function buildRequirementVersion(
  input: RequirementVersionInput,
): RequirementVersionAttributes {
  return {
    title: input.title,
    description: input.description,
    editedBy:
      input.editedBy instanceof Types.ObjectId
        ? input.editedBy
        : new Types.ObjectId(input.editedBy),
    editedAt: input.editedAt ?? new Date(),
  };
}

export function appendRequirementVersion(
  versions: readonly RequirementVersionAttributes[],
  input: RequirementVersionInput,
): RequirementVersionAttributes[] {
  return [...versions, buildRequirementVersion(input)];
}

export function assertRequirementEditable(status: RequirementStatus): void {
  if (status === 'approved') {
    throw new ApiError(400, 'Approved requirements cannot be edited');
  }
}

interface RequirementStatusChangeInput {
  currentStatus: RequirementStatus;
  targetStatus: RequirementStatus;
  actor: RequirementActor;
  projectClientId: string;
}

export function assertRequirementStatusChange(input: RequirementStatusChangeInput): void {
  const { currentStatus, targetStatus, actor, projectClientId } = input;
  const allowedTargets = REQUIREMENT_STATUS_TRANSITIONS[currentStatus];

  if (!allowedTargets.includes(targetStatus)) {
    throw new ApiError(
      400,
      `A requirement cannot move from ${currentStatus} to ${targetStatus}`,
    );
  }

  if (actor.role === 'admin') {
    return;
  }

  const isClientOwner = actor.role === 'client' && actor.id === projectClientId;
  const isPm = actor.role === 'pm';

  switch (targetStatus) {
    case 'submitted':
      if (!isClientOwner) {
        throw new ApiError(403, 'Only the client owner can submit a requirement');
      }
      return;
    case 'under_review':
    case 'clarification':
    case 'rejected':
      if (!isPm) {
        throw new ApiError(403, 'Only a project manager can review requirements');
      }
      return;
    case 'approved':
      if (!isPm && !isClientOwner) {
        throw new ApiError(403, 'Only the client owner or a project manager can approve');
      }
      return;
    default:
      throw new ApiError(403, 'You do not have permission to change this requirement status');
  }
}

function assertCanManageRequirement(project: ProjectDocument, actor: RequirementActor): void {
  if (actor.role === 'admin' || actor.role === 'pm') {
    return;
  }

  if (actor.role === 'client' && project.client.toString() === actor.id) {
    return;
  }

  throw new ApiError(403, 'You do not have permission to change this requirement');
}

async function findPopulatedRequirement(
  requirementId: string,
): Promise<RequirementDocument> {
  const requirement = await Requirement.findById(requirementId).populate(
    REQUIREMENT_POPULATE,
  );

  if (!requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  return requirement;
}

export async function listRequirements(
  projectId: string,
  query: ListRequirementsQuery,
): Promise<RequirementListResult> {
  const filter: QueryFilter<RequirementAttributes> = {
    project: new Types.ObjectId(projectId),
  };

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.type) {
    filter.type = query.type;
  }

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [requirements, total] = await Promise.all([
    Requirement.find(filter)
      .populate(REQUIREMENT_POPULATE)
      .sort({ [query.sortBy]: direction })
      .skip(skip)
      .limit(query.limit),
    Requirement.countDocuments(filter),
  ]);

  return {
    data: requirements.map(toPublicRequirement),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function listAllRequirements(
  actor: RequirementActor,
  query: ListAllRequirementsQuery,
): Promise<RequirementListResult> {
  const projectFilter = buildProjectVisibilityFilter(actor);

  if (query.projectId) {
    projectFilter._id = new Types.ObjectId(query.projectId);
  }

  const visibleProjects = await Project.find(projectFilter).select('_id');

  if (query.projectId && visibleProjects.length === 0) {
    throw new ApiError(404, 'Project not found');
  }

  if (visibleProjects.length === 0) {
    return { data: [], total: 0, page: query.page, limit: query.limit };
  }

  const filter: QueryFilter<RequirementAttributes> = {
    project: { $in: visibleProjects.map((project) => project._id) },
  };

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.type) {
    filter.type = query.type;
  }

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [requirements, total] = await Promise.all([
    Requirement.find(filter)
      .populate(REQUIREMENT_POPULATE)
      .sort({ [query.sortBy]: direction })
      .skip(skip)
      .limit(query.limit),
    Requirement.countDocuments(filter),
  ]);

  return {
    data: requirements.map(toPublicRequirement),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getRequirement(requirementId: string): Promise<PublicRequirement> {
  const requirement = await findPopulatedRequirement(requirementId);
  return toPublicRequirement(requirement);
}

export async function createRequirement(
  project: ProjectDocument,
  actor: RequirementActor,
  input: CreateRequirementInput,
): Promise<PublicRequirement> {
  assertCanManageRequirement(project, actor);

  const description = sanitizeDescription(input.description);
  const acceptanceCriteria = normalizeAcceptanceCriteria(input.acceptanceCriteria);

  const requirement = await Requirement.create({
    project: project._id,
    title: input.title,
    description,
    acceptanceCriteria,
    priority: input.priority,
    type: input.type,
    status: 'draft',
    versions: [
      buildRequirementVersion({
        title: input.title,
        description,
        editedBy: actor.id,
      }),
    ],
    attachments: normalizeAttachments(input.attachments, actor.id),
    createdBy: new Types.ObjectId(actor.id),
    reviewNote: '',
    changeRequestOf: null,
  });

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'requirement_created',
    entityType: 'requirement',
    entityId: requirement._id,
    meta: {
      requirementId: requirement._id.toString(),
      title: requirement.title,
      status: requirement.status,
    },
  });

  return getRequirement(requirement.id);
}

export async function updateRequirement(
  requirement: RequirementDocument,
  project: ProjectDocument,
  actor: RequirementActor,
  input: UpdateRequirementInput,
): Promise<PublicRequirement> {
  assertRequirementEditable(requirement.status);
  assertCanManageRequirement(project, actor);

  const title = input.title ?? requirement.title;
  const description =
    input.description !== undefined
      ? sanitizeDescription(input.description)
      : requirement.description;
  const acceptanceCriteria =
    input.acceptanceCriteria !== undefined
      ? normalizeAcceptanceCriteria(input.acceptanceCriteria)
      : requirement.acceptanceCriteria;

  requirement.title = title;
  requirement.description = description;
  requirement.acceptanceCriteria = acceptanceCriteria;

  if (input.priority !== undefined) {
    requirement.priority = input.priority;
  }

  if (input.type !== undefined) {
    requirement.type = input.type;
  }

  if (input.attachments !== undefined) {
    requirement.attachments = normalizeAttachments(input.attachments, actor.id);
  }

  requirement.versions = appendRequirementVersion(requirement.versions, {
    title,
    description,
    editedBy: actor.id,
  });

  await requirement.save();

  await logActivity({
    projectId: requirement.project,
    actorId: actor.id,
    action: 'requirement_updated',
    entityType: 'requirement',
    entityId: requirement._id,
    meta: {
      requirementId: requirement._id.toString(),
      title: requirement.title,
      fields: Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([field]) => field),
    },
  });

  return getRequirement(requirement.id);
}

export async function changeRequirementStatus(
  requirement: RequirementDocument,
  project: ProjectDocument,
  actor: RequirementActor,
  input: UpdateRequirementStatusInput,
): Promise<PublicRequirement> {
  assertRequirementStatusChange({
    currentStatus: requirement.status,
    targetStatus: input.status,
    actor,
    projectClientId: project.client.toString(),
  });

  const note = input.note?.trim() ?? '';
  const requiresNote = input.status === 'clarification' || input.status === 'rejected';

  if (requiresNote && note.length === 0) {
    throw new ApiError(400, 'A review note is required for this status change');
  }

  const from = requirement.status;
  requirement.status = input.status;

  if (input.note !== undefined) {
    requirement.reviewNote = note;
  }

  await requirement.save();

  await logActivity({
    projectId: requirement.project,
    actorId: actor.id,
    action: 'requirement_status_changed',
    entityType: 'requirement',
    entityId: requirement._id,
    meta: {
      requirementId: requirement._id.toString(),
      title: requirement.title,
      from,
      to: input.status,
      ...(note ? { note } : {}),
    },
  });

  await notifyProjectTeam(
    project,
    actor.id,
    {
      projectId: project._id.toString(),
      type: 'requirement_status_changed',
      message: `Requirement "${requirement.title}" changed from ${from} to ${input.status}.`,
      link: `/projects/${project._id.toString()}/requirements/${requirement._id.toString()}`,
    },
    { roles: ['pm'] },
  );

  return getRequirement(requirement.id);
}

export async function createRequirementChangeRequest(
  requirement: RequirementDocument,
  project: ProjectDocument,
  actor: RequirementActor,
  input: CreateChangeRequestInput,
): Promise<PublicRequirement> {
  assertCanManageRequirement(project, actor);

  if (requirement.status !== 'approved') {
    throw new ApiError(400, 'Change requests can only be raised against approved requirements');
  }

  const title = (input.title ?? `Change request: ${requirement.title}`).slice(0, 160);
  const description = sanitizeDescription(input.description ?? requirement.description);
  const acceptanceCriteria =
    input.acceptanceCriteria !== undefined
      ? normalizeAcceptanceCriteria(input.acceptanceCriteria)
      : requirement.acceptanceCriteria;

  const changeRequest = await Requirement.create({
    project: requirement.project,
    title,
    description,
    acceptanceCriteria,
    priority: input.priority ?? requirement.priority,
    type: input.type ?? requirement.type,
    status: 'draft',
    versions: [
      buildRequirementVersion({
        title,
        description,
        editedBy: actor.id,
      }),
    ],
    attachments: [],
    createdBy: new Types.ObjectId(actor.id),
    reviewNote: '',
    changeRequestOf: requirement._id,
  });

  await logActivity({
    projectId: requirement.project,
    actorId: actor.id,
    action: 'requirement_change_requested',
    entityType: 'requirement',
    entityId: changeRequest._id,
    meta: {
      requirementId: changeRequest._id.toString(),
      sourceRequirementId: requirement._id.toString(),
      sourceTitle: requirement.title,
      title: changeRequest.title,
    },
  });

  return getRequirement(changeRequest.id);
}
