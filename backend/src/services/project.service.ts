import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import {
  ActivityLog,
  type ActivityEntityType,
} from '../models/activityLog.model';
import {
  Project,
  type ProjectAttributes,
  type ProjectDocument,
  type ProjectPriority,
  type ProjectStatus,
} from '../models/project.model';
import { Issue } from '../models/issue.model';
import { Task } from '../models/task.model';
import { User, type UserAttributes, type UserRole } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ListProjectsQuery,
  SignOffProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
} from '../routes/project.schemas';
import { logActivity } from './activity.service';
import { notifyProjectTeam } from './notification.service';

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ['submitted'],
  submitted: ['in_review', 'active'],
  in_review: ['active'],
  active: ['on_hold', 'completed'],
  on_hold: ['active'],
  completed: ['archived'],
  archived: [],
};

export const OPEN_ISSUE_STATUSES = ['open', 'in_discussion', 'in_progress', 'reopened'] as const;

const PROJECT_POPULATE = [
  { path: 'client', select: 'name email role avatar' },
  { path: 'members.user', select: 'name email role avatar' },
  { path: 'deliverySignOff.signedBy', select: 'name email role avatar' },
];

export interface ProjectActor {
  id: string;
  role: UserRole;
}

export interface ProjectUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

export interface PublicProjectMember {
  user: ProjectUserSummary;
  role: UserRole;
}

export interface PublicDeliverySignOff {
  signedBy: ProjectUserSummary | null;
  signedAt: Date | null;
  note: string;
  rating: number | null;
  feedback: string;
}

