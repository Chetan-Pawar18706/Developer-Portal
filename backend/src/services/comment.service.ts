import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import {
  Comment,
  type CommentAttributes,
  type CommentAttachmentAttributes,
  type CommentDocument,
} from '../models/comment.model';
import { Project, type ProjectDocument } from '../models/project.model';
import { User, type UserRole } from '../models/user.model';
import type {
  CreateCommentInput,
  ListCommentsQuery,
  ListGlobalCommentsQuery,
  ToggleReactionInput,
  UpdateCommentInput,
} from '../routes/comment.schemas';
import { ApiError } from '../utils/ApiError';
import { logActivity } from './activity.service';
import { resolveFileLinks, type PublicFileLink } from './file.service';
import { buildProjectVisibilityFilter } from './project.service';
import { notify } from './notification.service';

const COMMENT_POPULATE = [
  { path: 'author', select: 'name email role avatar' },
  { path: 'mentions', select: 'name email role avatar' },
  { path: 'reactions.users', select: 'name email role avatar' },
  {
    path: 'fileIds',
    select: 'originalName mimeType size version isInternal',
  },
];

const GLOBAL_COMMENT_POPULATE = [
  ...COMMENT_POPULATE,
  { path: 'project', select: 'title' },
];

const MENTION_TOKEN_PATTERN = /@\[[^\]]+\]\(([a-f\d]{24})\)/gi;

export interface CommentActor {
  id: string;
  role: UserRole;
}

export interface CommentUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

export interface PublicCommentReaction {
  emoji: string;
  users: CommentUserSummary[];
}

export interface PublicCommentAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface PublicComment {
  id: string;
  projectId: string;
  projectTitle: string | null;
  entityType: 'project' | 'requirement' | 'task' | 'issue';
  entityId: string;
  author: CommentUserSummary;
  text: string;
  mentions: CommentUserSummary[];
  parentId: string | null;
  isInternal: boolean;
  reactions: PublicCommentReaction[];
  attachments: PublicCommentAttachment[];
  files: PublicFileLink[];
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  replies: PublicComment[];
}

