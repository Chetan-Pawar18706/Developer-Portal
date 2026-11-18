import request from 'supertest';
import { app } from '../app';
import { File } from '../models/file.model';
import { Project, type ProjectDocument } from '../models/project.model';
import type { UserDocument } from '../models/user.model';
import { bearerToken, createUser } from '../tests/factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/test-db';

let client: UserDocument;
let pm: UserDocument;
let project: ProjectDocument;

function auth(user: UserDocument): string {
  return bearerToken(user);
}

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
});

beforeEach(async () => {
  client = await createUser({
    email: 'files-client@example.com',
    role: 'client',
    name: 'Files Client',
  });
  pm = await createUser({
    email: 'files-pm@example.com',
    role: 'pm',
    name: 'Files PM',
  });

  project = await Project.create({
    title: 'File storage project',
    description: 'A project used to verify file uploads and visibility.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
    ],
  });
});

describe('/api/projects/:id/files', () => {
  it('uploads an allowed file and lists it with folder filtering', async () => {
    const upload = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm))
      .field('folder', 'deliverables')
      .field('isInternal', 'false')
      .attach('files', Buffer.from('%PDF-1.4 test document'), {
        filename: 'delivery.pdf',
        contentType: 'application/pdf',
      });

    expect(upload.status).toBe(201);
    expect(upload.body.data.files).toHaveLength(1);
    expect(upload.body.data.files[0].folder).toBe('deliverables');
    expect(upload.body.data.files[0].version).toBe(1);

    const listed = await request(app)
      .get(`/api/projects/${project.id}/files`)
      .query({ folder: 'deliverables' })
      .set('Authorization', auth(client));

    expect(listed.status).toBe(200);
    expect(listed.body.data.data).toHaveLength(1);
    expect(listed.body.data.data[0].originalName).toBe('delivery.pdf');
  });

  it('rejects disallowed MIME types and extensions with a clear message', async () => {
    const badMime = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm))
      .attach('files', Buffer.from('binary'), {
        filename: 'script.exe',
        contentType: 'application/octet-stream',
      });

    expect(badMime.status).toBe(415);
    expect(badMime.body.message).toContain('Unsupported file extension');

    const mismatched = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm))
      .attach('files', Buffer.from('<script>alert(1)</script>'), {
        filename: 'notes.pdf',
        contentType: 'text/html',
      });

    expect(mismatched.status).toBe(415);
    expect(mismatched.body.message).toContain('Unsupported MIME type');
  });

  it('hides internal files from clients in lists and downloads', async () => {
    const file = await File.create({
      project: project._id,
      name: 'internal-notes.txt',
      originalName: 'internal-notes.txt',
      mimeType: 'text/plain',
      size: 18,
      storagePath: 'other/internal-notes.txt',
      folder: 'other',
      uploadedBy: pm._id,
      isInternal: true,
      version: 1,
      versions: [],
    });

    const listed = await request(app)
      .get(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(client));

    expect(listed.status).toBe(200);
    expect(listed.body.data.data).toEqual([]);

    const downloaded = await request(app)
      .get(`/api/files/${file.id}/download`)
      .set('Authorization', auth(client));

    expect(downloaded.status).toBe(404);

    const staffList = await request(app)
      .get(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm));

    expect(staffList.body.data.data).toHaveLength(1);
    expect(staffList.body.data.data[0].isInternal).toBe(true);
  });

  it('allows the uploader to upload an internal file for staff only', async () => {
    const upload = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm))
      .field('isInternal', 'true')
      .attach('files', Buffer.from('Review notes'), {
        filename: 'review.txt',
        contentType: 'text/plain',
      });

    expect(upload.status).toBe(201);
    expect(upload.body.data.files[0].isInternal).toBe(true);
  });
});
