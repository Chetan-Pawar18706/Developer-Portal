import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { ActivityLog } from '../models/activityLog.model';
import { File } from '../models/file.model';
import { ISSUE_SEVERITIES, ISSUE_STATUSES, Issue } from '../models/issue.model';
import { Project } from '../models/project.model';
import { Requirement, type RequirementStatus } from '../models/requirement.model';
import { TASK_STATUSES, Task, type TaskAttributes } from '../models/task.model';
import { User, type UserRole } from '../models/user.model';
import { buildProjectVisibilityFilter } from './project.service';

export interface DashboardActor {
  id: string;
  role: UserRole;
}

export interface CountItem {
  key: string;
  count: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  meta: Record<string, unknown>;
  createdAt: Date;
}

export interface DeadlineItem {
  id: string;
  title: string;
  dueDate: Date;
  status: string;
  assignee: string | null;
}

export interface OverdueTaskItem {
  id: string;
  title: string;
  dueDate: Date;
  status: string;
  assignee: string | null;
}

export interface WorkloadItem {
  developerId: string;
  developerName: string;
  openTasks: number;
  estimatedHours: number;
  loggedHours: number;
}

export interface BurnDownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface ProjectDashboard {
  projectId: string;
  generatedAt: Date;
  health: string;
  tasks: {
    total: number;
    byStatus: CountItem[];
    completionPercent: number;
    overdue: number;
    hoursLogged: number;
    hoursEstimated: number;
  };
  issues: {
    openBySeverity: CountItem[];
  };
  deadlines: DeadlineItem[];
  pendingApprovals: {
    total: number;
    requirements: number;
    tasks: number;
  };
  activities: ActivityItem[];
}

export interface PmDashboard {
  projectId: string;
  generatedAt: Date;
  workload: WorkloadItem[];
  burnDown: BurnDownPoint[];
  overdueTasks: OverdueTaskItem[];
  issueAging: CountItem[];
}

export interface AdminProjectRow {
  id: string;
  title: string;
  status: string;
  health: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  openIssues: number;
  completionPercent: number;
}

export interface AdminDashboard {
  role: 'admin';
  generatedAt: Date;
  totals: {
    projects: number;
    tasks: number;
    issues: number;
    requirements: number;
    files: number;
    activeUsers: number;
  };
  projects: AdminProjectRow[];
}

export interface MeDashboard {
  role: UserRole;
  generatedAt: Date;
  projects: AdminProjectRow[];
  metrics: {
    visibleProjects: number;
    openTasks: number;
    overdueTasks: number;
    openIssues: number;
    pendingApprovals: number;
  };
}

interface StatusAggregate {
  _id: string;
  count: number;
}

interface HoursAggregate {
  _id: null;
  estimated: number;
  logged: number;
}

interface WorkloadAggregate {
  _id: Types.ObjectId | null;
  openTasks: number;
  estimated: number;
  logged: number;
}

interface AgingAggregate {
  _id: number;
  count: number;
}

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  avatar: string | null;
}

interface PopulatedActivityActor {
  actor: Types.ObjectId | PopulatedUser;
}

interface PopulatedAssignment {
  assignee: Types.ObjectId | PopulatedUser | null;
}

