import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalDiskStorage } from './storage.service';

let root: string;
let storage: LocalDiskStorage;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'devportal-storage-'));
  storage = new LocalDiskStorage(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('LocalDiskStorage path validation', () => {
  it.each(['../secret.txt', 'other/../../secret.txt', '/etc/passwd', 'other/./file.txt'])(
    'rejects traversal-style path %s',
    async (storagePath) => {
      await expect(storage.read(storagePath)).rejects.toThrow('Invalid storage path');
      await expect(storage.remove(storagePath)).rejects.toThrow('Invalid storage path');
    },
  );

  it('reads files saved through the normal storage path', async () => {
    const saved = await storage.save({
      buffer: Buffer.from('safe content'),
      originalName: 'notes.txt',
      folder: 'other',
    });
    await writeFile(path.join(root, 'secret.txt'), 'outside content');

    await expect(storage.read(saved.storagePath)).resolves.toEqual(Buffer.from('safe content'));
    await expect(storage.read('../secret.txt')).rejects.toThrow('Invalid storage path');
  });
});
