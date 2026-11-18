import request from 'supertest';
import { app } from '../app';
import { Project } from '../models/project.model';
import { Task } from '../models/task.model';
import type { UserDocument } from '../models/user.model';
import { REFRESH_COOKIE_NAME } from '../utils/cookies';
import { signRefreshToken } from '../utils/token';
import {
  bearerToken,
  createComment,
  createFile,
  createIssue,
  createProject,
  createTask,
  createUser,
  defaultPassword,
} from './factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from './test-db';

let client: UserDocument;
let otherClient: UserDocument;
let pm: UserDocument;
let developer: UserDocument;
let otherDeveloper: UserDocument;
let admin: UserDocument;
let project: Awaited<ReturnType<typeof createProject>>;
let otherProject: Awaited<ReturnType<typeof createProject>>;

function auth(user: UserDocument): string {
  return bearerToken(user);
}

function setCookies(response: request.Response): string[] {
  const header: unknown = response.headers['set-cookie'];

  if (Array.isArray(header)) {
    return header as string[];
  }

  return typeof header === 'string' ? [header] : [];
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
    email: 'security-client@example.com',
    role: 'client',
    name: 'Security Client',
  });
  otherClient = await createUser({
    email: 'security-other-client@example.com',
    role: 'client',
    name: 'Other Client',
  });
  pm = await createUser({
    email: 'security-pm@example.com',
    role: 'pm',
    name: 'Security PM',
  });
  developer = await createUser({
    email: 'security-developer@example.com',
    role: 'developer',
    name: 'Security Developer',
  });
  otherDeveloper = await createUser({
    email: 'security-other-developer@example.com',
    role: 'developer',
    name: 'Other Developer',
  });
  admin = await createUser({
    email: 'security-admin@example.com',
    role: 'admin',
    name: 'Security Admin',
  });

  project = await createProject({
    client,
    members: [
      { user: client, role: 'client' },
      { user: pm, role: 'pm' },
      { user: developer, role: 'developer' },
      { user: otherDeveloper, role: 'developer' },
    ],
  });
  otherProject = await createProject({
    title: 'Another client project',
    client: otherClient,
  });
});