export interface PublicProject {
  id: string;
  title: string;
  description: string;
  client: ProjectUserSummary;
  status: ProjectStatus;
  priority: ProjectPriority;
  members: PublicProjectMember[];
  startDate: Date | null;
  dueDate: Date | null;
  tags: string[];
  budget: number;
  health: string;
  deliverySignOff: PublicDeliverySignOff;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicActivity {
  id: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string | null;
  meta: Record<string, unknown>;
  actor: ProjectUserSummary | null;
  createdAt: Date;
}

export interface ProjectListResult {
  data: PublicProject[];
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
  id: string;
  title: string;
  description: string;
  client: PopulatedUserShape;
  status: ProjectStatus;
  priority: ProjectPriority;
  members: Array<{ user: PopulatedUserShape; role: UserRole }>;
  startDate: Date | null;
  dueDate: Date | null;
  tags: string[];
  budget: number;
  health: string;
  deliverySignOff: {
    signedBy: PopulatedUserShape | null;
    signedAt: Date | null;
    note: string;
    rating: number | null;
    feedback: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUserSummary(user: PopulatedUserShape): ProjectUserSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

function toPublicProject(project: ProjectDocument): PublicProject {
  const populated = project as unknown as PopulatedProjectShape;

  return {
    id: populated.id,
    title: populated.title,
    description: populated.description,
    client: toUserSummary(populated.client),
    status: populated.status,
    priority: populated.priority,
    members: populated.members.map((member) => ({
      user: toUserSummary(member.user),
      role: member.role,
    })),
    startDate: populated.startDate,
    dueDate: populated.dueDate,
    tags: populated.tags,
    budget: populated.budget,
    health: populated.health,
    deliverySignOff: {
      signedBy: populated.deliverySignOff.signedBy
        ? toUserSummary(populated.deliverySignOff.signedBy)
        : null,
      signedAt: populated.deliverySignOff.signedAt,
      note: populated.deliverySignOff.note,
      rating: populated.deliverySignOff.rating,
      feedback: populated.deliverySignOff.feedback,
    },
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
  };
}

async function findPopulatedProject(projectId: string): Promise<ProjectDocument> {
  const project = await Project.findById(projectId).populate(PROJECT_POPULATE);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  return project;
}

async function requireActiveUser(userId: string, expectedRole?: UserRole): Promise<void> {
  const filter: QueryFilter<UserAttributes> = {
    _id: new Types.ObjectId(userId),
    isActive: true,
  };

  if (expectedRole) {
    filter.role = expectedRole;
  }

  const exists = await User.exists(filter);

  if (!exists) {
    throw new ApiError(400, expectedRole ? `Selected ${expectedRole} was not found` : 'User not found');
  }
}

async function requireActiveUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  const objectIds = userIds.map((userId) => new Types.ObjectId(userId));
  const count = await User.countDocuments({ _id: { $in: objectIds }, isActive: true });

  if (count !== new Set(userIds).size) {
    throw new ApiError(400, 'One or more selected members are unavailable');
  }
}

/**
 * Builds the Mongo filter that enforces list-level isolation:
 * clients see their own projects and projects they belong to, developers see
 * only assigned projects, and PMs/admins see the whole portfolio.
 */
export function buildProjectVisibilityFilter(actor: ProjectActor): QueryFilter<ProjectAttributes> {
  const userId = new Types.ObjectId(actor.id);

  if (actor.role === 'admin' || actor.role === 'pm') {
    return {};
  }

  if (actor.role === 'developer') {
    return { 'members.user': userId };
  }

  return {
    $or: [{ client: userId }, { 'members.user': userId }],
  };
}

/**
 * Detail access rule: leadership has portfolio access, while everyone else
 * must be the client owner or an explicit project member.
 */
export function canAccessProject(
  project: Pick<ProjectAttributes, 'client' | 'members'>,
  actor: ProjectActor,
): boolean {
  if (actor.role === 'admin' || actor.role === 'pm') {
    return true;
  }

  if (project.client.toString() === actor.id) {
    return true;
  }

  return project.members.some((member) => member.user.toString() === actor.id);
}

export interface StatusChangeInput {
  currentStatus: ProjectStatus;
  targetStatus: ProjectStatus;
  actor: ProjectActor;
  projectClientId: string;
  signOff?: {
    note?: string;
    rating?: number;
    feedback?: string;
  };
}

export function assertStatusChange(input: StatusChangeInput): void {
  const { currentStatus, targetStatus, actor, projectClientId, signOff } = input;
  const allowedTargets = PROJECT_STATUS_TRANSITIONS[currentStatus];

  if (!allowedTargets.includes(targetStatus)) {
    throw new ApiError(
      400,
      `A project cannot move from ${currentStatus} to ${targetStatus}`,
    );
  }

  const isClientOwner = actor.role === 'client' && actor.id === projectClientId;
  const isLeadership = actor.role === 'admin' || actor.role === 'pm';

  if (targetStatus === 'submitted') {
    if (!isClientOwner) {
      throw new ApiError(403, 'Only the client owner can submit a project for review');
    }

    return;
  }

  if (targetStatus === 'completed') {
    if (!isClientOwner) {
      throw new ApiError(403, 'Only the client owner can sign off delivery');
    }

    if (!signOff) {
      throw new ApiError(400, 'Delivery sign-off details are required');
    }

    return;
  }

  if (!isLeadership) {
    throw new ApiError(403, 'You do not have permission to change this project status');
  }
}

export interface SignOffEligibilityInput {
  actor: ProjectActor;
  projectClientId: string;
  status: ProjectStatus;
  incompleteTaskCount: number;
  openCriticalIssueCount: number;
}

export function assertCanSignOff(input: SignOffEligibilityInput): void {
  const { actor, projectClientId, status, incompleteTaskCount, openCriticalIssueCount } = input;

  if (actor.role !== 'client' || actor.id !== projectClientId) {
    throw new ApiError(403, 'Only the client owner can sign off delivery');
  }

  if (status !== 'active' && status !== 'on_hold') {
    throw new ApiError(409, 'Only active projects can be signed off');
  }

  if (incompleteTaskCount > 0) {
    throw new ApiError(
      409,
      `${incompleteTaskCount} ${incompleteTaskCount === 1 ? 'task is' : 'tasks are'} still incomplete`,
    );
  }

  if (openCriticalIssueCount > 0) {
    throw new ApiError(
      409,
      `${openCriticalIssueCount} critical ${openCriticalIssueCount === 1 ? 'issue is' : 'issues are'} still open`,
    );
  }
}

export async function listProjects(
  actor: ProjectActor,
  query: ListProjectsQuery,
): Promise<ProjectListResult> {
  const filter = buildProjectVisibilityFilter(actor);

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$and = [{ $or: [{ title: pattern }, { description: pattern }] }];
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .populate(PROJECT_POPULATE)
      .sort({ [query.sortBy]: direction })
      .skip(skip)
      .limit(query.limit),
    Project.countDocuments(filter),
  ]);