export interface CommentListResult {
  data: PublicComment[];
  total: number;
  page: number;
  limit: number;
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

interface PopulatedCommentShape {
  id: string;
  project: Types.ObjectId | PopulatedProjectShape;
  entityType: PublicComment['entityType'];
  entityId: Types.ObjectId;
  author: PopulatedUserShape;
  text: string;
  mentions: PopulatedUserShape[];
  parent: Types.ObjectId | null;
  isInternal: boolean;
  reactions: Array<{ emoji: string; users: PopulatedUserShape[] }>;
  attachments: CommentAttachmentAttributes[];
  fileIds: Array<{
    _id: Types.ObjectId;
    originalName: string;
    mimeType: string;
    size: number;
    version: number;
    isInternal: boolean;
  }>;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toUserSummary(user: PopulatedUserShape): CommentUserSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

function isPopulatedProject(
  project: Types.ObjectId | PopulatedProjectShape,
): project is PopulatedProjectShape {
  return !(project instanceof Types.ObjectId);
}

function toPublicComment(comment: CommentDocument, actorIsClient: boolean): PublicComment {
  const populated = comment as unknown as PopulatedCommentShape;
  const project = populated.project;

  return {
    id: populated.id,
    projectId: isPopulatedProject(project) ? project._id.toString() : project.toString(),
    projectTitle: isPopulatedProject(project) ? project.title : null,
    entityType: populated.entityType,
    entityId: populated.entityId.toString(),
    author: toUserSummary(populated.author),
    text: populated.text,
    mentions: populated.mentions.map(toUserSummary),
    parentId: populated.parent ? populated.parent.toString() : null,
    isInternal: actorIsClient ? false : populated.isInternal,
    reactions: populated.reactions.map((reaction) => ({
      emoji: reaction.emoji,
      users: reaction.users.map(toUserSummary),
    })),
    attachments: populated.attachments.map((attachment) => ({ ...attachment })),
    files: populated.fileIds
      .filter((file) => !actorIsClient || !file.isInternal)
      .map((file) => ({
        id: file._id.toString(),
        name: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        version: file.version,
        isInternal: file.isInternal,
      })),
    editedAt: populated.editedAt,
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
    replies: [],
  };
}

async function findPopulatedComment(commentId: string): Promise<CommentDocument> {
  const comment = await Comment.findById(commentId).populate(COMMENT_POPULATE);

  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  return comment;
}

function visibilityFilter(actor: CommentActor): QueryFilter<CommentAttributes> {
  if (actor.role === 'client') {
    return { isInternal: { $ne: true } };
  }

  return {};
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeCommentText(value: string): string {
  const sanitized = sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();

  if (sanitized.length === 0) {
    throw new ApiError(422, 'Comment text cannot be empty after sanitization');
  }

  return sanitized;
}

function parseMentionIds(
  text: string,
  project: ProjectDocument,
  explicitMentions: readonly string[],
): Types.ObjectId[] {
  const allowed = new Map<string, Types.ObjectId>();
  allowed.set(project.client.toString(), project.client);

  for (const member of project.members) {
    allowed.set(member.user.toString(), member.user);
  }

  const mentionIds = new Set<string>();

  for (const mention of explicitMentions) {
    if (allowed.has(mention)) {
      mentionIds.add(mention);
    }
  }

  for (const match of text.matchAll(MENTION_TOKEN_PATTERN)) {
    const mention = match[1];

    if (allowed.has(mention)) {
      mentionIds.add(mention);
    }
  }

  return [...mentionIds].map((id) => new Types.ObjectId(id));
}

function assertCanEdit(comment: CommentDocument, actor: CommentActor): void {
  if (comment.author.toString() !== actor.id) {
    throw new ApiError(403, 'You can only edit your own comments');
  }
}

function assertCanDelete(comment: CommentDocument, actor: CommentActor): void {
  if (actor.role === 'admin' || comment.author.toString() === actor.id) {
    return;
  }

  throw new ApiError(403, 'You can only delete your own comments');
}

async function loadParent(
  project: ProjectDocument,
  input: CreateCommentInput,
  actor: CommentActor,
): Promise<void> {
  if (!input.parent) {
    return;
  }

  const parent = await Comment.findById(input.parent);

  if (
    !parent ||
    !parent.project.equals(project._id) ||
    parent.entityType !== input.entityType ||
    !parent.entityId.equals(new Types.ObjectId(input.entityId))
  ) {
    throw new ApiError(404, 'Parent comment not found');
  }

  if (actor.role === 'client' && parent.isInternal) {
    throw new ApiError(404, 'Comment not found');
  }
}

function attachmentValues(
  attachments: readonly CreateCommentInput['attachments'][number][],
): CommentAttachmentAttributes[] {
  return attachments.map((attachment) => ({
    name: attachment.name,
    url: attachment.url,
    mimeType: attachment.mimeType,
    size: attachment.size,
  }));
}

export async function listGlobalComments(
  actor: CommentActor,
  query: ListGlobalCommentsQuery,
): Promise<CommentListResult> {
  const visibleProjects = await Project.find(buildProjectVisibilityFilter(actor)).select('_id');
  const projectIds = visibleProjects.map((project) => project._id);
  const filter: QueryFilter<CommentAttributes> = {
    project: { $in: projectIds },
    ...visibilityFilter(actor),
  };

  if (query.projectId) {
    const requestedId = new Types.ObjectId(query.projectId);
    filter.project = projectIds.some((id) => id.equals(requestedId)) ? requestedId : { $in: [] };
  }

  if (query.entityType) {
    filter.entityType = query.entityType;
  }

  if (query.authorId) {
    filter.author = new Types.ObjectId(query.authorId);
  }

  if (query.search) {
    filter.text = { $regex: escapeRegExp(query.search), $options: 'i' };
  }

  const skip = (query.page - 1) * query.limit;
  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .populate(GLOBAL_COMMENT_POPULATE)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit),
    Comment.countDocuments(filter),
  ]);

