import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { Comment, type CommentDocument, type CommentEntityType } from '../models/comment.model';
import { File, type FileDocument, type FileFolder } from '../models/file.model';
import { Issue, type IssueDocument } from '../models/issue.model';
import {
  Project,
  type ProjectDocument,
  type ProjectStatus,
} from '../models/project.model';
import { Task, type TaskDocument, type TaskPriority, type TaskStatus } from '../models/task.model';
import {
  User,
  hashPassword,
  type NotificationPreferences,
  type UserDocument,
  type UserRole,
} from '../models/user.model';
import { signAccessToken } from '../utils/token';

export const defaultPassword = 'Password123!';

export interface CreateUserOptions {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  notificationPrefs?: Partial<NotificationPreferences>;
}

export async function createUser(options: CreateUserOptions = {}): Promise<UserDocument> {
  const {
    name = 'Test User',
    email = 'test@example.com',
    password = defaultPassword,
    role = 'client',
    isActive = true,
    notificationPrefs = {},
  } = options;

  return User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    isActive,
    notificationPrefs: {
      emailOnAssignment: true,
      emailOnMention: true,
      emailOnStatusChange: true,
      emailOnReminder: true,
      ...notificationPrefs,
    },
  });
}

export function bearerToken(user: UserDocument): string {
  return `Bearer ${signAccessToken(user.id, user.role)}`;
}

export interface CreateProjectOptions {
  title?: string;
  description?: string;
  client: UserDocument;
  members?: Array<{ user: UserDocument; role: UserRole }>;
  status?: ProjectStatus;
}

export async function createProject(options: CreateProjectOptions): Promise<ProjectDocument> {
  const members = options.members ?? [{ user: options.client, role: 'client' }];

  return Project.create({
    title: options.title ?? 'Test project',
    description: options.description ?? 'A project used by automated tests.',
    client: options.client._id,
    status: options.status ?? 'active',
    members: members.map((member) => ({ user: member.user._id, role: member.role })),
  });
}

export interface CreateTaskOptions {
  project: ProjectDocument;
  reporter: UserDocument;
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  order?: number;
  assignee?: UserDocument | null;
}

export async function createTask(options: CreateTaskOptions): Promise<TaskDocument> {
  return Task.create({
    project: options.project._id,
    requirement: null,
    title: options.title ?? 'Test task',
    description: 'A task used by automated tests.',
    assignee: options.assignee?._id ?? null,
    reporter: options.reporter._id,
    status: options.status ?? 'todo',
    priority: options.priority ?? 'medium',
    estimateHours: 0,
    dueDate: null,
    labels: [],
    order: options.order ?? 0,
    subtasks: [],
    timeLogs: [],
    clientReview: { status: 'pending', note: '', by: null, at: null },
    linkedIssue: null,
  });
}

export interface CreateFileOptions {
  project: ProjectDocument;
  uploadedBy: UserDocument;
  name?: string;
  folder?: FileFolder;
  isInternal?: boolean;
}

export async function createFile(options: CreateFileOptions): Promise<FileDocument> {
  const name = options.name ?? 'notes.txt';

  return File.create({
    project: options.project._id,
    name,
    originalName: name,
    mimeType: 'text/plain',
    size: 12,
    storagePath: `other/${randomUUID()}.txt`,
    folder: options.folder ?? 'other',
    uploadedBy: options.uploadedBy._id,
    isInternal: options.isInternal ?? false,
    version: 1,
    versions: [],
  });
}

export interface CreateCommentOptions {
  project: ProjectDocument;
  author: UserDocument;
  entityType?: CommentEntityType;
  entityId?: Types.ObjectId;
  text?: string;
  isInternal?: boolean;
  fileIds?: Types.ObjectId[];
}

export async function createComment(options: CreateCommentOptions): Promise<CommentDocument> {
  return Comment.create({
    project: options.project._id,
    entityType: options.entityType ?? 'project',
    entityId: options.entityId ?? options.project._id,
    author: options.author._id,
    text: options.text ?? 'A comment used by automated tests.',
    mentions: [],
    parent: null,
    isInternal: options.isInternal ?? false,
    reactions: [],
    attachments: [],
    fileIds: options.fileIds ?? [],
    editedAt: null,
  });
}

export interface CreateIssueOptions {
  project: ProjectDocument;
  raisedBy: UserDocument;
  title?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'in_discussion' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
}

export async function createIssue(options: CreateIssueOptions): Promise<IssueDocument> {
  return Issue.create({
    project: options.project._id,
    title: options.title ?? 'Test issue',
    description: 'An issue used by automated tests.',
    type: 'bug',
    severity: options.severity ?? 'medium',
    status: options.status ?? 'open',
    stepsToReproduce: '',
    raisedBy: options.raisedBy._id,
    assignedTo: null,
    attachments: [],
    fileIds: [],
    linkedTask: null,
  });
}
