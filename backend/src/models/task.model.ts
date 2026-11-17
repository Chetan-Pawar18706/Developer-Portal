import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

export const TASK_STATUSES = [
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CLIENT_REVIEW_STATUSES = [
  'pending',
  'approved',
  'changes_requested',
] as const;

export type TaskClientReviewStatus = (typeof TASK_CLIENT_REVIEW_STATUSES)[number];

export interface TaskSubtaskAttributes {
  title: string;
  done: boolean;
}

export interface TaskTimeLogAttributes {
  user: Types.ObjectId;
  hours: number;
  note: string;
  date: Date;
}

export interface TaskClientReviewAttributes {
  status: TaskClientReviewStatus;
  note: string;
  by: Types.ObjectId | null;
  at: Date | null;
}

export interface TaskAttributes {
  project: Types.ObjectId;
  requirement: Types.ObjectId | null;
  title: string;
  description: string;
  assignee: Types.ObjectId | null;
  reporter: Types.ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  estimateHours: number;
  dueDate: Date | null;
  labels: string[];
  order: number;
  subtasks: TaskSubtaskAttributes[];
  timeLogs: TaskTimeLogAttributes[];
  clientReview: TaskClientReviewAttributes;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskDocument = HydratedDocument<TaskAttributes>;
export type TaskModel = Model<TaskAttributes>;

const taskSubtaskSchema = new Schema<TaskSubtaskAttributes>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    done: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const taskTimeLogSchema = new Schema<TaskTimeLogAttributes>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hours: {
      type: Number,
      required: true,
      min: 0.25,
      max: 24,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false },
);

const taskClientReviewSchema = new Schema<TaskClientReviewAttributes>(
  {
    status: {
      type: String,
      enum: TASK_CLIENT_REVIEW_STATUSES,
      default: 'pending',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    at: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const taskSchema = new Schema<TaskAttributes, TaskModel>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    requirement: {
      type: Schema.Types.ObjectId,
      ref: 'Requirement',
      default: null,
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
      trim: true,
      maxlength: 20_000,
      default: '',
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'todo',
      required: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'medium',
      required: true,
    },
    estimateHours: {
      type: Number,
      min: 0,
      max: 10_000,
      default: 0,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    labels: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    subtasks: {
      type: [taskSubtaskSchema],
      default: [],
    },
    timeLogs: {
      type: [taskTimeLogSchema],
      default: [],
    },
    clientReview: {
      type: taskClientReviewSchema,
      default: () => ({
        status: 'pending',
        note: '',
        by: null,
        at: null,
      }),
    },
  },
  { timestamps: true },
);

taskSchema.index({ project: 1, status: 1, order: 1 });
taskSchema.index({ assignee: 1 });
taskSchema.index({ requirement: 1 });

export const Task = model<TaskAttributes, TaskModel>('Task', taskSchema);