  return {
    data: comments.map((comment) => ({
      ...toPublicComment(comment, actor.role === 'client'),
      replies: [],
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function listComments(
  project: ProjectDocument,
  actor: CommentActor,
  query: ListCommentsQuery,
): Promise<CommentListResult> {
  const actorIsClient = actor.role === 'client';
  const baseFilter: QueryFilter<CommentAttributes> = {
    project: project._id,
    entityType: query.entityType,
    entityId: new Types.ObjectId(query.entityId),
    parent: null,
    ...visibilityFilter(actor),
  };
  const skip = (query.page - 1) * query.limit;

  const [roots, total] = await Promise.all([
    Comment.find(baseFilter)
      .populate(COMMENT_POPULATE)
      .sort({ createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(query.limit),
    Comment.countDocuments(baseFilter),
  ]);

  const collected = new Map<string, CommentDocument>();

  for (const root of roots) {
    collected.set(root.id, root);
  }

  let frontier = roots.map((comment) => comment._id);

  while (frontier.length > 0) {
    const children = await Comment.find({
      project: project._id,
      entityType: query.entityType,
      entityId: new Types.ObjectId(query.entityId),
      parent: { $in: frontier },
      ...visibilityFilter(actor),
    })
      .populate(COMMENT_POPULATE)
      .sort({ createdAt: 1, _id: 1 });
    const nextFrontier: Types.ObjectId[] = [];

    for (const child of children) {
      if (collected.has(child.id)) {
        continue;
      }

      collected.set(child.id, child);
      nextFrontier.push(child._id);
    }

    frontier = nextFrontier;
  }

  const repliesByParent = new Map<string, CommentDocument[]>();

  for (const comment of collected.values()) {
    const parentId = comment.parent ? comment.parent.toString() : 'root';
    const siblings = repliesByParent.get(parentId) ?? [];
    siblings.push(comment);
    repliesByParent.set(parentId, siblings);
  }

  const buildNode = (comment: CommentDocument): PublicComment => ({
    ...toPublicComment(comment, actorIsClient),
    replies: (repliesByParent.get(comment.id) ?? []).map(buildNode),
  });

  return {
    data: roots.map(buildNode),
    total,
    page: query.page,
    limit: query.limit,
  };
}

function commentLink(
  projectId: string,
  entityType: PublicComment['entityType'],
  entityId: string,
): string {
  const base = `/projects/${projectId}`;

  switch (entityType) {
    case 'project':
      return `${base}/discussion`;
    case 'requirement':
      return `${base}/requirements/${entityId}`;
    case 'task':
      return `${base}/tasks`;
    case 'issue':
      return `${base}/issues/${entityId}`;
  }
}

async function notifyMentions(
  comment: CommentDocument,
  project: ProjectDocument,
  actor: CommentActor,
  isInternal: boolean,
): Promise<void> {
  let recipients = comment.mentions
    .map((id) => id.toString())
    .filter((id) => id !== actor.id);

  if (recipients.length === 0) {
    return;
  }

  if (isInternal) {
    const users = await User.find({ _id: { $in: recipients } }).select('role');
    recipients = users
      .filter((user) => user.role !== 'client')
      .map((user) => user.id);
  }

  if (recipients.length === 0) {
    return;
  }

  await notify(recipients, {
    projectId: project._id.toString(),
    type: 'mention',
    message: `You were mentioned in a comment on this ${comment.entityType}.`,
    link: commentLink(
      project._id.toString(),
      comment.entityType,
      comment.entityId.toString(),
    ),
  });
}

export async function createComment(
  project: ProjectDocument,
  actor: CommentActor,
  input: CreateCommentInput,
): Promise<PublicComment> {
  if (input.isInternal && actor.role === 'client') {
    throw new ApiError(403, 'Clients cannot create internal notes');
  }

  await loadParent(project, input, actor);

  const text = sanitizeCommentText(input.text);
  const attachedFiles = await resolveFileLinks(input.fileIds, project._id, actor);

  if (attachedFiles.length !== input.fileIds.length) {
    throw new ApiError(400, 'One or more attached files are unavailable');
  }

  const comment = await Comment.create({
    project: project._id,
    entityType: input.entityType,
    entityId: new Types.ObjectId(input.entityId),
    author: new Types.ObjectId(actor.id),
    text,
    mentions: parseMentionIds(text, project, input.mentions),
    parent: input.parent ? new Types.ObjectId(input.parent) : null,
    isInternal: input.isInternal,
    reactions: [],
    attachments: attachmentValues(input.attachments),
    fileIds: attachedFiles.map((file) => new Types.ObjectId(file.id)),
    editedAt: null,
  });

  await logActivity({
    projectId: project._id,
    actorId: actor.id,
    action: 'comment_created',
    entityType: 'comment',
    entityId: comment._id,
    meta: {
      commentId: comment.id,
      entityType: comment.entityType,
      entityId: comment.entityId.toString(),
      isInternal: comment.isInternal,
    },
  });

  await notifyMentions(comment, project, actor, input.isInternal);

  return toPublicComment(
    await findPopulatedComment(comment.id),
    actor.role === 'client',
  );
}

export async function updateComment(
  comment: CommentDocument,
  project: ProjectDocument,
  actor: CommentActor,
  input: UpdateCommentInput,
): Promise<PublicComment> {
  assertCanEdit(comment, actor);

  const text = sanitizeCommentText(input.text);
  comment.text = text;
  comment.mentions = parseMentionIds(text, project, comment.mentions.map((id) => id.toString()));
  comment.editedAt = new Date();
  await comment.save();

  await logActivity({
    projectId: comment.project,
    actorId: actor.id,
    action: 'comment_updated',
    entityType: 'comment',
    entityId: comment._id,
    meta: { commentId: comment.id },
  });

  return toPublicComment(
    await findPopulatedComment(comment.id),
    actor.role === 'client',
  );
}

export async function deleteComment(
  comment: CommentDocument,
  actor: CommentActor,
): Promise<void> {
  assertCanDelete(comment, actor);

  const comments = await Comment.find({
    project: comment.project,
    entityType: comment.entityType,
    entityId: comment.entityId,
  }).select('_id parent');
  const childrenByParent = new Map<string, Types.ObjectId[]>();

  for (const item of comments) {
    if (!item.parent) {
      continue;
    }

    const parentId = item.parent.toString();
    const children = childrenByParent.get(parentId) ?? [];
    children.push(item._id);
    childrenByParent.set(parentId, children);
  }

  const ids = new Set<string>([comment.id]);
  const queue = [comment.id];

  while (queue.length > 0) {
    const parentId = queue.shift();

    if (!parentId) {
      continue;
    }

    for (const childId of childrenByParent.get(parentId) ?? []) {
      const key = childId.toString();

      if (ids.has(key)) {
        continue;
      }

      ids.add(key);
      queue.push(key);
    }
  }

  await Comment.deleteMany({
    _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) },
  });

  await logActivity({
    projectId: comment.project,
    actorId: actor.id,
    action: 'comment_deleted',
    entityType: 'comment',
    entityId: comment._id,
    meta: { commentId: comment.id, deletedCount: ids.size },
  });
}

export async function toggleReaction(
  comment: CommentDocument,
  actor: CommentActor,
  input: ToggleReactionInput,
): Promise<PublicComment> {
  const userId = new Types.ObjectId(actor.id);
  const reaction = comment.reactions.find((item) => item.emoji === input.emoji);

  if (!reaction) {
    comment.reactions.push({ emoji: input.emoji, users: [userId] });
  } else {
    const existingIndex = reaction.users.findIndex((id) => id.equals(userId));

    if (existingIndex >= 0) {
      reaction.users.splice(existingIndex, 1);
    } else {
      reaction.users.push(userId);
    }

    comment.reactions = comment.reactions.filter(
      (item) => item.emoji !== input.emoji || item.users.length > 0,
    );
  }

  await comment.save();
  await logActivity({
    projectId: comment.project,
    actorId: actor.id,
    action: 'comment_reacted',
    entityType: 'comment',
    entityId: comment._id,
    meta: { commentId: comment.id, emoji: input.emoji },
  });

  return toPublicComment(
    await findPopulatedComment(comment.id),
    actor.role === 'client',
  );
}
