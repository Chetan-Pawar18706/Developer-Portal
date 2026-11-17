import type { ProjectUserSummary } from './project.model';
import type { RequirementStatus } from './requirement.model';

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'blocked', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CLIENT_REVIEW_STATUSES = [
  'pending',
  'approved',
  'changes_requested',
] as const;
export type TaskClientReviewStatus = (typeof TASK_CLIENT_REVIEW_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  blocked: 'Blocked',
  done: 'Done',
};

export const TASK_STATUS_ICONS: Record<TaskStatus, string> = {
  todo: 'radio_button_unchecked',
  in_progress: 'autorenew',
  in_review: 'rate_review',
  blocked: 'block',
  done: 'check_circle',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const TASK_CLIENT_REVIEW_LABELS: Record<TaskClientReviewStatus, string> = {
  pending: 'Awaiting client review',
  approved: 'Approved by client',
  changes_requested: 'Changes requested',
};

export interface TaskSubtask {
  title: string;
  done: boolean;
}

export interface TaskTimeLog {
  user: ProjectUserSummary;
  hours: number;
  note: string;
  date: string;
}

export interface TaskClientReview {
  status: TaskClientReviewStatus;
  note: string;
  by: ProjectUserSummary | null;
  at: string | null;
}

export interface TaskRequirementLink {
  id: string;
  title: string;
  status: RequirementStatus;
}

export interface Task {
  id: string;
  projectId: string;
  projectTitle: string;
  requirement: TaskRequirementLink | null;
  title: string;
  description: string;
  assignee: ProjectUserSummary | null;
  reporter: ProjectUserSummary | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimateHours: number;
  loggedHours: number;
  dueDate: string | null;
  labels: string[];
  order: number;
  subtasks: TaskSubtask[];
  timeLogs: TaskTimeLog[];
  clientReview: TaskClientReview;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFilters {
  search: string;
  assignee: string;
  label: string;
  priority: TaskPriority | '';
  status: TaskStatus | '';
  dueFrom: string;
  dueTo: string;
  page: number;
  limit: number;
  sortBy: 'order' | 'createdAt' | 'updatedAt' | 'dueDate' | 'title' | 'priority' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface TaskListQuery extends Omit<
  TaskFilters,
  'priority' | 'status' | 'dueFrom' | 'dueTo'
> {
  priority?: TaskPriority;
  status?: TaskStatus;
  dueFrom?: string;
  dueTo?: string;
}

export interface GlobalTaskListQuery extends TaskListQuery {
  projectId?: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  requirementId?: string | null;
  assigneeId?: string | null;
  priority: TaskPriority;
  estimateHours: number;
  dueDate?: string | null;
  labels: string[];
  subtasks: TaskSubtask[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  requirementId?: string | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  estimateHours?: number;
  dueDate?: string | null;
  labels?: string[];
}

export interface MoveTaskRequest {
  status: TaskStatus;
  order: number;
}

export interface AddTimeLogRequest {
  hours: number;
  note: string;
  date?: string;
}

export interface UpdateSubtasksRequest {
  subtasks: TaskSubtask[];
}

export interface ClientReviewRequest {
  status: 'approved' | 'changes_requested';
  note: string;
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
  tasks: Task[];
}
