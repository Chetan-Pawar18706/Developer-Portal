import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import { File, type FileAttributes } from '../models/file.model';
import { Issue, ISSUE_STATUSES, type IssueAttributes } from '../models/issue.model';
import { Project } from '../models/project.model';
import {
  Requirement,
  REQUIREMENT_STATUSES,
  type RequirementAttributes,
} from '../models/requirement.model';
import { TASK_STATUSES, Task, type TaskAttributes } from '../models/task.model';
import type { UserRole } from '../models/user.model';
import type { ReportQuery } from '../routes/report.schemas';
import { buildProjectVisibilityFilter } from './project.service';

export interface ReportActor {
  id: string;
  role: UserRole;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ProjectReportRow {
  id: string;
  title: string;
  status: string;
  health: string;
  totalRequirements: number;
  totalTasks: number;
  doneTasks: number;
  totalIssues: number;
  openIssues: number;
  overdueTasks: number;
  hoursLogged: number;
  progress: number;
}

export interface PortfolioReport {
  generatedAt: Date;
  totals: {
    projects: number;
    requirements: number;
    tasks: number;
    doneTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    issues: number;
    openIssues: number;
    files: number;
    hoursLogged: number;
    completion: number;
  };
  taskStatuses: StatusCount[];
  requirementStatuses: StatusCount[];
  issueStatuses: StatusCount[];
  projects: ProjectReportRow[];
}

interface HourAggregate {
  _id: null;
  total: number;
}

const OPEN_ISSUE_STATUSES = ISSUE_STATUSES.filter(
  (status) => status !== 'resolved' && status !== 'closed',
);

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function fileFilter(
  projectIds: readonly Types.ObjectId[],
  actor: ReportActor,
): QueryFilter<FileAttributes> {
  const filter: QueryFilter<FileAttributes> = { project: { $in: projectIds } };

  if (actor.role === 'client') {
    filter.isInternal = false;
  }

  return filter;
}

async function countTaskStatuses(
  filter: QueryFilter<TaskAttributes>,
): Promise<StatusCount[]> {
  return Promise.all(
    TASK_STATUSES.map(async (status) => ({
      status,
      count: await Task.countDocuments({ ...filter, status }),
    })),
  );
}

async function countRequirementStatuses(
  filter: QueryFilter<RequirementAttributes>,
): Promise<StatusCount[]> {
  return Promise.all(
    REQUIREMENT_STATUSES.map(async (status) => ({
      status,
      count: await Requirement.countDocuments({ ...filter, status }),
    })),
  );
}

async function countIssueStatuses(
  filter: QueryFilter<IssueAttributes>,
): Promise<StatusCount[]> {
  return Promise.all(
    ISSUE_STATUSES.map(async (status) => ({
      status,
      count: await Issue.countDocuments({ ...filter, status }),
    })),
  );
}

async function sumHours(filter: QueryFilter<TaskAttributes>): Promise<number> {
  const result = await Task.aggregate<HourAggregate>([
    { $match: filter },
    { $unwind: '$timeLogs' },
    { $group: { _id: null, total: { $sum: '$timeLogs.hours' } } },
  ]);

  return result[0]?.total ?? 0;
}

async function buildProjectRow(projectId: Types.ObjectId): Promise<{
  totalRequirements: number;
  totalTasks: number;
  doneTasks: number;
  totalIssues: number;
  openIssues: number;
  overdueTasks: number;
  hoursLogged: number;
}> {
  const taskFilter: QueryFilter<TaskAttributes> = { project: projectId };
  const issueFilter: QueryFilter<IssueAttributes> = { project: projectId };

  const [
    totalRequirements,
    totalTasks,
    doneTasks,
    totalIssues,
    openIssues,
    overdueTasks,
    hoursLogged,
  ] = await Promise.all([
    Requirement.countDocuments({ project: projectId }),
    Task.countDocuments(taskFilter),
    Task.countDocuments({ ...taskFilter, status: 'done' }),
    Issue.countDocuments(issueFilter),
    Issue.countDocuments({ ...issueFilter, status: { $in: OPEN_ISSUE_STATUSES } }),
    Task.countDocuments({
      ...taskFilter,
      status: { $ne: 'done' },
      dueDate: { $lt: new Date(), $ne: null },
    }),
    sumHours(taskFilter),
  ]);

  return {
    totalRequirements,
    totalTasks,
    doneTasks,
    totalIssues,
    openIssues,
    overdueTasks,
    hoursLogged,
  };
}

export async function getPortfolioReport(
  actor: ReportActor,
  query: ReportQuery,
): Promise<PortfolioReport> {
  let projects = await Project.find(buildProjectVisibilityFilter(actor))
    .select('title status health')
    .sort({ title: 1 });

  if (query.projectId) {
    const requestedId = new Types.ObjectId(query.projectId);
    projects = projects.filter((project) => project._id.equals(requestedId));
  }

  const projectIds = projects.map((project) => project._id);
  const taskFilter: QueryFilter<TaskAttributes> = { project: { $in: projectIds } };
  const issueFilter: QueryFilter<IssueAttributes> = { project: { $in: projectIds } };

  const [
    totalRequirements,
    totalTasks,
    doneTasks,
    blockedTasks,
    overdueTasks,
    totalIssues,
    openIssues,
    totalFiles,
    hoursLogged,
    taskStatuses,
    requirementStatuses,
    issueStatuses,
  ] = await Promise.all([
    Requirement.countDocuments({ project: { $in: projectIds } }),
    Task.countDocuments(taskFilter),
    Task.countDocuments({ ...taskFilter, status: 'done' }),
    Task.countDocuments({ ...taskFilter, status: 'blocked' }),
    Task.countDocuments({
      ...taskFilter,
      status: { $ne: 'done' },
      dueDate: { $lt: new Date(), $ne: null },
    }),
    Issue.countDocuments(issueFilter),
    Issue.countDocuments({ ...issueFilter, status: { $in: OPEN_ISSUE_STATUSES } }),
    File.countDocuments(fileFilter(projectIds, actor)),
    sumHours(taskFilter),
    countTaskStatuses(taskFilter),
    countRequirementStatuses({ project: { $in: projectIds } }),
    countIssueStatuses(issueFilter),
  ]);

  const projectRows = await Promise.all(
    projects.map(async (project): Promise<ProjectReportRow> => {
      const counts = await buildProjectRow(project._id);

      return {
        id: project._id.toString(),
        title: project.title,
        status: project.status,
        health: project.health,
        ...counts,
        progress: percentage(counts.doneTasks, counts.totalTasks),
      };
    }),
  );

  return {
    generatedAt: new Date(),
    totals: {
      projects: projects.length,
      requirements: totalRequirements,
      tasks: totalTasks,
      doneTasks,
      blockedTasks,
      overdueTasks,
      issues: totalIssues,
      openIssues,
      files: totalFiles,
      hoursLogged,
      completion: percentage(doneTasks, totalTasks),
    },
    taskStatuses,
    requirementStatuses,
    issueStatuses,
    projects: projectRows,
  };
}
