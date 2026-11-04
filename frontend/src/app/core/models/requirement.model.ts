import type { ProjectUserSummary } from './project.model';

export const REQUIREMENT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'clarification',
  'approved',
  'rejected',
] as const;

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_PRIORITIES = ['must', 'should', 'could', 'wont'] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

export const REQUIREMENT_TYPES = ['functional', 'non_functional'] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  clarification: 'Needs clarification',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const REQUIREMENT_PRIORITY_LABELS: Record<RequirementPriority, string> = {
  must: 'Must have',
  should: 'Should have',
  could: 'Could have',
  wont: "Won't have",
};

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  functional: 'Functional',
  non_functional: 'Non-functional',
};

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

export const REQUIREMENT_STEPPER_STATUSES: readonly RequirementStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
];

export interface RequirementVersion {
  title: string;
  description: string;
  editedBy: ProjectUserSummary | null;
  editedAt: string;
}

export interface RequirementAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface RequirementLink {
  id: string;
  title: string;
  status: RequirementStatus;
}

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: RequirementPriority;
  type: RequirementType;
  status: RequirementStatus;
  versions: RequirementVersion[];
  attachments: RequirementAttachment[];
  createdBy: ProjectUserSummary | null;
  reviewNote: string;
  changeRequestOf: RequirementLink | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementFilters {
  search: string;
  status: RequirementStatus | '';
  priority: RequirementPriority | '';
  type: RequirementType | '';
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'priority' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface RequirementListQuery extends Omit<
  RequirementFilters,
  'status' | 'priority' | 'type'
> {
  status?: RequirementStatus;
  priority?: RequirementPriority;
  type?: RequirementType;
}

export interface RequirementAttachmentInput {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface CreateRequirementRequest {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: RequirementPriority;
  type: RequirementType;
  attachments?: RequirementAttachmentInput[];
}

export interface UpdateRequirementRequest {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  priority?: RequirementPriority;
  type?: RequirementType;
  attachments?: RequirementAttachmentInput[];
}

export interface UpdateRequirementStatusRequest {
  status: RequirementStatus;
  note?: string;
}

export interface CreateChangeRequestRequest {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  priority?: RequirementPriority;
  type?: RequirementType;
}
