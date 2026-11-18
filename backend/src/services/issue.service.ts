import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import {
  Issue,
  type IssueAttributes,
  type IssueDocument,
  type IssueStatus,
} from '../models/issue.model';
import { Project, type ProjectDocument } from '../models/project.model';
import type { TaskPriority, TaskStatus } from '../models/task.model';
import { User, type UserRole } from '../models/user.model';
import type {
  CreateIssueInput,
  IssueAttachmentInput,
  ListAllIssuesQuery,
  ListIssuesQuery,
  UpdateIssueInput,
  UpdateIssueStatusInput,
} from '../routes/issue.schemas';
import { ApiError } from '../utils/ApiError';
import { logActivity } from './activity.service';
import { notify } from './notification.service';
import { buildProjectVisibilityFilter } from './project.service';
import {
  createTaskFromIssue,
  getTask,
  type PublicTask,
} from './task.service';

const ISSUE_POPULATE = [
  { path: 'project', select: 'title' },
  { path: 'raisedBy', select: 'name email role avatar' },
  { path: 'assignedTo', select: 'name email role avatar' },
  { path: 'linkedTask', select: 'title status priority' },
];

export const ISSUE_STATUS_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  open: ['in_discussion', 'in_progress', 'resolved', 'closed'],
  in_discussion: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['in_progress', 'closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['in_discussion', 'in_progress', 'resolved', 'closed'],
};

const SEVERITY_TO_PRIORITY: Record<CreateIssueInput['severity'], TaskPriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

export interface IssueActor {
  id: string;
  role: UserRole;
}

export interface IssueUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

export interface PublicIssueAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface PublicIssueTaskLink {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface PublicIssue {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description: string;
  type: CreateIssueInput['type'];
  severity: CreateIssueInput['severity'];
  status: IssueStatus;
  stepsToReproduce: string;
  raisedBy: IssueUserSummary;
  assignedTo: IssueUserSummary | null;
  attachments: PublicIssueAttachment[];
  linkedTask: PublicIssueTaskLink | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueListResult {
  data: PublicIssue[];
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
}

interface PopulatedTaskShape {
  _id: Types.ObjectId;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

interface PopulatedIssueShape {
  id: string;
  project: Types.ObjectId | PopulatedProjectShape;
  title: string;
  description: string;
  type: PublicIssue['type'];
  severity: PublicIssue['severity'];
  status: IssueStatus;
  stepsToReproduce: string;
  raisedBy: PopulatedUserShape;
  assignedTo: PopulatedUserShape | null;
  attachments: IssueAttachmentInput[];
  linkedTask: Types.ObjectId | PopulatedTaskShape | null;
  createdAt: Date;
  updatedAt: Date;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUserSummary(user: PopulatedUserShape): IssueUserSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

function toPublicIssue(issue: IssueDocument): PublicIssue {
  const populated = issue as unknown as PopulatedIssueShape;
  const project = populated.project;
  const linkedTask = populated.linkedTask;

  return {
    id: populated.id,
    projectId: project instanceof Types.ObjectId ? project.toString() : project._id.toString(),
    projectTitle: project instanceof Types.ObjectId ? '' : project.title,
    title: populated.title,
    description: populated.description,
    type: populated.type,
    severity: populated.severity,
    status: populated.status,
    stepsToReproduce: populated.stepsToReproduce,
    raisedBy: toUserSummary(populated.raisedBy),
    assignedTo: populated.assignedTo ? toUserSummary(populated.assignedTo) : null,
    attachments: populated.attachments.map((attachment) => ({ ...attachment })),
    linkedTask:
      linkedTask && !(linkedTask instanceof Types.ObjectId)
        ? {
            id: linkedTask._id.toString(),
            title: linkedTask.title,
            status: linkedTask.status,
            priority: linkedTask.priority,
          }
        : null,
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
  };
}

async function findPopulatedIssue(issueId: string): Promise<IssueDocument> {
  const issue = await Issue.findById(issueId).populate(ISSUE_POPULATE);

  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  return issue;
}

function buildListFilter(
  query: ListIssuesQuery | ListAllIssuesQuery,
  projectId?: string,
): QueryFilter<IssueAttributes> {
  const filter: QueryFilter<IssueAttributes> = {};
  const scopedProjectId =
    projectId ?? ('projectId' in query ? query.projectId : undefined);

  if (scopedProjectId) {
    filter.project = new Types.ObjectId(scopedProjectId);
  }

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.severity) {
    filter.severity = query.severity;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.assignedTo) {
    filter.assignedTo = new Types.ObjectId(query.assignedTo);
  }

