import type { FileLink } from './file.model';
import type { ProjectUserSummary } from './project.model';
import type { TaskPriority, TaskStatus } from './task.model';

export const ISSUE_TYPES = ['bug', 'question', 'change_request', 'feedback'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_STATUSES = [
  'open',
  'in_discussion',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  bug: 'Bug',
  question: 'Question',
  change_request: 'Change request',
  feedback: 'Feedback',
};

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  in_discussion: 'In discussion',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

export interface IssueAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface IssueTaskLink {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface Issue {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description: string;
  type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  stepsToReproduce: string;
  raisedBy: ProjectUserSummary;
  assignedTo: ProjectUserSummary | null;
  attachments: IssueAttachment[];
  files: FileLink[];
  linkedTask: IssueTaskLink | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueFilters {
  search: string;
  type: IssueType | '';
  severity: IssueSeverity | '';
  status: IssueStatus | '';
  assignedTo: string;
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'severity' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface IssueListQuery extends Omit<
  IssueFilters,
  'type' | 'severity' | 'status' | 'assignedTo'
> {
  type?: IssueType;
  severity?: IssueSeverity;
  status?: IssueStatus;
  assignedTo?: string;
}

export interface GlobalIssueListQuery extends IssueListQuery {
  projectId?: string;
}

export interface CreateIssueRequest {
  title: string;
  description: string;
  type: IssueType;
  severity: IssueSeverity;
  stepsToReproduce: string;
  attachments: IssueAttachment[];
  fileIds?: string[];
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  type?: IssueType;
  severity?: IssueSeverity;
  stepsToReproduce?: string;
  attachments?: IssueAttachment[];
  fileIds?: string[];
  assignedTo?: string | null;
}

export interface UpdateIssueStatusRequest {
  status: IssueStatus;
  note?: string;
}