interface BurnDownTask {
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectAggregateRow {
  _id: Types.ObjectId;
  title: string;
  status: string;
  health: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  openIssues: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_ISSUE_STATUSES = ISSUE_STATUSES.filter(
  (status) => status !== 'resolved' && status !== 'closed',
);
const PENDING_REQUIREMENT_STATUSES: RequirementStatus[] = ['submitted', 'under_review'];

function isPopulatedUser(value: Types.ObjectId | PopulatedUser | null): value is PopulatedUser {
  return value !== null && !(value instanceof Types.ObjectId);
}

function userName(value: Types.ObjectId | PopulatedUser | null): string | null {
  return isPopulatedUser(value) ? value.name : null;
}

function countFor(rows: readonly StatusAggregate[], key: string): number {
  return rows.find((row) => row._id === key)?.count ?? 0;
}

function toCountItems(
  rows: readonly StatusAggregate[],
  keys: readonly string[],
): CountItem[] {
  return keys.map((key) => ({ key, count: countFor(rows, key) }));
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function statusRows(
  model: typeof Task | typeof Issue,
  match: Record<string, unknown>,
  field: string,
): Promise<StatusAggregate[]> {
  return model.aggregate<StatusAggregate>([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
}

async function taskHours(projectId: Types.ObjectId): Promise<HoursAggregate> {
  const rows = await Task.aggregate<HoursAggregate>([
    { $match: { project: projectId } },
    {
      $project: {
        estimateHours: 1,
        loggedHours: {
          $sum: {
            $map: {
              input: { $ifNull: ['$timeLogs', []] },
              as: 'log',
              in: '$$log.hours',
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        estimated: { $sum: '$estimateHours' },
        logged: { $sum: '$loggedHours' },
      },
    },
  ]);

  return rows[0] ?? { _id: null, estimated: 0, logged: 0 };
}

async function projectAggregateRows(
  projectIds: readonly Types.ObjectId[],
  now: Date,
): Promise<ProjectAggregateRow[]> {
  if (projectIds.length === 0) {
    return [];
  }

  return Project.aggregate<ProjectAggregateRow>([
    { $match: { _id: { $in: projectIds } } },
    {
      $lookup: {
        from: 'tasks',
        localField: '_id',
        foreignField: 'project',
        as: 'tasks',
      },
    },
    {
      $lookup: {
        from: 'issues',
        localField: '_id',
        foreignField: 'project',
        as: 'issues',
      },
    },
    {
      $project: {
        title: 1,
        status: 1,
        health: 1,
        totalTasks: { $size: '$tasks' },
        doneTasks: {
          $size: {
            $filter: { input: '$tasks', as: 'task', cond: { $eq: ['$$task.status', 'done'] } },
          },
        },
        overdueTasks: {
          $size: {
            $filter: {
              input: '$tasks',
              as: 'task',
              cond: {
                $and: [
                  { $ne: ['$$task.status', 'done'] },
                  { $ne: ['$$task.dueDate', null] },
                  { $lt: ['$$task.dueDate', now] },
                ],
              },
            },
          },
        },
        openIssues: {
          $size: {
            $filter: {
              input: '$issues',
              as: 'issue',
              cond: { $in: ['$$issue.status', OPEN_ISSUE_STATUSES] },
            },
          },
        },
      },
    },
    { $sort: { title: 1 } },
  ]);
}

function toAdminProjectRow(row: ProjectAggregateRow): AdminProjectRow {
  return {
    id: row._id.toString(),
    title: row.title,
    status: row.status,
    health: row.health,
    totalTasks: row.totalTasks,
    doneTasks: row.doneTasks,
    overdueTasks: row.overdueTasks,
    openIssues: row.openIssues,
    completionPercent:
      row.totalTasks === 0 ? 0 : Math.round((row.doneTasks / row.totalTasks) * 100),
  };
}

export async function getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
  const objectId = new Types.ObjectId(projectId);
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * DAY_MS);

  const project = await Project.findById(objectId).select('health');

  if (!project) {
    throw new Error('Project not found');
  }

  const [statusCounts, issueCounts, hours, overdueTasks, pendingRequirements, pendingTasks] =
    await Promise.all([
      statusRows(Task, { project: objectId }, 'status'),
      statusRows(Issue, { project: objectId, status: { $in: OPEN_ISSUE_STATUSES } }, 'severity'),
      taskHours(objectId),
      countOverdueTasks(objectId, now),
      Requirement.countDocuments({
        project: objectId,
        status: { $in: PENDING_REQUIREMENT_STATUSES },
      }),
      Task.countDocuments({
        project: objectId,
        status: 'in_review',
        'clientReview.status': 'pending',
      }),
    ]);

  const [deadlineTasks, activities] = await Promise.all([
    Task.find({
      project: objectId,
      status: { $ne: 'done' },
      dueDate: { $ne: null, $gte: now, $lte: soon },
    })
      .populate('assignee', 'name')
      .sort({ dueDate: 1 })
      .limit(10),
    ActivityLog.find({ project: objectId })
      .populate('actor', 'name email avatar')
      .sort({ createdAt: -1, _id: -1 })
      .limit(10),
  ]);

  const totalTasks = TASK_STATUSES.reduce((sum, status) => sum + countFor(statusCounts, status), 0);
  const doneTasks = countFor(statusCounts, 'done');

  return {
    projectId,
    generatedAt: now,
    health: project.health,
    tasks: {
      total: totalTasks,
      byStatus: toCountItems(statusCounts, TASK_STATUSES),
      completionPercent: totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100),
      overdue: overdueTasks,
      hoursLogged: hours.logged,
      hoursEstimated: hours.estimated,
    },
    issues: {
      openBySeverity: toCountItems(issueCounts, ISSUE_SEVERITIES),
    },
    deadlines: deadlineTasks.map((task) => {
      const populated = task as unknown as PopulatedAssignment;
      return {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate as Date,
        status: task.status,
        assignee: userName(populated.assignee),
      };
    }),
    pendingApprovals: {
      total: pendingRequirements + pendingTasks,
      requirements: pendingRequirements,
      tasks: pendingTasks,
    },
    activities: activities.map((activity) => {
      const populated = activity as unknown as PopulatedActivityActor;
      const actor = populated.actor;

      return {
        id: activity.id,
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId ? activity.entityId.toString() : null,
        actor: {
          id: isPopulatedUser(actor) ? actor._id.toString() : actor.toString(),
          name: isPopulatedUser(actor) ? actor.name : 'Unknown user',
          email: isPopulatedUser(actor) ? actor.email : '',
          avatar: isPopulatedUser(actor) ? actor.avatar : null,
        },
        meta: activity.meta,
        createdAt: activity.createdAt,
      };
    }),
  };
}

/** Overdue is counted from live task documents because it depends on the current date. */
async function countOverdueTasks(projectId: Types.ObjectId, now = new Date()): Promise<number> {
  return Task.countDocuments({
    project: projectId,
    status: { $ne: 'done' },
    dueDate: { $ne: null, $lt: now },
  });
}

export async function getProjectPmDashboard(projectId: string): Promise<PmDashboard> {
  const objectId = new Types.ObjectId(projectId);
  const now = new Date();

  const [workloadRows, overdueTasks, agingRows, burnDownTasks] = await Promise.all([
    Task.aggregate<WorkloadAggregate>([
      { $match: { project: objectId, status: { $ne: 'done' } } },
      {
        $group: {
          _id: '$assignee',
          openTasks: { $sum: 1 },
          estimated: { $sum: '$estimateHours' },
          logged: {
            $sum: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$timeLogs', []] },
                  as: 'log',
                  in: '$$log.hours',
                },
              },
            },
          },
        },
      },
      { $sort: { openTasks: -1 } },
    ]),
    Task.find({
      project: objectId,
      status: { $ne: 'done' },
      dueDate: { $ne: null, $lt: now },
    })
      .populate('assignee', 'name')
      .sort({ dueDate: 1 })
      .limit(10),
    Issue.aggregate<AgingAggregate>([
      { $match: { project: objectId, status: { $in: OPEN_ISSUE_STATUSES } } },
      {
        $group: {
          _id: {
            $floor: { $divide: [{ $subtract: [now, '$createdAt'] }, DAY_MS] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Task.find({ project: objectId, createdAt: { $lte: now } })
      .select('status createdAt updatedAt')
      .lean<BurnDownTask[]>(),
  ]);

  const developerIds = workloadRows
    .map((row) => row._id)
    .filter((id): id is Types.ObjectId => id !== null);
  const developers = developerIds.length > 0
    ? await User.find({ _id: { $in: developerIds } }).select('name')
    : [];
  const developerNames = new Map(developers.map((user) => [user.id, user.name]));

  const workload: WorkloadItem[] = workloadRows.map((row) => ({
    developerId: row._id ? row._id.toString() : '',
    developerName: row._id ? developerNames.get(row._id.toString()) ?? 'Unknown user' : 'Unassigned',
    openTasks: row.openTasks,
    estimatedHours: row.estimated,
    loggedHours: row.logged,
  }));

  const agingKeys = ['0-3', '4-7', '8-14', '15+'];
  const issueAging: CountItem[] = agingKeys.map((key, index) => {
    const isLast = index === agingKeys.length - 1;
    const count = agingRows
      .filter((row) => (isLast ? row._id >= 15 : row._id >= [0, 4, 8][index] && row._id < [4, 8, 15][index]))
      .reduce((sum, row) => sum + row.count, 0);
    return { key, count };
  });

  return {
    projectId,
    generatedAt: now,
    workload,
    burnDown: buildBurnDown(burnDownTasks, now),
    overdueTasks: overdueTasks.map((task) => {
      const populated = task as unknown as PopulatedAssignment;
      return {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate as Date,
        status: task.status,
        assignee: userName(populated.assignee),
      };
    }),
    issueAging,
  };
}

function buildBurnDown(tasks: readonly BurnDownTask[], now: Date): BurnDownPoint[] {
  const points: BurnDownPoint[] = [];
  const rangeStart = startOfDay(new Date(now.getTime() - 13 * DAY_MS));
  const total = tasks.length;

  for (let index = 0; index < 14; index += 1) {
    const dayEnd = new Date(rangeStart.getTime() + index * DAY_MS + DAY_MS - 1);
    const remaining = tasks.filter((task) => {
      const completedAt = task.status === 'done' ? task.updatedAt : null;
      return task.createdAt <= dayEnd && (completedAt === null || completedAt > dayEnd);
    }).length;

    points.push({
      date: toDayKey(new Date(rangeStart.getTime() + index * DAY_MS)),
      remaining,
      ideal: Math.max(0, Math.round(total * (1 - index / 13))),
    });
  }

  return points;
}

export async function getAdminDashboard(actor: DashboardActor): Promise<AdminDashboard> {
  const now = new Date();
  const projects = await Project.find(buildProjectVisibilityFilter(actor)).select('_id');
  const projectIds = projects.map((project) => project._id);

  const [rows, activeUsers, tasks, issues, requirements, files] = await Promise.all([
    projectAggregateRows(projectIds, now),
    User.countDocuments({ isActive: true }),
    Task.countDocuments({ project: { $in: projectIds } }),
    Issue.countDocuments({ project: { $in: projectIds } }),
    Requirement.countDocuments({ project: { $in: projectIds } }),
    File.countDocuments({ project: { $in: projectIds } }),
  ]);

  return {
    role: 'admin',
    generatedAt: now,
    totals: {
      projects: projectIds.length,
      tasks,
      issues,
      requirements,
      files,
      activeUsers,
    },
    projects: rows.map(toAdminProjectRow),
  };
}

export async function getMeDashboard(actor: DashboardActor): Promise<MeDashboard> {
  const now = new Date();
  const projects = await Project.find(buildProjectVisibilityFilter(actor)).select('_id');
  const projectIds = projects.map((project) => project._id);
  const taskFilter: QueryFilter<TaskAttributes> = {
    project: { $in: projectIds },
    status: { $ne: 'done' },
  };

  if (actor.role === 'developer') {
    taskFilter.assignee = new Types.ObjectId(actor.id);
  }

  const overdueTaskFilter: QueryFilter<TaskAttributes> = {
    ...taskFilter,
    dueDate: { $ne: null, $lt: now },
  };

  const [rows, openTasks, overdueTasks, openIssues, pendingRequirements, pendingTasks] =
    await Promise.all([
      projectAggregateRows(projectIds, now),
      Task.countDocuments(taskFilter),
      Task.countDocuments(overdueTaskFilter),
      Issue.countDocuments({
        project: { $in: projectIds },
        status: { $in: OPEN_ISSUE_STATUSES },
      }),
      Requirement.countDocuments({
        project: { $in: projectIds },
        status: { $in: PENDING_REQUIREMENT_STATUSES },
      }),
      Task.countDocuments({
        project: { $in: projectIds },
        status: 'in_review',
        'clientReview.status': 'pending',
      }),
    ]);

  return {
    role: actor.role,
    generatedAt: now,
    projects: rows.map(toAdminProjectRow),
    metrics: {
      visibleProjects: projectIds.length,
      openTasks,
      overdueTasks,
      openIssues,
      pendingApprovals: pendingRequirements + pendingTasks,
    },
  };
}