describe('authentication hardening', () => {
  it('rejects a refresh token used as a bearer credential', async () => {
    const token = signRefreshToken(client.id, client.role);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('uses the current database role and rejects deactivated users', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: client.email,
      password: defaultPassword,
    });
    const token = login.body.data.accessToken as string;

    const roleChange = await request(app)
      .patch(`/api/users/${client.id}/role`)
      .set('Authorization', auth(admin))
      .send({ role: 'admin' });

    expect(roleChange.status).toBe(200);

    const elevated = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${token}`);

    expect(elevated.status).toBe(200);

    const deactivation = await request(app)
      .patch(`/api/users/${client.id}/status`)
      .set('Authorization', auth(admin))
      .send({ isActive: false });

    expect(deactivation.status).toBe(200);

    const rejected = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(rejected.status).toBe(401);
  });

  it('sets hardened refresh-cookie attributes on login', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: client.email,
      password: defaultPassword,
    });

    expect(response.status).toBe(200);

    const cookie = setCookies(response).find((value) =>
      value.startsWith(`${REFRESH_COOKIE_NAME}=`),
    );

    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('Max-Age');
  });
});

describe('route authorization and project isolation', () => {
  it('prevents a client from reading another client project', async () => {
    const own = await request(app)
      .get(`/api/projects/${project.id}`)
      .set('Authorization', auth(client));
    const foreign = await request(app)
      .get(`/api/projects/${otherProject.id}`)
      .set('Authorization', auth(client));
    const list = await request(app)
      .get('/api/projects')
      .set('Authorization', auth(client));

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
    expect(
      (list.body.data.data as Array<{ id: string }>).some(
        (item) => item.id === otherProject.id,
      ),
    ).toBe(false);
  });

  it('enforces role gates on task creation and the admin dashboard', async () => {
    const clientCreatesTask = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set('Authorization', auth(client))
      .send({ title: 'Client made task' });
    const clientDashboard = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', auth(client));
    const adminDashboard = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', auth(admin));

    expect(clientCreatesTask.status).toBe(403);
    expect(clientDashboard.status).toBe(403);
    expect(adminDashboard.status).toBe(200);
  });

  it('stops a developer from moving a task assigned to someone else', async () => {
    const task = await createTask({
      project,
      reporter: pm,
      title: 'Other developer task',
      assignee: otherDeveloper,
    });

    const response = await request(app)
      .patch(`/api/tasks/${task.id}/move`)
      .set('Authorization', auth(developer))
      .send({ status: 'in_progress', order: 0 });

    expect(response.status).toBe(403);
  });
});

describe('task move ordering', () => {
  it('reorders sibling tasks through the API', async () => {
    const first = await createTask({ project, reporter: pm, title: 'First', order: 0 });
    const second = await createTask({ project, reporter: pm, title: 'Second', order: 1 });
    const third = await createTask({ project, reporter: pm, title: 'Third', order: 2 });

    const moved = await request(app)
      .patch(`/api/tasks/${third.id}/move`)
      .set('Authorization', auth(pm))
      .send({ status: 'todo', order: 0 });

    expect(moved.status).toBe(200);

    const ordered = await Task.find({ project: project._id, status: 'todo' }).sort({ order: 1 });

    expect(ordered.map((task) => task.title)).toEqual([
      third.title,
      first.title,
      second.title,
    ]);
  });
});

describe('internal comment and file visibility', () => {
  it('hides internal files from client lists and downloads', async () => {
    const internal = await createFile({ project, uploadedBy: pm, name: 'internal.txt', isInternal: true });
    const publicFile = await createFile({ project, uploadedBy: pm, name: 'public.txt' });

    const clientList = await request(app)
      .get('/api/files')
      .query({ projectId: project.id })
      .set('Authorization', auth(client));
    const clientGlobal = await request(app)
      .get('/api/files')
      .set('Authorization', auth(client));
    const download = await request(app)
      .get(`/api/files/${internal.id}/download`)
      .set('Authorization', auth(client));
    const staffList = await request(app)
      .get('/api/files')
      .query({ projectId: project.id })
      .set('Authorization', auth(pm));

    const clientIds = (clientList.body.data.data as Array<{ id: string }>).map(
      (file) => file.id,
    );
    const globalIds = (clientGlobal.body.data.data as Array<{ id: string }>).map(
      (file) => file.id,
    );
    const staffIds = (staffList.body.data.data as Array<{ id: string }>).map(
      (file) => file.id,
    );

    expect(clientIds).toEqual([publicFile.id]);
    expect(globalIds).toEqual([publicFile.id]);
    expect(download.status).toBe(404);
    expect(staffIds).toContain(internal.id);
  });

  it('hides internal comments from global client results', async () => {
    const internal = await createComment({
      project,
      author: pm,
      text: 'Internal note',
      isInternal: true,
    });
    const publicComment = await createComment({
      project,
      author: pm,
      text: 'Public note',
    });

    const clientList = await request(app)
      .get('/api/comments/global')
      .query({ projectId: project.id })
      .set('Authorization', auth(client));
    const staffList = await request(app)
      .get('/api/comments/global')
      .query({ projectId: project.id })
      .set('Authorization', auth(pm));

    const clientIds = (clientList.body.data.data as Array<{ id: string }>).map(
      (comment) => comment.id,
    );
    const staffIds = (staffList.body.data.data as Array<{ id: string }>).map(
      (comment) => comment.id,
    );

    expect(clientIds).toEqual([publicComment.id]);
    expect(staffIds).toContain(internal.id);
  });

  it('blocks clients from attaching internal files to comments', async () => {
    const internal = await createFile({
      project,
      uploadedBy: pm,
      name: 'secret.txt',
      isInternal: true,
    });

    const response = await request(app)
      .post('/api/comments')
      .set('Authorization', auth(client))
      .send({
        entityType: 'project',
        entityId: project.id,
        text: 'Please review this secret file',
        fileIds: [internal.id],
      });

    expect(response.status).toBe(400);
  });
});

describe('upload validation', () => {
  it('rejects unsupported extensions', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm))
      .attach('files', Buffer.from('binary'), {
        filename: 'payload.exe',
        contentType: 'application/octet-stream',
      });

    expect(response.status).toBe(415);
    expect(response.body.message).toContain('Unsupported file extension');
  });

  it('rejects files larger than the configured limit', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(pm))
      .attach('files', Buffer.alloc(25 * 1024 * 1024 + 1), {
        filename: 'huge.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('25 MB');
  });

  it('forces client uploads to be public', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/files`)
      .set('Authorization', auth(client))
      .field('isInternal', 'true')
      .attach('files', Buffer.from('Public by policy'), {
        filename: 'client-upload.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.files[0].isInternal).toBe(false);
  });

  it('validates new-version notes and increments the version', async () => {
    const file = await createFile({ project, uploadedBy: pm, name: 'versioned.txt' });

    const invalid = await request(app)
      .post(`/api/files/${file.id}/new-version`)
      .set('Authorization', auth(pm))
      .field('note', 'x'.repeat(2001))
      .attach('file', Buffer.from('Updated content'), {
        filename: 'versioned.txt',
        contentType: 'text/plain',
      });

    expect(invalid.status).toBe(422);

    const valid = await request(app)
      .post(`/api/files/${file.id}/new-version`)
      .set('Authorization', auth(pm))
      .field('note', 'Updated notes')
      .attach('file', Buffer.from('Updated content'), {
        filename: 'versioned.txt',
        contentType: 'text/plain',
      });

    expect(valid.status).toBe(201);
    expect(valid.body.data.file.version).toBe(2);
    expect(valid.body.data.file.versions[0].storagePath).toBeUndefined();
  });
});

