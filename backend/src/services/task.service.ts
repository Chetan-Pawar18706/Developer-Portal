import type { ClientSession, QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import type { IssueStatus, IssueType } from '../models/issue.model';
import {
  Project,
  type ProjectDocument,
} from '../models/project.model';
import {
  Requirement,
  type RequirementDocument,
  type RequirementStatus,
} from '../models/requirement.model';
import {
  Task,
  type TaskAttributes,
  type TaskClientReviewStatus,
  type TaskDocument,
  type TaskPriority,
  type TaskStatus,
  type TaskSubtaskAttributes,
} from '../models/task.model';
import { User, type UserRole } from '../models/user.model';
import type {
  AddTimeLogInput,
  ClientReviewInput,
  CreateTaskInput,
  ListAllTasksQuery,
  ListTasksQuery,
  MoveTaskInput,
  UpdateSubtasksInput,
  UpdateTaskInput,
} from '../routes/task.schemas';
import { ApiError } from '../utils/ApiError';
import { logActivity } from './activity.service';
import { notify } from './notification.service';
import { buildProjectVisibilityFilter } from './project.service';
import { refreshHealthSafely } from './projectHealth.service';

const TASK_POPULATE = [
  { path: 'project', select: 'title' },
  { path: 'requirement', select: 'title status' },
  { path: 'assignee', select: 'name email role avatar' },
  { path: 'reporter', select: 'name email role avatar' },
  { path: 'timeLogs.user', select: 'name email role avatar' },
  { path: 'clientReview.by', select: 'name email role avatar' },
  { path: 'linkedIssue', select: 'title status type' },
];

export interface TaskActor {
  id: string;
  role: UserRole;
}

export interface TaskUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

export interface PublicTaskSubtask {
  title: string;
  done: boolean;
}

export interface PublicTaskTimeLog {
  user: TaskUserSummary;
  hours: number;
  note: string;
  date: Date;
}

export interface PublicTaskClientReview {
  status: TaskClientReviewStatus;
  note: string;
  by: TaskUserSummary | null;
  at: Date | null;
}

export interface PublicTaskRequirement {
  id: string;
  title: string;
  status: RequirementStatus;
}

export interface PublicTaskIssue {
  id: string;
  title: string;
  status: IssueStatus;
  type: IssueType;
}

export interface PublicTask {
  id: string;
  projectId: string;
  projectTitle: string;
  requirement: PublicTaskRequirement | null;
  linkedIssue: PublicTaskIssue | null;
  title: string;
  description: string;
  assignee: TaskUserSummary | null;
  reporter: TaskUserSummary | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimateHours: number;
  loggedHours: number;
  dueDate: Date | null;
  labels: string[];
  order: number;
  subtasks: PublicTaskSubtask[];
  timeLogs: PublicTaskTimeLog[];
  clientReview: PublicTaskClientReview;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskListResult {
  data: PublicTask[];
  total: number;
  page: number;
  limit: number;
}

export interface RequirementTaskProgress {
  requirementId: string;
  total: number;
  completed: number;
  percent: number;
  byStatus: Record<TaskStatus, number>;
  totalEstimateHours: number;
  loggedHours: number;
  overdue: number;
  tasks: PublicTask[];
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

interface PopulatedRequirementShape {
  _id: Types.ObjectId;
  title: string;
  status: RequirementStatus;
}

interface PopulatedIssueShape {
  _id: Types.ObjectId;
  title: string;
  status: IssueStatus;
  type: IssueType;
}

interface PopulatedTaskShape {
  id: string;
  project: Types.ObjectId | PopulatedProjectShape;
  requirement: Types.ObjectId | PopulatedRequirementShape | null;
  linkedIssue?: Types.ObjectId | PopulatedIssueShape | null;
  title: string;
  description: string;
  assignee: PopulatedUserShape | null;
  reporter: PopulatedUserShape | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimateHours: number;
  dueDate: Date | null;
  labels: string[];
  order: number;
  subtasks: TaskSubtaskAttributes[];
  timeLogs: Array<{
    user: PopulatedUserShape;
    hours: number;
    note: string;
    date: Date;
  }>;
  clientReview: {
    status: TaskClientReviewStatus;
    note: string;
    by: PopulatedUserShape | null;
    at: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUserSummary(user: PopulatedUserShape | null): TaskUserSummary | null {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

function toPublicTask(task: TaskDocument): PublicTask {
  const populated = task as unknown as PopulatedTaskShape;
  const project = populated.project;
  const projectId =
    project instanceof Types.ObjectId ? project.toString() : project._id.toString();
  const projectTitle = project instanceof Types.ObjectId ? '' : project.title;
  const requirement = populated.requirement;
  const requirementLink =
    requirement !== null && !(requirement instanceof Types.ObjectId)
      ? {
          id: requirement._id.toString(),
          title: requirement.title,
          status: requirement.status,
        }
      : null;
  const linkedIssue = populated.linkedIssue;
  const issueLink =
    linkedIssue && !(linkedIssue instanceof Types.ObjectId)
      ? {
          id: linkedIssue._id.toString(),
          title: linkedIssue.title,
          status: linkedIssue.status,
          type: linkedIssue.type,
        }
      : null;

  return {
    id: populated.id,
    projectId,
    projectTitle,
    requirement: requirementLink,
    linkedIssue: issueLink,
    title: populated.title,
    description: populated.description,
    assignee: toUserSummary(populated.assignee),
    reporter: toUserSummary(populated.reporter),
    status: populated.status,
    priority: populated.priority,
    estimateHours: populated.estimateHours,
    loggedHours: populated.timeLogs.reduce((total, log) => total + log.hours, 0),
    dueDate: populated.dueDate,
    labels: populated.labels,
    order: populated.order,
    subtasks: populated.subtasks.map((subtask) => ({
      title: subtask.title,
      done: subtask.done,
    })),
    timeLogs: populated.timeLogs.map((log) => ({
      user: toUserSummary(log.user) as TaskUserSummary,
      hours: log.hours,
      note: log.note,
      date: log.date,
    })),
    clientReview: {
      status: populated.clientReview.status,
      note: populated.clientReview.note,
      by: toUserSummary(populated.clientReview.by),
      at: populated.clientReview.at,
    },
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
  };
}

function normalizeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();

  return labels
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .filter((label) => {
      const key = label.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeSubtasks(
  subtasks: readonly { title: string; done: boolean }[],
): TaskSubtaskAttributes[] {
  return subtasks.map((subtask) => ({
    title: subtask.title.trim(),
    done: subtask.done,
  }));
}

export function assertCanCreateTask(actor: TaskActor): void {
  if (actor.role !== 'admin' && actor.role !== 'pm') {
    throw new ApiError(403, 'Only a project manager or admin can create tasks');
  }
}

export function assertCanDeleteTask(actor: TaskActor): void {
  if (actor.role !== 'admin' && actor.role !== 'pm') {
    throw new ApiError(403, 'Only a project manager or admin can delete tasks');
  }
}

export function assertCanUpdateTask(
  task: Pick<TaskAttributes, 'assignee'>,
  actor: TaskActor,
): void {
  if (actor.role === 'client') {
    throw new ApiError(403, 'Clients cannot edit tasks');
  }

  if (actor.role === 'admin' || actor.role === 'pm') {
    return;
  }

  if (
    actor.role === 'developer' &&
    task.assignee !== null &&
    task.assignee.toString() === actor.id
  ) {
    return;
  }

  throw new ApiError(403, 'You can only update tasks assigned to you');
}

function assertCanManageAssignment(actor: TaskActor): void {
  if (actor.role !== 'admin' && actor.role !== 'pm') {
    throw new ApiError(403, 'Only a project manager or admin can assign tasks');
  }
}

function assertCanReviewAsClient(project: ProjectDocument, actor: TaskActor): void {
  if (actor.role !== 'client') {
    throw new ApiError(403, 'Only the client can review a task');
  }

  if (project.client.toString() !== actor.id) {
    throw new ApiError(403, 'Only the client owner can review tasks');
  }
}

async function requireActiveProjectMember(
  project: ProjectDocument,
  userId: string,
): Promise<void> {
  const isMember = project.members.some((member) => member.user.toString() === userId);

  if (!isMember) {
    throw new ApiError(400, 'The assignee must be a member of this project');
  }

  const exists = await User.exists({
    _id: new Types.ObjectId(userId),
    isActive: true,
  });

  if (!exists) {
    throw new ApiError(400, 'The selected assignee is not available');
  }
}

async function requireRequirementInProject(
  project: ProjectDocument,
  requirementId: string,
): Promise<void> {
  const exists = await Requirement.exists({
    _id: new Types.ObjectId(requirementId),
    project: project._id,
  });

  if (!exists) {
    throw new ApiError(400, 'The linked requirement must belong to this project');
  }
}

async function notifyTaskAssignment(
  task: TaskDocument,
  actorId: string,
  assigneeId: string,
): Promise<void> {
  if (assigneeId === actorId) {
    return;
  }

  await notify([assigneeId], {
    projectId: task.project.toString(),
    type: 'task_assigned',
    message: `You were assigned to the task "${task.title}".`,
    link: `/projects/${task.project.toString()}/tasks`,
  });
}

async function notifyClientReview(
  task: TaskDocument,
  project: ProjectDocument,
  actorId: string,
  reviewStatus: 'approved' | 'changes_requested',
): Promise<void> {
  const recipients = new Set<string>();

  if (task.assignee) {
    recipients.add(task.assignee.toString());
  }

  if (task.reporter) {
    recipients.add(task.reporter.toString());
  }

  for (const member of project.members) {
    if (member.role === 'pm') {
      recipients.add(member.user.toString());
    }
  }

  recipients.delete(actorId);

  const action =
    reviewStatus === 'approved' ? 'approved' : 'requested changes on';

  await notify([...recipients], {
    projectId: task.project.toString(),
    type: 'task_client_review',
    message: `The client ${action} the task "${task.title}".`,
    link: `/projects/${task.project.toString()}/tasks`,
  });
}

async function findPopulatedTask(taskId: string): Promise<TaskDocument> {
  const task = await Task.findById(taskId).populate(TASK_POPULATE);

  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  return task;
}

async function nextOrder(
  projectId: Types.ObjectId,
  status: TaskStatus,
  session: ClientSession | null = null,
): Promise<number> {
  const query = Task.findOne({ project: projectId, status })
    .sort({ order: -1 })
    .select('order');

  if (session) {
    query.session(session);
  }

  const lastTask = await query;
  return (lastTask?.order ?? -1) + 1;
}

function isTransactionUnsupported(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);

  return (
    code === 20 ||
    /transaction numbers are only allowed on a replica set member or mongos/i.test(message) ||
    /transactions are not supported/i.test(message)
  );
}

/**
 * Runs the ordering update in a transaction when the deployment supports it.
 * Standalone development and in-memory test databases fall back to the same
 * ordered write path without a session.
 */
async function runAtomically<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await Task.startSession();

  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // The transaction may not have started on a standalone deployment.
    }

    if (isTransactionUnsupported(error)) {
      return work(null);
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

async function applyTaskMove(
  taskId: Types.ObjectId,
  projectId: Types.ObjectId,
  fromStatus: TaskStatus,
  targetStatus: TaskStatus,
  targetOrder: number,
  session: ClientSession | null,
): Promise<void> {
  const sourceQuery = Task.find({ project: projectId, status: fromStatus }).sort({
    order: 1,
    createdAt: 1,
  });

  if (session) {
    sourceQuery.session(session);
  }

  const sourceTasks = await sourceQuery;
  const movedTask = sourceTasks.find((task) => task._id.equals(taskId));

  if (!movedTask) {
    throw new ApiError(404, 'Task not found in its current column');
  }

  const sourceWithoutMoved = sourceTasks.filter((task) => !task._id.equals(taskId));
  let targetOrdered: TaskDocument[];

  if (targetStatus === fromStatus) {
    targetOrdered = [...sourceWithoutMoved];
  } else {
    const targetQuery = Task.find({ project: projectId, status: targetStatus }).sort({
      order: 1,
      createdAt: 1,
    });

    if (session) {
      targetQuery.session(session);
    }

    targetOrdered = await targetQuery;
  }

  const insertAt = Math.max(0, Math.min(targetOrder, targetOrdered.length));
  targetOrdered.splice(insertAt, 0, movedTask);

  const operations: Array<{
    updateOne: {
      filter: { _id: Types.ObjectId };
      update: { $set: Record<string, unknown> };
    };
  }> = [];
  const now = new Date();

  if (targetStatus !== fromStatus) {
    sourceWithoutMoved.forEach((task, index) => {
      operations.push({
        updateOne: {
          filter: { _id: task._id },
          update: { $set: { order: index, updatedAt: now } },
        },
      });
    });
  }

  targetOrdered.forEach((task, index) => {
    const set: Record<string, unknown> = { order: index, updatedAt: now };

    if (task._id.equals(taskId)) {
      set.status = targetStatus;
    }

    operations.push({
      updateOne: {
        filter: { _id: task._id },
        update: { $set: set },
      },
    });
  });

  if (operations.length > 0) {
    await Task.bulkWrite(operations, session ? { session } : {});
  }
}

function buildTaskListFilter(
  query: ListTasksQuery | ListAllTasksQuery,
): QueryFilter<TaskAttributes> {
  const filter: QueryFilter<TaskAttributes> = {};

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  if (query.assignee) {
    filter.assignee = new Types.ObjectId(query.assignee);
  }

  if (query.label) {
    filter.labels = query.label;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.requirementId) {
    filter.requirement = new Types.ObjectId(query.requirementId);
  }

  if (query.dueFrom || query.dueTo) {
    const dueRange: { $gte?: Date; $lte?: Date } = {};

    if (query.dueFrom) {
      dueRange.$gte = query.dueFrom;
    }

    if (query.dueTo) {
      const endOfDay = new Date(query.dueTo);
      endOfDay.setHours(23, 59, 59, 999);
      dueRange.$lte = endOfDay;
    }

    filter.dueDate = dueRange;
  }

  return filter;
}

async function runTaskList(
  filter: QueryFilter<TaskAttributes>,
  query: ListTasksQuery,
): Promise<TaskListResult> {
  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate(TASK_POPULATE)
      .sort({ [query.sortBy]: direction, createdAt: 1 })
      .skip(skip)
      .limit(query.limit),
    Task.countDocuments(filter),
  ]);

  return {
    data: tasks.map(toPublicTask),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function listProjectTasks(
  projectId: string,
  query: ListTasksQuery,
): Promise<TaskListResult> {
  const filter = buildTaskListFilter(query);
  filter.project = new Types.ObjectId(projectId);
  return runTaskList(filter, query);
}

export async function listAllTasks(
  actor: TaskActor,
  query: ListAllTasksQuery,
): Promise<TaskListResult> {
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

  const filter = buildTaskListFilter(query);
  filter.project = { $in: visibleProjects.map((project) => project._id) };
  return runTaskList(filter, query);
}

export async function getTask(taskId: string): Promise<PublicTask> {
  const task = await findPopulatedTask(taskId);
  return toPublicTask(task);
}

export async function createTask(
  project: ProjectDocument,
  actor: TaskActor,
  input: CreateTaskInput,
): Promise<PublicTask> {
  assertCanCreateTask(actor);

  if (input.assigneeId) {
    await requireActiveProjectMember(project, input.assigneeId);
  }

  if (input.requirementId) {
    await requireRequirementInProject(project, input.requirementId);
  }

  const order = await nextOrder(project._id, 'todo');
  const task = await Task.create({
    project: project._id,
    requirement: input.requirementId ? new Types.ObjectId(input.requirementId) : null,
    title: input.title,
    description: input.description,
    assignee: input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
    reporter: new Types.ObjectId(actor.id),
    status: 'todo',
    priority: input.priority,
    estimateHours: input.estimateHours,
    dueDate: input.dueDate ?? null,
    labels: normalizeLabels(input.labels),
    order,
    subtasks: normalizeSubtasks(input.subtasks),
    timeLogs: [],
    clientReview: {
      status: 'pending',
      note: '',
      by: null,
      at: null,
    },
  });

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'task_created',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      title: task.title,
      status: task.status,
    },
  });

  if (input.assigneeId) {
    await notifyTaskAssignment(task, actor.id, input.assigneeId);
  }

  await refreshHealthSafely(project._id);

  return getTask(task.id);
}

export interface CreateTaskFromIssueInput {
  issueId: string;
  title: string;
  description: string;
  type: IssueType;
  priority: TaskPriority;
  assigneeId: string | null;
}

/** Creates the delivery task produced when a stakeholder converts an issue. */
export async function createTaskFromIssue(
  project: ProjectDocument,
  actor: TaskActor,
  input: CreateTaskFromIssueInput,
): Promise<PublicTask> {
  assertCanCreateTask(actor);

  if (input.assigneeId) {
    await requireActiveProjectMember(project, input.assigneeId);
  }

  const order = await nextOrder(project._id, 'todo');
  const task = await Task.create({
    project: project._id,
    requirement: null,
    linkedIssue: new Types.ObjectId(input.issueId),
    title: input.title,
    description: input.description,
    assignee: input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
    reporter: new Types.ObjectId(actor.id),
    status: 'todo',
    priority: input.priority,
    estimateHours: 0,
    dueDate: null,
    labels: normalizeLabels(['issue', input.type]),
    order,
    subtasks: [],
    timeLogs: [],
    clientReview: {
      status: 'pending',
      note: '',
      by: null,
      at: null,
    },
  });

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'task_created',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      issueId: input.issueId,
      title: task.title,
    },
  });

  if (input.assigneeId) {
    await notifyTaskAssignment(task, actor.id, input.assigneeId);
  }

  await refreshHealthSafely(project._id);

  return getTask(task.id);
}

export async function updateTask(
  task: TaskDocument,
  project: ProjectDocument,
  actor: TaskActor,
  input: UpdateTaskInput,
): Promise<PublicTask> {
  assertCanUpdateTask(task, actor);

  if (actor.role !== 'admin' && actor.role !== 'pm') {
    if (input.assigneeId !== undefined) {
      throw new ApiError(403, 'Only a project manager or admin can assign tasks');
    }

    if (input.requirementId !== undefined) {
      throw new ApiError(403, 'Only a project manager or admin can link requirements');
    }
  }

  if (input.assigneeId !== undefined) {
    assertCanManageAssignment(actor);

    if (input.assigneeId) {
      await requireActiveProjectMember(project, input.assigneeId);
    }
  }

  if (input.requirementId) {
    await requireRequirementInProject(project, input.requirementId);
  }

  const previousStatus = task.status;
  const previousAssignee = task.assignee?.toString() ?? null;

  if (input.title !== undefined) {
    task.title = input.title;
  }

  if (input.description !== undefined) {
    task.description = input.description;
  }

  if (input.assigneeId !== undefined) {
    task.assignee = input.assigneeId ? new Types.ObjectId(input.assigneeId) : null;
  }

  if (input.requirementId !== undefined) {
    task.requirement = input.requirementId
      ? new Types.ObjectId(input.requirementId)
      : null;
  }

  if (input.priority !== undefined) {
    task.priority = input.priority;
  }

  if (input.estimateHours !== undefined) {
    task.estimateHours = input.estimateHours;
  }

  if (input.dueDate !== undefined) {
    task.dueDate = input.dueDate;
  }

  if (input.labels !== undefined) {
    task.labels = normalizeLabels(input.labels);
  }

  await task.save();

  await logActivity({
    projectId: task.project,
    actorId: actor.id,
    action: 'task_updated',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      title: task.title,
      fields: Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([field]) => field),
    },
  });

  if (
    input.assigneeId &&
    input.assigneeId !== previousAssignee
  ) {
    await notifyTaskAssignment(task, actor.id, input.assigneeId);
  }

  if (input.status !== undefined && input.status !== previousStatus) {
    const targetOrder = await nextOrder(task.project, input.status);

    return moveTask(task, project, actor, {
      status: input.status,
      order: targetOrder,
    });
  }

  await refreshHealthSafely(task.project);

  return getTask(task.id);
}