  return filter;
}

function isStaff(actor: IssueActor): boolean {
  return actor.role === 'admin' || actor.role === 'pm' || actor.role === 'developer';
}

function assertCanEditIssue(issue: IssueDocument, actor: IssueActor): void {
  if (isStaff(actor)) {
    return;
  }

  if (actor.role === 'client' && issue.raisedBy.toString() === actor.id) {
    return;
  }

  throw new ApiError(403, 'You can only edit issues you raised');
}

function assertCanConvertIssue(actor: IssueActor): void {
  if (actor.role !== 'admin' && actor.role !== 'pm') {
    throw new ApiError(403, 'Only a project manager or admin can convert an issue to a task');
  }
}

function assertValidStatusChange(
  issue: IssueDocument,
  actor: IssueActor,
  target: IssueStatus,
): void {
  if (actor.role === 'client') {
    if (issue.raisedBy.toString() !== actor.id) {
      throw new ApiError(403, 'You can only manage issues you raised');
    }

    if (target !== 'closed' && target !== 'reopened') {
      throw new ApiError(403, 'Clients can only close or reopen their own issues');
    }

    if (target === 'reopened' && issue.status !== 'closed') {
      throw new ApiError(409, 'Only a closed issue can be reopened');
    }

    return;
  }

  if (!ISSUE_STATUS_TRANSITIONS[issue.status].includes(target)) {
    throw new ApiError(409, `Cannot change an issue from ${issue.status} to ${target}`);
  }
}

async function findAutoAssignee(project: ProjectDocument): Promise<Types.ObjectId | null> {
  const pmMember = project.members.find((member) => member.role === 'pm');

  if (!pmMember) {
    return null;
  }

  const active = await User.exists({ _id: pmMember.user, isActive: true });
  return active ? pmMember.user : null;
}

async function assertValidAssignee(
  project: ProjectDocument,
  assigneeId: string,
): Promise<void> {
  const isMember = project.members.some(
    (member) => member.user.toString() === assigneeId,
  );

  if (!isMember) {
    throw new ApiError(400, 'The assignee must be a member of this project');
  }

  const active = await User.exists({
    _id: new Types.ObjectId(assigneeId),
    isActive: true,
  });

  if (!active) {
    throw new ApiError(400, 'The selected assignee is not available');
  }
}

function attachmentValues(
  attachments: readonly IssueAttachmentInput[],
): PublicIssueAttachment[] {
  return attachments.map((attachment) => ({
    name: attachment.name,
    url: attachment.url,
    mimeType: attachment.mimeType,
    size: attachment.size,
  }));
}

async function runIssueList(
  filter: QueryFilter<IssueAttributes>,
  query: ListIssuesQuery | ListAllIssuesQuery,
): Promise<IssueListResult> {
  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .populate(ISSUE_POPULATE)
      .sort({ [query.sortBy]: direction, createdAt: 1 })
      .skip(skip)
      .limit(query.limit),
    Issue.countDocuments(filter),
  ]);

  return {
    data: issues.map(toPublicIssue),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function listIssues(
  project: ProjectDocument,
  query: ListIssuesQuery,
): Promise<IssueListResult> {
  const filter = buildListFilter(query, project._id.toString());
  return runIssueList(filter, query);
}

export async function listAllIssues(
  actor: IssueActor,
  query: ListAllIssuesQuery,
): Promise<IssueListResult> {
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

  const filter = buildListFilter(query);
  filter.project = { $in: visibleProjects.map((project) => project._id) };
  return runIssueList(filter, query);
}

export async function getIssue(issueId: string): Promise<PublicIssue> {
  return toPublicIssue(await findPopulatedIssue(issueId));
}

export async function createIssue(
  project: ProjectDocument,
  actor: IssueActor,
  input: CreateIssueInput,
): Promise<PublicIssue> {
  const assignedTo = await findAutoAssignee(project);
  const issue = await Issue.create({
    project: project._id,
    title: input.title,
    description: input.description,
    type: input.type,
    severity: input.severity,
    status: 'open',
    stepsToReproduce: input.stepsToReproduce,
    raisedBy: new Types.ObjectId(actor.id),
    assignedTo,
    attachments: attachmentValues(input.attachments),
    linkedTask: null,
  });

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'issue_created',
    entityType: 'issue',
    entityId: issue._id,
    meta: {
      issueId: issue.id,
      title: issue.title,
      type: issue.type,
      severity: issue.severity,
      assignedTo: assignedTo?.toString() ?? null,
    },
  });