  return {
    data: projects.map(toPublicProject),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getProject(projectId: string): Promise<PublicProject> {
  const project = await findPopulatedProject(projectId);
  return toPublicProject(project);
}

export async function createProject(
  actor: ProjectActor,
  input: CreateProjectInput,
): Promise<PublicProject> {
  const clientId = actor.role === 'client' ? actor.id : input.clientId;

  if (!clientId) {
    throw new ApiError(400, 'A client must be selected for the project');
  }

  await requireActiveUser(clientId, 'client');

  const memberMap = new Map<string, UserRole>();
  for (const member of input.members) {
    memberMap.set(member.userId, member.role);
  }

  // The client owner is always represented in the member list.
  memberMap.set(clientId, 'client');

  // PMs are attached to the projects they create so the delivery team is visible.
  if (actor.role === 'pm' && !memberMap.has(actor.id)) {
    memberMap.set(actor.id, 'pm');
  }

  await requireActiveUsers([...memberMap.keys()]);

  const project = await Project.create({
    title: input.title,
    description: input.description,
    client: new Types.ObjectId(clientId),
    status: 'draft',
    priority: input.priority,
    members: [...memberMap.entries()].map(([userId, role]) => ({
      user: new Types.ObjectId(userId),
      role,
    })),
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    tags: input.tags,
    budget: input.budget,
    health: 'on_track',
  });

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'project_created',
    entityType: 'project',
    entityId: project._id,
    meta: { title: project.title, status: project.status },
  });

  return getProject(project.id);
}

export async function updateProject(
  project: ProjectDocument,
  actor: ProjectActor,
  input: UpdateProjectInput,
): Promise<PublicProject> {
  if (actor.role === 'client') {
    if (project.client.toString() !== actor.id) {
      throw new ApiError(403, 'Only the client owner can edit this project');
    }

    if (project.status !== 'draft') {
      throw new ApiError(403, 'Projects can only be edited while they are in draft');
    }

    if (input.health !== undefined) {
      throw new ApiError(403, 'Only the delivery team can update project health');
    }
  }

  if (actor.role === 'developer') {
    throw new ApiError(403, 'Developers cannot edit project details');
  }

  if (input.title !== undefined) {
    project.title = input.title;
  }

  if (input.description !== undefined) {
    project.description = input.description;
  }

  if (input.priority !== undefined) {
    project.priority = input.priority;
  }

  if (input.startDate !== undefined) {
    project.startDate = input.startDate;
  }

  if (input.dueDate !== undefined) {
    project.dueDate = input.dueDate;
  }

  if (input.tags !== undefined) {
    project.tags = input.tags;
  }

  if (input.budget !== undefined) {
    project.budget = input.budget;
  }

  if (input.health !== undefined) {
    project.health = input.health;
  }

  await project.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'project_updated',
    entityType: 'project',
    entityId: project._id,
    meta: { fields: Object.keys(input) },
  });

  return getProject(project.id);
}

export async function archiveProject(
  project: ProjectDocument,
  actor: ProjectActor,
): Promise<PublicProject> {
  if (project.status === 'archived') {
    return getProject(project.id);
  }

  const from = project.status;
  project.status = 'archived';
  await project.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'project_archived',
    entityType: 'status',
    entityId: project._id,
    meta: { from, to: 'archived' },
  });

  return getProject(project.id);
}

export async function addProjectMember(
  project: ProjectDocument,
  actor: ProjectActor,
  input: AddProjectMemberInput,
): Promise<PublicProject> {
  await requireActiveUser(input.userId);

  const alreadyMember = project.members.some(
    (member) => member.user.toString() === input.userId,
  );

  if (alreadyMember) {
    throw new ApiError(409, 'User is already a member of this project');
  }

  project.members.push({
    user: new Types.ObjectId(input.userId),
    role: input.role,
  });
  await project.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'member_added',
    entityType: 'member',
    entityId: input.userId,
    meta: { userId: input.userId, role: input.role },
  });

  return getProject(project.id);
}

