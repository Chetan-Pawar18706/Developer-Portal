import request from 'supertest';
import { app } from '../app';
import { User } from '../models/user.model';
import { storageService } from '../services/storage.service';
import { bearerToken, createUser, defaultPassword } from './factories';
import { clearTestDatabase, startTestDatabase, stopTestDatabase } from './test-db';

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

afterEach(async () => {
  jest.restoreAllMocks();
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

describe('profile details', () => {
  it('updates work, skills and social profile fields', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({
        name: 'Raghav Shastri',
        jobTitle: 'Senior Full-stack Developer',
        company: 'Dev Portal',
        location: 'Pune, India',
        bio: 'I build reliable client-facing products.',
        skills: ['Angular', 'Node.js', 'Angular'],
        website: 'https://example.com',
        github: 'raghavshastri',
        linkedin: 'https://www.linkedin.com/in/raghavshastri',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      name: 'Raghav Shastri',
      jobTitle: 'Senior Full-stack Developer',
      company: 'Dev Portal',
      location: 'Pune, India',
      website: 'https://example.com',
      github: 'raghavshastri',
      linkedin: 'https://www.linkedin.com/in/raghavshastri',
    });
    expect(response.body.data.user.skills).toEqual(['Angular', 'Node.js']);

    const storedUser = await User.findById(user.id);
    expect(storedUser?.skills).toEqual(['Angular', 'Node.js']);
  });

  it('rejects unsafe social links', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({ github: 'javascript:alert(1)' });

    expect(response.status).toBe(422);
  });

  it('lets another authenticated user view a public developer profile', async () => {
    const viewer = await createUser({ email: 'viewer@example.com', role: 'client' });
    const developer = await createUser({ email: 'developer@example.com', role: 'developer' });

    await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(developer))
      .send({
        jobTitle: 'Backend Developer',
        skills: ['MongoDB'],
        github: 'dev-user',
      });

    const response = await request(app)
      .get(`/api/users/${developer.id}/profile`)
      .set('Authorization', bearerToken(viewer));

    expect(response.status).toBe(200);
    expect(response.body.data.profile).toMatchObject({
      id: developer.id,
      name: developer.name,
      role: 'developer',
      jobTitle: 'Backend Developer',
      skills: ['MongoDB'],
      github: 'dev-user',
    });
    expect(response.body.data.profile.email).toBeUndefined();
    expect(response.body.data.profile.bio).toBeNull();
  });

  it('returns 401 when an anonymous user requests a developer profile', async () => {
    const developer = await createUser({ email: 'developer@example.com', role: 'developer' });

    const response = await request(app).get(`/api/users/${developer.id}/profile`);

    expect(response.status).toBe(401);
  });
});

describe('profile pictures', () => {
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );

  it('uploads an avatar and serves it publicly', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });
    jest.spyOn(storageService, 'save').mockResolvedValue({
      storagePath: 'avatars/test-avatar.png',
      size: pngBuffer.length,
    });
    jest.spyOn(storageService, 'read').mockResolvedValue(pngBuffer);

    const upload = await request(app)
      .patch('/api/users/me/avatar')
      .set('Authorization', bearerToken(user))
      .attach('avatar', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' });

    expect(upload.status).toBe(200);
    expect(upload.body.data.user.avatar).toBe(`/api/users/${user.id}/avatar`);

    const download = await request(app).get(`/api/users/${user.id}/avatar`);

    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.body).toEqual(pngBuffer);
  });

  it('accepts an external avatar URL and clears the previous stored upload', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });

    await User.findByIdAndUpdate(user.id, {
      avatar: `/api/users/${user.id}/avatar`,
      avatarStoragePath: 'avatars/old-avatar.png',
      avatarMimeType: 'image/png',
    });
    const remove = jest.spyOn(storageService, 'remove').mockResolvedValue(undefined);

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({ avatar: 'https://cdn.example.com/profiles/raghav.png' });

    expect(response.status).toBe(200);
    expect(response.body.data.user.avatar).toBe('https://cdn.example.com/profiles/raghav.png');
    expect(remove).toHaveBeenCalledWith('avatars/old-avatar.png');

    const stored = await User.findById(user.id).select('+avatarStoragePath +avatarMimeType');
    expect(stored?.avatarStoragePath).toBeNull();
    expect(stored?.avatarMimeType).toBeNull();
  });

  it('rejects an avatar URL that does not use http or https', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', bearerToken(user))
      .send({ avatar: 'javascript:alert(1)' });

    expect(response.status).toBe(422);
  });

  it('rejects a non-image avatar upload', async () => {
    const user = await createUser({ email: 'me@example.com', role: 'developer' });

    const upload = await request(app)
      .patch('/api/users/me/avatar')
      .set('Authorization', bearerToken(user))
      .attach('avatar', Buffer.from('not an image'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      });

    expect(upload.status).toBe(415);
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
