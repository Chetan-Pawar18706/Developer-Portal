import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';
import { USER_ROLES, type UserRole } from './user.model';

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

export interface ProjectMemberAttributes {
  user: Types.ObjectId;
  role: UserRole;
}

export interface DeliverySignOffAttributes {
  signedBy: Types.ObjectId | null;
  signedAt: Date | null;
  note: string;
  rating: number | null;
  feedback: string;
}

export interface ProjectAttributes {
  title: string;
  description: string;
  client: Types.ObjectId;
  status: ProjectStatus;
  priority: ProjectPriority;
  members: ProjectMemberAttributes[];
  startDate: Date | null;
  dueDate: Date | null;
  tags: string[];
  budget: number;
  health: ProjectHealth;
  deliverySignOff: DeliverySignOffAttributes;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectDocument = HydratedDocument<ProjectAttributes>;
export type ProjectModel = Model<ProjectAttributes>;

const projectMemberSchema = new Schema<ProjectMemberAttributes>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'developer',
      required: true,
    },
  },
  { _id: false },
);

const deliverySignOffSchema = new Schema<DeliverySignOffAttributes>(
  {
    signedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    signedAt: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  { _id: false },
);

const projectSchema = new Schema<ProjectAttributes, ProjectModel>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'draft',
      required: true,
    },
    priority: {
      type: String,
      enum: PROJECT_PRIORITIES,
      default: 'medium',
      required: true,
    },
    members: {
      type: [projectMemberSchema],
      default: [],
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    budget: {
      type: Number,
      min: 0,
      default: 0,
    },
    health: {
      type: String,
      enum: PROJECT_HEALTHS,
      default: 'on_track',
      required: true,
    },
    deliverySignOff: {
      type: deliverySignOffSchema,
      default: () => ({
        signedBy: null,
        signedAt: null,
        note: '',
        rating: null,
        feedback: '',
      }),
    },
  },
  { timestamps: true },
);

projectSchema.index({ client: 1 });
projectSchema.index({ 'members.user': 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ title: 'text', description: 'text' });

export const Project = model<ProjectAttributes, ProjectModel>('Project', projectSchema);
