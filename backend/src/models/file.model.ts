import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';

export const FILE_FOLDERS = [
  'requirements',
  'designs',
  'deliverables',
  'contracts',
  'other',
] as const;
export type FileFolder = (typeof FILE_FOLDERS)[number];

export const FILE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
] as const;

export const FILE_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
  '.xlsx',
  '.zip',
  '.txt',
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface FileVersionAttributes {
  storagePath: string;
  size: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface FileAttributes {
  project: Types.ObjectId;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  folder: FileFolder;
  uploadedBy: Types.ObjectId;
  isInternal: boolean;
  version: number;
  versions: FileVersionAttributes[];
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<FileAttributes>;
export type FileModel = Model<FileAttributes>;

const fileVersionSchema = new Schema<FileVersionAttributes>(
  {
    storagePath: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const fileSchema = new Schema<FileAttributes, FileModel>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_FILE_SIZE_BYTES,
    },
    storagePath: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    folder: {
      type: String,
      enum: FILE_FOLDERS,
      required: true,
      default: 'other',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
      required: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    versions: {
      type: [fileVersionSchema],
      default: [],
    },
  },
  { timestamps: true },
);

fileSchema.index({ project: 1, folder: 1, createdAt: -1 });
fileSchema.index({ project: 1, isInternal: 1, createdAt: -1 });

export const File = model<FileAttributes, FileModel>('File', fileSchema);
