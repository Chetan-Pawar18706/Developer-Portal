import type { QueryFilter } from 'mongoose';
import path from 'node:path';
import { Types } from 'mongoose';
import {
  File,
  type FileAttributes,
  type FileDocument,
  type FileFolder,
} from '../models/file.model';
import { Project } from '../models/project.model';
import type { UserRole } from '../models/user.model';
import type { ListFilesQuery } from '../routes/file.schemas';
import {
  emitProjectEvent,
  REALTIME_EVENTS,
} from '../sockets/socket.server';
import { ApiError } from '../utils/ApiError';
import {
  buildProjectVisibilityFilter,
  canAccessProject,
} from './project.service';
import { storageService } from './storage.service';

export interface FileActor {
  id: string;
  role: UserRole;
}

export interface PublicUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
}

export interface PublicFileVersion {
  storagePath: string;
  size: number;
  uploadedBy: PublicUserSummary | null;
  uploadedAt: Date;
}

export interface PublicFile {
  id: string;
  projectId: string;
  projectTitle: string | null;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: FileFolder;
  uploadedBy: PublicUserSummary | null;
  isInternal: boolean;
  version: number;
  versions: PublicFileVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicFileLink {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  version: number;
  isInternal: boolean;
}

export interface FileListResult {
  data: PublicFile[];
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

interface PopulatedFileShape {
  id: string;
  project: Types.ObjectId | PopulatedProjectShape;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  folder: FileFolder;
  uploadedBy: PopulatedUserShape;
  isInternal: boolean;
  version: number;
  versions: Array<{
    storagePath: string;
    size: number;
    uploadedBy: PopulatedUserShape;
    uploadedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const FILE_POPULATE = [
  { path: 'uploadedBy', select: 'name email role avatar' },
  { path: 'versions.uploadedBy', select: 'name email role avatar' },
];

const FILE_LIST_POPULATE = [
  ...FILE_POPULATE,
  { path: 'project', select: 'title' },
];

const STAFF_ROLES: readonly UserRole[] = ['admin', 'pm', 'developer'];

function isStaff(actor: FileActor): boolean {
  return STAFF_ROLES.includes(actor.role);
}

function toUserSummary(user: PopulatedUserShape | null): PublicUserSummary | null {
  if (!user) {
    return null;
  }

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

function toPublicFile(file: FileDocument): PublicFile {
  const populated = file as unknown as PopulatedFileShape;
  const project = populated.project;

  return {
    id: populated.id,
    projectId: isPopulatedProject(project) ? project._id.toString() : project.toString(),
    projectTitle: isPopulatedProject(project) ? project.title : null,
    name: populated.name,
    originalName: populated.originalName,
    mimeType: populated.mimeType,
    size: populated.size,
    folder: populated.folder,
    uploadedBy: toUserSummary(populated.uploadedBy),
    isInternal: populated.isInternal,
    version: populated.version,
    versions: populated.versions.map((version) => ({
      storagePath: version.storagePath,
      size: version.size,
      uploadedBy: toUserSummary(version.uploadedBy),
      uploadedAt: version.uploadedAt,
    })),
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findPopulatedFile(fileId: string): Promise<FileDocument> {
  const file = await File.findById(fileId).populate(FILE_POPULATE);

  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  return file;
}

export async function createFiles(
  projectId: Types.ObjectId,
  actor: FileActor,
  uploads: readonly Express.Multer.File[],
  folder: FileFolder,
  requestedInternal: boolean,
): Promise<PublicFile[]> {
  if (uploads.length === 0) {
    throw new ApiError(400, 'Select at least one file to upload');
  }

  const isInternal = isStaff(actor) && requestedInternal;
  const created: FileDocument[] = [];

  for (const upload of uploads) {
    const stored = await storageService.save({
      buffer: upload.buffer,
      originalName: upload.originalname,
      folder,
    });
    const originalName = path.basename(upload.originalname).slice(0, 300);

    const file = await File.create({
      project: projectId,
      name: originalName,
      originalName,
      mimeType: upload.mimetype.toLowerCase(),
      size: stored.size,
      storagePath: stored.storagePath,
      folder,
      uploadedBy: new Types.ObjectId(actor.id),
      isInternal,
      version: 1,
      versions: [],
    });

    created.push(file);
  }

  const populated = await Promise.all(
    created.map((file) => findPopulatedFile(file.id)),
  );
  const files = populated.map(toPublicFile);

  for (const file of files) {
    emitProjectEvent(
      file.projectId,
      REALTIME_EVENTS.FILE_UPLOADED,
      file,
      file.isInternal,
    );
  }

  return files;
}

export async function listFiles(
  projectId: Types.ObjectId,
  actor: FileActor,
  query: ListFilesQuery,
): Promise<FileListResult> {
  const filter: QueryFilter<FileAttributes> = { project: projectId };

  if (query.folder) {
    filter.folder = query.folder;
  }

  if (query.search) {
    filter.originalName = { $regex: escapeRegExp(query.search), $options: 'i' };
  }

  if (!isStaff(actor)) {
    filter.isInternal = false;
  }

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;
  const sortField = query.sortBy === 'name' ? 'originalName' : query.sortBy;
  const sort: Record<string, 1 | -1> =
    sortField === 'createdAt'
      ? { createdAt: direction }
      : { [sortField]: direction, createdAt: -1 };

  const [files, total] = await Promise.all([
    File.find(filter)
      .populate(FILE_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(query.limit),
    File.countDocuments(filter),
  ]);

  return {
    data: files.map(toPublicFile),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function listAllFiles(
  actor: FileActor,
  query: ListFilesQuery,
): Promise<FileListResult> {
  const visibleProjects = await Project.find(buildProjectVisibilityFilter(actor)).select('_id');
  const projectIds = visibleProjects.map((project) => project._id);
  const filter: QueryFilter<FileAttributes> = { project: { $in: projectIds } };

  if (query.projectId) {
    const requestedProjectId = new Types.ObjectId(query.projectId);
    filter.project = projectIds.some((id) => id.equals(requestedProjectId))
      ? requestedProjectId
      : { $in: [] };
  }

  if (query.folder) {
    filter.folder = query.folder;
  }

  if (query.search) {
    filter.originalName = { $regex: escapeRegExp(query.search), $options: 'i' };
  }

  if (!isStaff(actor)) {
    filter.isInternal = false;
  }

  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;
  const sortField = query.sortBy === 'name' ? 'originalName' : query.sortBy;
  const sort: Record<string, 1 | -1> =
    sortField === 'createdAt'
      ? { createdAt: direction }
      : { [sortField]: direction, createdAt: -1 };

  const [files, total] = await Promise.all([
    File.find(filter)
      .populate(FILE_LIST_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(query.limit),
    File.countDocuments(filter),
  ]);

  return {
    data: files.map(toPublicFile),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function requireReadableFile(
  fileId: string,
  actor: FileActor,
): Promise<FileDocument> {
  const file = await findPopulatedFile(fileId);
  const project = await Project.findById(file.project);

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (!canAccessProject(project, actor)) {
    throw new ApiError(403, 'You do not have access to this file');
  }

  if (file.isInternal && !isStaff(actor)) {
    throw new ApiError(404, 'File not found');
  }

  return file;
}

export async function readFile(file: FileDocument): Promise<Buffer> {
  const populated = file as unknown as PopulatedFileShape;
  return storageService.read(populated.storagePath);
}

export async function addFileVersion(
  file: FileDocument,
  actor: FileActor,
  upload: Express.Multer.File,
): Promise<PublicFile> {
  const populated = file as unknown as PopulatedFileShape;
  const stored = await storageService.save({
    buffer: upload.buffer,
    originalName: upload.originalname,
    folder: populated.folder,
  });

  file.versions.push({
    storagePath: populated.storagePath,
    size: populated.size,
    uploadedBy: new Types.ObjectId(actor.id),
    uploadedAt: new Date(),
  });
  file.name = path.basename(upload.originalname).slice(0, 300);
  file.originalName = file.name;
  file.mimeType = upload.mimetype.toLowerCase();
  file.size = stored.size;
  file.storagePath = stored.storagePath;
  file.version += 1;
  await file.save();

  const publicFile = toPublicFile(await findPopulatedFile(file.id));
  emitProjectEvent(
    publicFile.projectId,
    REALTIME_EVENTS.FILE_UPDATED,
    publicFile,
    publicFile.isInternal,
  );
  return publicFile;
}

function assertCanDeleteFile(file: FileDocument, actor: FileActor): void {
  if (isStaff(actor) || file.uploadedBy.toString() === actor.id) {
    return;
  }

  throw new ApiError(403, 'Only staff or the uploader can delete this file');
}

export async function deleteFile(
  file: FileDocument,
  actor: FileActor,
): Promise<void> {
  assertCanDeleteFile(file, actor);
  const populated = file as unknown as PopulatedFileShape;
  const paths = [
    populated.storagePath,
    ...populated.versions.map((version) => version.storagePath),
  ];

  const projectId = isPopulatedProject(populated.project)
    ? populated.project._id.toString()
    : populated.project.toString();

  await File.deleteOne({ _id: file._id });

  await Promise.all(paths.map((storagePath) => storageService.remove(storagePath)));

  emitProjectEvent(
    projectId,
    REALTIME_EVENTS.FILE_DELETED,
    { projectId, id: file.id, isInternal: file.isInternal },
    file.isInternal,
  );
}

export async function resolveFileLinks(
  fileIds: readonly string[],
  projectId: Types.ObjectId,
  actor: FileActor,
): Promise<PublicFileLink[]> {
  if (fileIds.length === 0) {
    return [];
  }

  const filter: QueryFilter<FileAttributes> = {
    _id: { $in: fileIds.map((id) => new Types.ObjectId(id)) },
    project: projectId,
  };

  if (!isStaff(actor)) {
    filter.isInternal = false;
  }

  const files = await File.find(filter);
  const byId = new Map(files.map((file) => [file.id, file]));

  return fileIds.flatMap((id) => {
    const file = byId.get(id);

    if (!file) {
      return [];
    }

    return [
      {
        id,
        name: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        version: file.version,
        isInternal: file.isInternal,
      },
    ];
  });
}
