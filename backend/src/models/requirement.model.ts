import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

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

export interface RequirementVersionAttributes {
  title: string;
  description: string;
  editedBy: Types.ObjectId;
  editedAt: Date;
}

export interface RequirementAttachmentAttributes {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId | null;
  uploadedAt: Date | null;
}

export interface RequirementAttributes {
  project: Types.ObjectId;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: RequirementPriority;
  type: RequirementType;
  status: RequirementStatus;
  versions: RequirementVersionAttributes[];
  attachments: RequirementAttachmentAttributes[];
  fileIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  reviewNote: string;
  changeRequestOf: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RequirementDocument = HydratedDocument<RequirementAttributes>;
export type RequirementModel = Model<RequirementAttributes>;

const requirementVersionSchema = new Schema<RequirementVersionAttributes>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      maxlength: 20_000,
    },
    editedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    editedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const requirementAttachmentSchema = new Schema<RequirementAttachmentAttributes>(
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
      default: 'application/octet-stream',
    },
    size: {
      type: Number,
      min: 0,
      default: 0,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const requirementSchema = new Schema<RequirementAttributes, RequirementModel>(
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
      maxlength: 20_000,
    },
    acceptanceCriteria: {
      type: [String],
      default: [],
    },
    priority: {
      type: String,
      enum: REQUIREMENT_PRIORITIES,
      default: 'should',
      required: true,
    },
    type: {
      type: String,
      enum: REQUIREMENT_TYPES,
      default: 'functional',
      required: true,
    },
    status: {
      type: String,
      enum: REQUIREMENT_STATUSES,
      default: 'draft',
      required: true,
    },
    versions: {
      type: [requirementVersionSchema],
      default: [],
    },
    attachments: {
      type: [requirementAttachmentSchema],
      default: [],
    },
    fileIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'File' }],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    changeRequestOf: {
      type: Schema.Types.ObjectId,
      ref: 'Requirement',
      default: null,
    },
  },
  { timestamps: true },
);

requirementSchema.index({ project: 1, status: 1 });
requirementSchema.index({ project: 1, priority: 1 });
requirementSchema.index({ project: 1, type: 1 });
requirementSchema.index({ project: 1, createdAt: -1 });
requirementSchema.index({ changeRequestOf: 1 });

export const Requirement = model<RequirementAttributes, RequirementModel>(
  'Requirement',
  requirementSchema,
);
