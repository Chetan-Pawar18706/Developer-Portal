import type { Role } from './user.model';

export const PROJECT_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'active',
  'on_hold',
  'completed',
  'archived',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PROJECT_HEALTHS = ['on_track', 'at_risk', 'off_track'] as const;
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In review',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
};

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ['submitted'],
  submitted: ['in_review', 'active'],
  in_review: ['active'],
  active: ['on_hold', 'completed'],
  on_hold: ['active'],
  completed: ['archived'],
  archived: [],
};

export interface ProjectUserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
}

export interface ProjectMember {
  user: ProjectUserSummary;
  role: Role;
}

export interface DeliverySignOff {
  signedBy: ProjectUserSummary | null;
  signedAt: string | null;
  note: string;
  rating: number | null;
  feedback: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  client: ProjectUserSummary;
  status: ProjectStatus;
  priority: ProjectPriority;
  members: ProjectMember[];
  startDate: string | null;
  dueDate: string | null;
  tags: string[];
  budget: number;
  health: ProjectHealth;
  deliverySignOff: DeliverySignOff;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectActivity {
  id: string;
  action:
    | 'project_created'
    | 'project_updated'
    | 'project_archived'
    | 'delivery_signed_off'
    | 'status_changed'
    | 'member_added'
    | 'member_removed'
    | 'requirement_created'
    | 'requirement_updated'
    | 'requirement_status_changed'
    | 'requirement_change_requested'
    | 'comment_created'
    | 'comment_updated'
    | 'comment_deleted'
    | 'comment_reacted'
    | 'issue_created'
    | 'issue_updated'
    | 'issue_status_changed'
    | 'issue_assigned'
    | 'issue_converted_to_task';
  entityType: 'project' | 'member' | 'status' | 'requirement' | 'task' | 'comment' | 'issue';
  entityId: string | null;
  meta: Record<string, unknown>;
  actor: ProjectUserSummary | null;
  createdAt: string;
}

export interface ProjectMemberInput {
  userId: string;
  role: Role;
}

export type AddProjectMemberRequest = ProjectMemberInput;

export interface CreateProjectRequest {
  title: string;
  description: string;
  clientId?: string;
  priority: ProjectPriority;
  members: ProjectMemberInput[];
  startDate: string | null;
  dueDate: string | null;
  tags: string[];
  budget: number;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  priority?: ProjectPriority;
  startDate?: string | null;
  dueDate?: string | null;
  tags?: string[];
  budget?: number;
  health?: ProjectHealth;
}

export interface UpdateProjectStatusRequest {
  status: ProjectStatus;
  note?: string;
  rating?: number;
  feedback?: string;
}

export interface ProjectFilters {
  search: string;
  status: ProjectStatus | '';
  priority: ProjectPriority | '';
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'dueDate' | 'title' | 'priority' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface ProjectListQuery extends Omit<ProjectFilters, 'status' | 'priority'> {
  status?: ProjectStatus;
  priority?: ProjectPriority;
}

export interface SignOffInput {
  note: string;
  rating: number;
  feedback: string;
}

export interface SignOffProjectRequest {
  note?: string;
  rating: number;
  feedback: string;
}
