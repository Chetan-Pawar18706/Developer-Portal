import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

export const COMMENT_ENTITY_TYPES = ['project', 'requirement', 'task', 'issue'] as const;
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number];

export interface CommentReactionAttributes {
  emoji: string;
  users: Types.ObjectId[];
}

export interface CommentAttachmentAttributes {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface CommentAttributes {
  project: Types.ObjectId;
  entityType: CommentEntityType;
  entityId: Types.ObjectId;
  author: Types.ObjectId;
  text: string;
  mentions: Types.ObjectId[];
  parent: Types.ObjectId | null;
  isInternal: boolean;
  reactions: CommentReactionAttributes[];
  attachments: CommentAttachmentAttributes[];
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentDocument = HydratedDocument<CommentAttributes>;
export type CommentModel = Model<CommentAttributes>;

const reactionSchema = new Schema<CommentReactionAttributes>(
  {
    emoji: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 16,
    },
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
  },
  { _id: false },
);

const attachmentSchema = new Schema<CommentAttachmentAttributes>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    mimeType: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    size: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const commentSchema = new Schema<CommentAttributes, CommentModel>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: COMMENT_ENTITY_TYPES,
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10_000,
    },
    mentions: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

commentSchema.index({ entityType: 1, entityId: 1, createdAt: 1 });
commentSchema.index({ parent: 1 });

export const Comment = model<CommentAttributes, CommentModel>('Comment', commentSchema);
