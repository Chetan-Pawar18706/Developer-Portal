import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

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

export interface IssueAttachmentAttributes {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface IssueAttributes {
  project: Types.ObjectId;
  title: string;
  description: string;
  type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  stepsToReproduce: string;
  raisedBy: Types.ObjectId;
  assignedTo: Types.ObjectId | null;
  attachments: IssueAttachmentAttributes[];
  fileIds: Types.ObjectId[];
  linkedTask: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IssueDocument = HydratedDocument<IssueAttributes>;
export type IssueModel = Model<IssueAttributes>;

const issueAttachmentSchema = new Schema<IssueAttachmentAttributes>(
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

const issueSchema = new Schema<IssueAttributes, IssueModel>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 20_000,
    },
    type: {
      type: String,
      enum: ISSUE_TYPES,
      default: 'bug',
      required: true,
    },
    severity: {
      type: String,
      enum: ISSUE_SEVERITIES,
      default: 'medium',
      required: true,
    },
    status: {
      type: String,
      enum: ISSUE_STATUSES,
      default: 'open',
      required: true,
    },
    stepsToReproduce: {
      type: String,
      trim: true,
      maxlength: 10_000,
      default: '',
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    attachments: {
      type: [issueAttachmentSchema],
      default: [],
    },
    fileIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'File' }],
      default: [],
    },
    linkedTask: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
  },
  { timestamps: true },
);

issueSchema.index({ title: 'text', description: 'text' });
issueSchema.index({ project: 1, status: 1, severity: 1, createdAt: -1 });
issueSchema.index({ assignedTo: 1 });
issueSchema.index({ linkedTask: 1 });

export const Issue = model<IssueAttributes, IssueModel>('Issue', issueSchema);