  return getIssue(issue.id);
}

export async function updateIssue(
  issue: IssueDocument,
  project: ProjectDocument,
  actor: IssueActor,
  input: UpdateIssueInput,
): Promise<PublicIssue> {
  assertCanEditIssue(issue, actor);

  if (actor.role === 'client') {
    if (input.assignedTo !== undefined) {
      throw new ApiError(403, 'Clients cannot assign issues');
    }

    if (issue.status !== 'open' && issue.status !== 'reopened') {
      throw new ApiError(409, 'This issue can no longer be edited by the client');
    }
  }

  if (input.assignedTo !== undefined && input.assignedTo) {
    await assertValidAssignee(project, input.assignedTo);
  }

  const previousAssignee = issue.assignedTo?.toString() ?? null;

  if (input.title !== undefined) {
    issue.title = input.title;
  }

  if (input.description !== undefined) {
    issue.description = input.description;
  }

  if (input.type !== undefined) {
    issue.type = input.type;
  }

  if (input.severity !== undefined) {
    issue.severity = input.severity;
  }

  if (input.stepsToReproduce !== undefined) {
    issue.stepsToReproduce = input.stepsToReproduce;
  }

  if (input.attachments !== undefined) {
    issue.attachments = attachmentValues(input.attachments);
  }

  if (input.assignedTo !== undefined) {
    issue.assignedTo = input.assignedTo ? new Types.ObjectId(input.assignedTo) : null;
  }

  await issue.save();

  const nextAssignee = issue.assignedTo?.toString() ?? null;

  if (input.assignedTo !== undefined && nextAssignee !== previousAssignee) {
    await logActivity({
      projectId: project._id,
      actorId: actor.id,
      action: 'issue_assigned',
      entityType: 'issue',
      entityId: issue._id,
      meta: {
        issueId: issue.id,
        from: previousAssignee,
        to: nextAssignee,
      },
    });
  }

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'issue_updated',
    entityType: 'issue',
    entityId: issue._id,
    meta: {
      issueId: issue.id,
      fields: Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([field]) => field),
    },
  });

  return getIssue(issue.id);
}

export async function changeIssueStatus(
  issue: IssueDocument,
  actor: IssueActor,
  input: UpdateIssueStatusInput,
): Promise<PublicIssue> {
  assertValidStatusChange(issue, actor, input.status);

  if (issue.status === input.status) {
    return getIssue(issue.id);
  }

  const previousStatus = issue.status;
  issue.status = input.status;
  await issue.save();

  await logActivity({
    projectId: issue.project,
    actorId: actor.id,
    action: 'issue_status_changed',
    entityType: 'issue',
    entityId: issue._id,
    meta: {
      issueId: issue.id,
      from: previousStatus,
      to: input.status,
      note: input.note,
    },
  });

  const recipients = new Set<string>([issue.raisedBy.toString()]);

  if (issue.assignedTo) {
    recipients.add(issue.assignedTo.toString());
  }

  recipients.delete(actor.id);

  await notify([...recipients], {
    projectId: issue.project.toString(),
    type: 'issue_status_changed',
    message: `Issue "${issue.title}" changed from ${previousStatus} to ${input.status}.`,
    link: `/projects/${issue.project.toString()}/issues/${issue._id.toString()}`,
  });

  return getIssue(issue.id);
}

export async function convertIssueToTask(
  issue: IssueDocument,
  project: ProjectDocument,
  actor: IssueActor,
): Promise<PublicTask> {
  assertCanConvertIssue(actor);

  if (issue.linkedTask) {
    return getTask(issue.linkedTask.toString());
  }

  const descriptionParts = [
    issue.description,
    issue.stepsToReproduce
      ? `Steps to reproduce:\n${issue.stepsToReproduce}`
      : '',
  ].filter((part) => part.length > 0);

  const task = await createTaskFromIssue(project, actor, {
    issueId: issue.id,
    title: issue.title,
    description: descriptionParts.join('\n\n'),
    type: issue.type,
    priority: SEVERITY_TO_PRIORITY[issue.severity],
    assigneeId: issue.assignedTo?.toString() ?? null,
  });

  issue.linkedTask = new Types.ObjectId(task.id);

  if (issue.status !== 'in_progress') {
    issue.status = 'in_progress';
  }

  await issue.save();

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'issue_converted_to_task',
    entityType: 'issue',
    entityId: issue._id,
    meta: {
      issueId: issue.id,
      taskId: task.id,
      title: issue.title,
    },
  });

  return task;
}
