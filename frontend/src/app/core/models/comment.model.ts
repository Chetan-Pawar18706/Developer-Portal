import type { FileLink } from './file.model';

export const COMMENT_ENTITY_TYPES = ['project', 'requirement', 'task', 'issue'] as const;
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];

export interface CommentUserSummary {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'pm' | 'developer' | 'client';
  avatar: string | null;
}

export interface CommentReaction {
  emoji: string;
  users: CommentUserSummary[];
}

export interface CommentAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface Comment {
  id: string;
  projectId: string;
  projectTitle?: string | null;
  entityType: CommentEntityType;
  entityId: string;
  author: CommentUserSummary;
  text: string;
  mentions: CommentUserSummary[];
  parentId: string | null;
  isInternal: boolean;
  reactions: CommentReaction[];
  attachments: CommentAttachment[];
  files: FileLink[];
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies: Comment[];
}

export interface CommentListQuery {
  page: number;
  limit: number;
}

export interface GlobalCommentListQuery extends CommentListQuery {
  projectId?: string;
  entityType?: CommentEntityType;
  search?: string;
}

export interface CreateCommentRequest {
  entityType: CommentEntityType;
  entityId: string;
  text: string;
  parent?: string | null;
  isInternal?: boolean;
  mentions?: string[];
  attachments?: CommentAttachment[];
  fileIds?: string[];
}

export interface UpdateCommentRequest {
  text: string;
}

export interface ToggleReactionRequest {
  emoji: string;
}
