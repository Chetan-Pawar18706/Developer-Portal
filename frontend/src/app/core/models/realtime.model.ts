import type { Comment } from './comment.model';
import type { ProjectFile } from './file.model';
import type { Issue } from './issue.model';
import type { Notification } from './notification.model';
import type { Requirement } from './requirement.model';
import type { Task } from './task.model';
import type { Role } from './user.model';

export interface EntityDeletedEvent {
  projectId: string;
  id: string;
  entityType?: string;
  entityId?: string;
  deletedIds?: string[];
  isInternal?: boolean;
}

export interface PresenceUser {
  userId: string;
  name: string;
  role: Role;
}

export interface PresenceUpdateEvent {
  projectId: string;
  onlineUsers: PresenceUser[];
}

export interface TypingEvent {
  projectId: string;
  entityType: string;
  entityId: string;
  isInternal: boolean;
  isTyping: boolean;
  user: PresenceUser;
}

export type RealtimeTaskEvent = Task;
export type RealtimeCommentEvent = Comment;
export type RealtimeIssueEvent = Issue;
export type RealtimeRequirementEvent = Requirement;
export type RealtimeNotificationEvent = Notification;
export type RealtimeFileEvent = ProjectFile;