export async function moveTask(
  task: TaskDocument,
  _project: ProjectDocument,
  actor: TaskActor,
  input: MoveTaskInput,
): Promise<PublicTask> {
  assertCanUpdateTask(task, actor);

  const fromStatus = task.status;

  await runAtomically((session) =>
    applyTaskMove(
      task._id,
      task.project,
      fromStatus,
      input.status,
      input.order,
      session,
    ),
  );

  await logActivity({
    projectId: task.project,
    actorId: actor.id,
    action: 'task_status_changed',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      title: task.title,
      from: fromStatus,
      to: input.status,
      order: input.order,
    },
  });

  await refreshHealthSafely(task.project);

  return getTask(task.id);
}

export async function deleteTask(
  task: TaskDocument,
  actor: TaskActor,
): Promise<void> {
  assertCanDeleteTask(actor);

  const taskId = task._id;
  const projectId = task.project;
  const status = task.status;
  const title = task.title;

  await runAtomically(async (session) => {
    const deleteQuery = Task.deleteOne({ _id: taskId });

    if (session) {
      deleteQuery.session(session);
    }

    await deleteQuery;

    const siblingsQuery = Task.find({ project: projectId, status }).sort({
      order: 1,
      createdAt: 1,
    });

    if (session) {
      siblingsQuery.session(session);
    }

    const siblings = await siblingsQuery;
    const now = new Date();
    const operations = siblings.map((sibling, index) => ({
      updateOne: {
        filter: { _id: sibling._id },
        update: { $set: { order: index, updatedAt: now } },
      },
    }));

    if (operations.length > 0) {
      await Task.bulkWrite(operations, session ? { session } : {});
    }
  });

  await logActivity({
    projectId,
    actorId: actor.id,
    action: 'task_deleted',
    entityType: 'task',
    entityId: taskId,
    meta: { taskId: taskId.toString(), title, status },
  });

  await refreshHealthSafely(projectId);
}