export async function removeProjectMember(
  project: ProjectDocument,
  actor: ProjectActor,
  userId: string,
): Promise<PublicProject> {
  if (project.client.toString() === userId) {
    throw new ApiError(400, 'The client owner cannot be removed from the project');
  }

  const index = project.members.findIndex((member) => member.user.toString() === userId);

  if (index === -1) {
    throw new ApiError(404, 'Project member not found');
  }

  const [removed] = project.members.splice(index, 1);
  await project.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'member_removed',
    entityType: 'member',
    entityId: userId,
    meta: { userId, role: removed.role },
  });

  return getProject(project.id);
}

export async function changeProjectStatus(
  project: ProjectDocument,
  actor: ProjectActor,
  input: UpdateProjectStatusInput,
): Promise<PublicProject> {
  const hasSignOff = Boolean(
    input.rating !== undefined || input.note?.trim() || input.feedback?.trim(),
  );

  assertStatusChange({
    currentStatus: project.status,
    targetStatus: input.status,
    actor,
    projectClientId: project.client.toString(),
    signOff:
      input.status === 'completed' && hasSignOff
        ? { note: input.note, rating: input.rating, feedback: input.feedback }
        : undefined,
  });

  const from = project.status;

  if (input.status === 'completed') {
    project.deliverySignOff = {
      signedBy: new Types.ObjectId(actor.id),
      signedAt: new Date(),
      note: input.note ?? '',
      rating: input.rating ?? null,
      feedback: input.feedback ?? '',
    };
  }

  project.status = input.status;
  await project.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'status_changed',
    entityType: 'status',
    entityId: project._id,
    meta: {
      from,
      to: input.status,
      ...(input.note ? { note: input.note } : {}),
      ...(input.status === 'completed' ? { signedOff: true } : {}),
    },
  });

  await notifyProjectTeam(
    project,
    actor.id,
    {
      projectId: project._id.toString(),
      type: 'project_status_changed',
      message: `Project "${project.title}" changed from ${from} to ${input.status}.`,
      link: `/projects/${project._id.toString()}`,
    },
    { includeAllMembers: true },
  );

  return getProject(project.id);
}

export async function signOffProject(
  project: ProjectDocument,
  actor: ProjectActor,
  input: SignOffProjectInput,
): Promise<PublicProject> {
  const [incompleteTaskCount, openCriticalIssueCount] = await Promise.all([
    Task.countDocuments({ project: project._id, status: { $ne: 'done' } }),
    Issue.countDocuments({
      project: project._id,
      severity: 'critical',
      status: { $in: [...OPEN_ISSUE_STATUSES] },
    }),
  ]);

  assertCanSignOff({
    actor,
    projectClientId: project.client.toString(),
    status: project.status,
    incompleteTaskCount,
    openCriticalIssueCount,
  });

  const from = project.status;
  const signedAt = new Date();

  project.status = 'completed';
  project.deliverySignOff = {
    signedBy: new Types.ObjectId(actor.id),
    signedAt,
    note: input.note ?? '',
    rating: input.rating,
    feedback: input.feedback,
  };
  await project.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'delivery_signed_off',
    entityType: 'status',
    entityId: project._id,
    meta: {
      from,
      to: 'completed',
      signedOff: true,
      rating: input.rating,
      ...(input.note ? { note: input.note } : {}),
    },
  });

  await notifyProjectTeam(
    project,
    actor.id,
    {
      projectId: project._id.toString(),
      type: 'project_status_changed',
      message: `Project "${project.title}" was signed off and completed.`,
      link: `/projects/${project._id.toString()}/overview`,
    },
    { includeAllMembers: true },
  );

  return getProject(project.id);
}

export async function getProjectActivity(projectId: string): Promise<PublicActivity[]> {
  const activities = await ActivityLog.find({ project: projectId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: 'actor', select: 'name email role avatar' });

  return activities.map((activity) => {
    const actor = activity.actor as unknown as PopulatedUserShape | null;

    return {
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId ? activity.entityId.toString() : null,
      meta: activity.meta,
      actor: actor ? toUserSummary(actor) : null,
      createdAt: activity.createdAt,
    };
  });
}
