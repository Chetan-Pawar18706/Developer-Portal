import path from 'node:path';
import multer from 'multer';
import {
  FILE_EXTENSIONS,
  FILE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../models/file.model';
import { ApiError } from '../utils/ApiError';

const allowedMimeTypes = new Set<string>(FILE_MIME_TYPES);
const allowedExtensions = new Set<string>(FILE_EXTENSIONS);

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile?: boolean) => void,
): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (!allowedExtensions.has(extension)) {
    callback(
      new ApiError(
        415,
        `Unsupported file extension "${extension || 'none'}". Allowed: ${FILE_EXTENSIONS.join(', ')}.`,
      ),
    );
    return;
  }

  if (!allowedMimeTypes.has(mimeType)) {
    callback(
      new ApiError(
        415,
        `Unsupported MIME type "${mimeType}". Allowed: PDF, PNG, JPG, DOCX, XLSX, ZIP and TXT files.`,
      ),
    );
    return;
  }

  callback(null, true);
}

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 20,
  },
});

const avatarMimeTypes = new Set(['image/png', 'image/jpeg']);
const avatarExtensions = new Set(['.png', '.jpg', '.jpeg']);
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

function avatarFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile?: boolean) => void,
): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (!avatarExtensions.has(extension) || !avatarMimeTypes.has(mimeType)) {
    callback(new ApiError(415, 'Profile picture must be a PNG or JPEG image.'));
    return;
  }

  callback(null, true);
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: AVATAR_MAX_SIZE_BYTES,
    files: 1,
  },
});