describe('delivery sign-off rules', () => {
  it('signs off a ready project with a rating', async () => {
    await Project.updateOne({ _id: project._id }, { status: 'active' });

    const response = await request(app)
      .patch(`/api/projects/${project.id}/sign-off`)
      .set('Authorization', auth(client))
      .send({ rating: 5, feedback: 'Excellent delivery' });

    expect(response.status).toBe(200);

    const saved = await Project.findById(project.id);

    expect(saved?.status).toBe('completed');
    expect(saved?.deliverySignOff.rating).toBe(5);
  });

  it('blocks sign-off while tasks or critical issues are open', async () => {
    await createTask({ project, reporter: pm, title: 'Unfinished task' });

    const withTask = await request(app)
      .patch(`/api/projects/${project.id}/sign-off`)
      .set('Authorization', auth(client))
      .send({ rating: 5 });

    expect(withTask.status).toBe(409);
    expect(withTask.body.message).toContain('1 task is still incomplete');

    await Task.deleteMany({ project: project._id });
    await createIssue({ project, raisedBy: client, severity: 'critical' });

    const withIssue = await request(app)
      .patch(`/api/projects/${project.id}/sign-off`)
      .set('Authorization', auth(client))
      .send({ rating: 5 });

    expect(withIssue.status).toBe(409);
    expect(withIssue.body.message).toContain('critical issue');
  });

  it('rejects staff sign-off and invalid ratings', async () => {
    const staff = await request(app)
      .patch(`/api/projects/${project.id}/sign-off`)
      .set('Authorization', auth(pm))
      .send({ rating: 5 });
    const invalidRating = await request(app)
      .patch(`/api/projects/${project.id}/sign-off`)
      .set('Authorization', auth(client))
      .send({ rating: 6 });

    expect(staff.status).toBe(403);
    expect(invalidRating.status).toBe(422);
  });
});

describe('injection, sanitisation and response hardening', () => {
  it('rejects NoSQL operator objects in query parameters', async () => {
    const response = await request(app)
      .get('/api/projects')
      .query({ 'search[$ne]': '' })
      .set('Authorization', auth(client));

    expect([400, 422]).toContain(response.status);
  });

  it('ignores privileged fields on project creation', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', auth(client))
      .send({
        title: 'Mass assignment project',
        description: 'A project that tries to set privileged fields.',
        clientId: otherClient.id,
        status: 'completed',
        health: 'off_track',
        deliverySignOff: { rating: 5, signedAt: new Date().toISOString() },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.project.status).toBe('draft');
    expect(response.body.data.project.health).toBe('on_track');
    expect(response.body.data.project.client.id).toBe(client.id);
    expect(response.body.data.project.deliverySignOff.rating).toBeNull();
  });

  it('sanitises rich text and rejects unsafe attachment URLs', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/requirements`)
      .set('Authorization', auth(client))
      .send({
        title: 'Secure rich text requirement',
        description:
          '<p>Hello <strong>team</strong><script>alert(1)</script><img src=x onerror=alert(1)></p>',
      });
    const unsafe = await request(app)
      .post(`/api/projects/${project.id}/requirements`)
      .set('Authorization', auth(client))
      .send({
        title: 'Unsafe attachment requirement',
        description: 'A requirement with a dangerous attachment URL.',
        attachments: [{ name: 'payload', url: 'javascript:alert(1)' }],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.requirement.description).toContain('<strong>team</strong>');
    expect(created.body.data.requirement.description).not.toContain('<script');
    expect(created.body.data.requirement.description).not.toContain('onerror');
    expect(unsafe.status).toBe(422);
  });

  it('sets security headers, disables caching, and hides route details', async () => {
    const health = await request(app).get('/api/health');
    const missing = await request(app).get('/api/does-not-exist');

    expect(health.headers['cache-control']).toContain('no-store');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Route not found');
  });
});