export async function addTimeLog(
  task: TaskDocument,
  actor: TaskActor,
  input: AddTimeLogInput,
): Promise<PublicTask> {
  assertCanUpdateTask(task, actor);

  task.timeLogs.push({
    user: new Types.ObjectId(actor.id),
    hours: input.hours,
    note: input.note,
    date: input.date ?? new Date(),
  });

  await task.save();

  await logActivity({
    projectId: task.project,
    actorId: actor.id,
    action: 'task_time_logged',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      title: task.title,
      hours: input.hours,
      note: input.note,
    },
  });

  await refreshHealthSafely(task.project);

  return getTask(task.id);
}

export async function updateSubtasks(
  task: TaskDocument,
  actor: TaskActor,
  input: UpdateSubtasksInput,
): Promise<PublicTask> {
  assertCanUpdateTask(task, actor);

  task.subtasks = normalizeSubtasks(input.subtasks);
  await task.save();

  await logActivity({
    projectId: task.project,
    actorId: actor.id,
    action: 'task_subtasks_updated',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      title: task.title,
      total: task.subtasks.length,
      completed: task.subtasks.filter((subtask) => subtask.done).length,
    },
  });

  return getTask(task.id);
}

export async function reviewTaskAsClient(
  task: TaskDocument,
  project: ProjectDocument,
  actor: TaskActor,
  input: ClientReviewInput,
): Promise<PublicTask> {
  assertCanReviewAsClient(project, actor);

  if (task.status !== 'in_review') {
    throw new ApiError(400, 'Only tasks in review can be accepted or returned');
  }

  const targetStatus: TaskStatus =
    input.status === 'approved' ? 'done' : 'in_progress';

  await runAtomically(async (session) => {
    const currentQuery = Task.findById(task._id);

    if (session) {
      currentQuery.session(session);
    }

    const current = await currentQuery;

    if (!current) {
      throw new ApiError(404, 'Task not found');
    }

    if (current.status !== 'in_review') {
      throw new ApiError(400, 'Only tasks in review can be accepted or returned');
    }

    current.clientReview = {
      status: input.status,
      note: input.note,
      by: new Types.ObjectId(actor.id),
      at: new Date(),
    };

    await current.save({ session: session ?? undefined });

    const targetOrder = await nextOrder(current.project, targetStatus, session);
    await applyTaskMove(
      current._id,
      current.project,
      current.status,
      targetStatus,
      targetOrder,
      session,
    );
  });

  await logActivity({
    projectId: task.project,
    actorId: actor.id,
    action: 'task_client_reviewed',
    entityType: 'task',
    entityId: task._id,
    meta: {
      taskId: task.id,
      title: task.title,
      reviewStatus: input.status,
      note: input.note,
      from: 'in_review',
      to: targetStatus,
    },
  });

  await notifyClientReview(task, project, actor.id, input.status);

  return getTask(task.id);
}

export async function getRequirementProgress(
  requirement: RequirementDocument,
): Promise<RequirementTaskProgress> {
  const tasks = await Task.find({
    project: requirement.project,
    requirement: requirement._id,
  })
    .populate(TASK_POPULATE)
    .sort({ status: 1, order: 1, createdAt: 1 });

  const publicTasks = tasks.map(toPublicTask);
  const byStatus: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    in_review: 0,
    blocked: 0,
    done: 0,
  };
  const now = Date.now();
  let totalEstimateHours = 0;
  let loggedHours = 0;
  let overdue = 0;

  for (const task of tasks) {
    byStatus[task.status] += 1;
    totalEstimateHours += task.estimateHours;
    loggedHours += task.timeLogs.reduce((total, log) => total + log.hours, 0);

    if (task.dueDate && task.status !== 'done' && task.dueDate.getTime() < now) {
      overdue += 1;
    }
  }

  const total = tasks.length;

  return {
    requirementId: requirement.id,
    total,
    completed: byStatus.done,
    percent: total === 0 ? 0 : Math.round((byStatus.done / total) * 100),
    byStatus,
    totalEstimateHours,
    loggedHours,
    overdue,
    tasks: publicTasks,
  };
}
