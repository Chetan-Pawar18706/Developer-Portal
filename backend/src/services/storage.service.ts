import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  FILE_EXTENSIONS,
  type FileFolder,
} from '../models/file.model';
import { ApiError } from '../utils/ApiError';

export const AVATAR_FOLDER = 'avatars' as const;

export interface SaveFileInput {
  buffer: Buffer;
  originalName: string;
  folder: FileFolder | typeof AVATAR_FOLDER;
}

export interface StoredFile {
  storagePath: string;
  size: number;
}

export interface StorageService {
  save(input: SaveFileInput): Promise<StoredFile>;
  read(storagePath: string): Promise<Buffer>;
  remove(storagePath: string): Promise<void>;
}

export class LocalDiskStorage implements StorageService {
  private readonly root: string;

  constructor(rootDirectory?: string) {
    this.root = path.resolve(
      rootDirectory ?? path.join(__dirname, '..', '..', 'uploads'),
    );
  }

  private resolvePath(storagePath: string): string {
    if (
      typeof storagePath !== 'string' ||
      storagePath.length === 0 ||
      path.isAbsolute(storagePath) ||
      storagePath.split(/[\\/]/).some((part) => part === '..' || part === '.')
    ) {
      throw new ApiError(400, 'Invalid storage path');
    }

    const resolved = path.resolve(this.root, storagePath);

    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new ApiError(400, 'Invalid storage path');
    }

    return resolved;
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const baseName = path.basename(input.originalName);
    const extension = path.extname(baseName).toLowerCase();

    if (!FILE_EXTENSIONS.includes(extension as (typeof FILE_EXTENSIONS)[number])) {
      throw new ApiError(415, 'Unsupported file extension');
    }

    const storagePath = path.posix.join(input.folder, `${randomUUID()}${extension}`);
    const destination = this.resolvePath(storagePath);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, input.buffer);

    return { storagePath, size: input.buffer.length };
  }

  async read(storagePath: string): Promise<Buffer> {
    try {
      return await readFile(this.resolvePath(storagePath));
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'ENOENT') {
        throw new ApiError(404, 'Stored file not found');
      }

      throw error;
    }
  }

  async remove(storagePath: string): Promise<void> {
    try {
      await unlink(this.resolvePath(storagePath));
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export const storageService: StorageService = new LocalDiskStorage();
