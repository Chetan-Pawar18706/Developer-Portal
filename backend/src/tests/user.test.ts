import request from 'supertest';
import { app } from '../app';
import { User } from '../models/user.model';
import { bearerToken, createUser, defaultPassword } from './factories';
import { clearTestDatabase, startTestDatabase, stopTestDatabase } from './test-db';

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
});

describe('user admin permissions', () => {
  it('returns 401 when no access token is provided', async () => {
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(401);
  });

  it('returns 403 when a client lists users', async () => {
    const client = await createUser({ email: 'client@example.com', role: 'client' });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', bearerToken(client));

    expect(response.status).toBe(403);
  });

  it('returns 403 when a pm lists users', async () => {
    const pm = await createUser({ email: 'pm@example.com', role: 'pm' });

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', bearerToken(pm));

    expect(response.status).toBe(403);
  });
});

describe('GET /api/users', () => {
  it('searches, filters, paginates and sorts users', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'admin' });
    await createUser({ name: 'Dev One', email: 'dev1@example.com', role: 'developer' });
    await createUser({ name: 'Dev Two', email: 'dev2@example.com', role: 'developer' });
    await createUser({
      name: 'Inactive Dev',
      email: 'inactive@example.com',
      role: 'developer',
      isActive: false,
    });
    await createUser({ name: 'Client One', email: 'client@example.com', role: 'client' });

    const response = await request(app)
      .get(
        '/api/users?role=developer&isActive=true&search=dev&page=1&limit=1&sortBy=email&sortOrder=asc',
      )
      .set('Authorization', bearerToken(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.limit).toBe(1);
    expect(response.body.data.data).toHaveLength(1);
    expect(response.body.data.data[0].email).toBe('dev1@example.com');
  });

  it('rejects invalid list query parameters', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const response = await request(app)
      .get('/api/users?role=invalid-role')
      .set('Authorization', bearerToken(admin));

    expect(response.status).toBe(422);
  });
});

describe('POST /api/users', () => {
  it('lets an admin create a user with any role', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', bearerToken(admin))
      .send({
        name: 'New Manager',
        email: 'newpm@example.com',
        password: 'Password123!',
        role: 'pm',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('pm');
    expect(response.body.data.user.passwordHash).toBeUndefined();

    const storedUser = await User.findOne({ email: 'newpm@example.com' }).select(
      '+passwordHash',
    );
    expect(storedUser?.passwordHash).not.toBe('Password123!');
  });

  it('rejects a duplicate email with 409', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    await createUser({ email: 'existing@example.com' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', bearerToken(admin))
      .send({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'Password123!',
        role: 'developer',
      });

    expect(response.status).toBe(409);
  });

  it('returns 403 when a non-admin creates a user', async () => {
    const pm = await createUser({ email: 'pm@example.com', role: 'pm' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', bearerToken(pm))
      .send({
        name: 'Another User',
        email: 'another@example.com',
        password: 'Password123!',
        role: 'developer',
      });

    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('lets an admin change another user role', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const target = await createUser({ email: 'target@example.com', role: 'client' });

    const response = await request(app)
      .patch(`/api/users/${target.id}/role`)
      .set('Authorization', bearerToken(admin))
      .send({ role: 'developer' });

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe('developer');

    const storedUser = await User.findById(target.id);
    expect(storedUser?.role).toBe('developer');
  });

  it('rejects self-demotion', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const response = await request(app)
      .patch(`/api/users/${admin.id}/role`)
      .set('Authorization', bearerToken(admin))
      .send({ role: 'developer' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    const storedUser = await User.findById(admin.id);
    expect(storedUser?.role).toBe('admin');
  });

  it('returns 404 for an unknown user', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const response = await request(app)
      .patch('/api/users/000000000000000000000000/role')
      .set('Authorization', bearerToken(admin))
      .send({ role: 'developer' });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/users/:id/status', () => {
  it('lets an admin deactivate another user', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const target = await createUser({ email: 'target@example.com', role: 'developer' });

    const response = await request(app)
      .patch(`/api/users/${target.id}/status`)
      .set('Authorization', bearerToken(admin))
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.user.isActive).toBe(false);
  });

  it('rejects self-deactivation', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const response = await request(app)
      .patch(`/api/users/${admin.id}/status`)
      .set('Authorization', bearerToken(admin))
      .send({ isActive: false });

    expect(response.status).toBe(400);

    const storedUser = await User.findById(admin.id);
    expect(storedUser?.isActive).toBe(true);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the profile name and notification preferences', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({
        name: 'Updated Name',
        notificationPrefs: { emailOnAssignment: false },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.name).toBe('Updated Name');
    expect(response.body.data.user.notificationPrefs).toMatchObject({
      emailOnAssignment: false,
      emailOnMention: true,
      emailOnStatusChange: true,
      emailOnReminder: true,
    });
  });

  it('rejects an empty profile payload', async () => {
    const user = await createUser({ email: 'me@example.com' });

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({});

    expect(response.status).toBe(422);
  });
});

describe('PATCH /api/users/me/password', () => {
  it('changes the password and invalidates the old one', async () => {
    const user = await createUser({ email: 'me@example.com' });
    const newPassword = 'NewPassword123!';

    const response = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', bearerToken(user))
      .send({ currentPassword: defaultPassword, newPassword });

    expect(response.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: defaultPassword });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const user = await createUser({ email: 'me@example.com' });

    const response = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', bearerToken(user))
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewPassword123!' });

    expect(response.status).toBe(400);
  });
});

describe('GET /api/users/lookup', () => {
  it('returns active pms and developers for a pm', async () => {
    const pm = await createUser({ name: 'PM', email: 'pm@example.com', role: 'pm' });
    await createUser({ name: 'Dev One', email: 'dev1@example.com', role: 'developer' });
    await createUser({ name: 'Dev Two', email: 'dev2@example.com', role: 'developer' });
    await createUser({ name: 'Client', email: 'client@example.com', role: 'client' });
    await createUser({
      name: 'Inactive Dev',
      email: 'inactive@example.com',
      role: 'developer',
      isActive: false,
    });

    const response = await request(app)
      .get('/api/users/lookup?role=developer,pm')
      .set('Authorization', bearerToken(pm));

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(3);
    expect(
      response.body.data.users.every(
        (user: { role: string }) => user.role === 'pm' || user.role === 'developer',
      ),
    ).toBe(true);
  });

  it('returns 403 for a client', async () => {
    const client = await createUser({ email: 'client@example.com', role: 'client' });

    const response = await request(app)
      .get('/api/users/lookup')
      .set('Authorization', bearerToken(client));

    expect(response.status).toBe(403);
  });
});
