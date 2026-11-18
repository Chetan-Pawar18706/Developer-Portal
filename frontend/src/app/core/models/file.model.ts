import type { Role } from './user.model';

export const FILE_FOLDERS = [
  'requirements',
  'designs',
  'deliverables',
  'contracts',
  'other',
] as const;

export type FileFolder = (typeof FILE_FOLDERS)[number];

export const FILE_FOLDER_LABELS: Record<FileFolder, string> = {
  requirements: 'Requirements',
  designs: 'Designs',
  deliverables: 'Deliverables',
  contracts: 'Contracts',
  other: 'Other',
};

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
  '.xlsx',
  '.zip',
  '.txt',
] as const;

export const ALLOWED_FILE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface FileUserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
}

export interface FileVersion {
  size: number;
  uploadedBy: FileUserSummary | null;
  uploadedAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  projectTitle: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: FileFolder;
  uploadedBy: FileUserSummary | null;
  isInternal: boolean;
  version: number;
  versions: FileVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface FileLink {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  version: number;
  isInternal: boolean;
}

export interface FileListQuery {
  projectId?: string;
  folder?: FileFolder;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
