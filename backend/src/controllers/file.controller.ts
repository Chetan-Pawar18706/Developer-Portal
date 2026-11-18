import type { Request, Response } from 'express';
import type { ProjectDocument } from '../models/project.model';
import type { FileDocument } from '../models/file.model';
import type {
  CreateFilesBody,
  ListFilesQuery,
} from '../routes/file.schemas';
import * as fileService from '../services/file.service';
import { ApiError } from '../utils/ApiError';
import { sendPaginated, sendSuccess } from '../utils/response';

function requireActor(req: Request): fileService.FileActor {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  return req.user;
}

function requireProject(req: Request): ProjectDocument {
  if (!req.project) {
    throw new ApiError(404, 'Project not found');
  }

  return req.project;
}

function requireFile(req: Request): FileDocument {
  if (!req.fileRecord) {
    throw new ApiError(404, 'File not found');
  }

  return req.fileRecord;
}

function sendFile(res: Response, file: FileDocument, buffer: Buffer, inline: boolean): void {
  const filename = encodeURIComponent(file.originalName);

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${filename}`,
  );
  res.send(buffer);
}

export async function listProjectFiles(req: Request, res: Response): Promise<void> {
  const result = await fileService.listFiles(
    requireProject(req)._id,
    requireActor(req),
    req.query as unknown as ListFilesQuery,
  );

  sendPaginated(res, result.data, result.total, result.page, result.limit, 'Files retrieved');
}

export async function createProjectFiles(req: Request, res: Response): Promise<void> {
  const uploads = (req.files as Express.Multer.File[] | undefined) ?? [];
  const body = req.body as CreateFilesBody;
  const files = await fileService.createFiles(
    requireProject(req)._id,
    requireActor(req),
    uploads,
    body.folder,
    body.isInternal,
  );

  sendSuccess(res, { files }, `${files.length} file(s) uploaded`, 201);
}

export async function downloadFile(req: Request, res: Response): Promise<void> {
  const file = requireFile(req);
  const buffer = await fileService.readFile(file);
  sendFile(res, file, buffer, false);
}

export async function previewFile(req: Request, res: Response): Promise<void> {
  const file = requireFile(req);

  if (!/^(application\/pdf|image\/)/.test(file.mimeType)) {
    throw new ApiError(400, 'Preview is only available for PDF and image files');
  }

  const buffer = await fileService.readFile(file);
  sendFile(res, file, buffer, true);
}

export async function createFileVersion(req: Request, res: Response): Promise<void> {
  const upload = req.file;

  if (!upload) {
    throw new ApiError(400, 'Select a file to upload');
  }

  const file = await fileService.addFileVersion(
    requireFile(req),
    requireActor(req),
    upload,
  );

  sendSuccess(res, { file }, 'New version uploaded', 201);
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
  await fileService.deleteFile(requireFile(req), requireActor(req));
  sendSuccess(res, null, 'File deleted');
}
