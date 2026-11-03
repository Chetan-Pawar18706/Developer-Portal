import request from 'supertest';
import { app } from '../app';
import { User } from '../models/user.model';
import { REFRESH_COOKIE_NAME } from '../utils/cookies';
import { hashToken } from '../utils/token';
import { createUser, defaultPassword } from './factories';
import { clearTestDatabase, startTestDatabase, stopTestDatabase } from './test-db';

const newUser = {
  name: 'Jane Client',
  email: 'jane@example.com',
  password: defaultPassword,
};

function getRefreshCookie(response: request.Response): string {
  const setCookie: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie)
    ? (setCookie as string[])
    : typeof setCookie === 'string'
      ? [setCookie]
      : [];

  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );

  if (!refreshCookie) {
    throw new Error('Refresh cookie was not set');
  }

  return refreshCookie.split(';')[0];
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

describe('POST /api/auth/register', () => {
  it('registers a client and returns tokens', async () => {
    const response = await request(app).post('/api/auth/register').send(newUser);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      name: newUser.name,
      email: newUser.email,
      role: 'client',
      isActive: true,
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(typeof response.body.data.accessToken).toBe('string');
    expect(getRefreshCookie(response)).toContain(REFRESH_COOKIE_NAME);
  });

  it('ignores a client-supplied role and always creates a client', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...newUser, role: 'admin' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('client');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(newUser);
    const response = await request(app).post('/api/auth/register').send(newUser);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('returns validation errors for invalid input', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'J', email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('stores the password as a hash', async () => {
    await request(app).post('/api/auth/register').send(newUser);

    const user = await User.findOne({ email: newUser.email }).select('+passwordHash');

    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe(defaultPassword);
    await expect(user?.comparePassword(defaultPassword)).resolves.toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    await createUser({ email: newUser.email, password: defaultPassword });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: defaultPassword });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(newUser.email);
    expect(typeof response.body.data.accessToken).toBe('string');
    expect(getRefreshCookie(response)).toContain(REFRESH_COOKIE_NAME);
  });

  it('rejects a wrong password with 401', async () => {
    await createUser({ email: newUser.email, password: defaultPassword });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: 'WrongPassword123!' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('rejects an unknown email with 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: defaultPassword });

    expect(response.status).toBe(401);
  });

  it('blocks an inactive user', async () => {
    await createUser({ email: newUser.email, password: defaultPassword, isActive: false });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: defaultPassword });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Account is deactivated');
  });

  it('returns a validation error when the password is missing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(newUser);
    const accessToken = registerResponse.body.data.accessToken as string;

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(newUser.email);
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it('requires an access token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
  });

  it('rejects an invalid access token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and invalidates the previous one', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(newUser);
    const firstRefreshCookie = getRefreshCookie(registerResponse);

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstRefreshCookie);

    expect(refreshResponse.status).toBe(200);
    expect(typeof refreshResponse.body.data.accessToken).toBe('string');

    const secondRefreshCookie = getRefreshCookie(refreshResponse);
    expect(secondRefreshCookie).not.toBe(firstRefreshCookie);

    const reuseResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', firstRefreshCookie);

    expect(reuseResponse.status).toBe(401);
  });

  it('rejects a request without a refresh cookie', async () => {
    const response = await request(app).post('/api/auth/refresh');

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh cookie and invalidates the session', async () => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(newUser);
    const refreshCookie = getRefreshCookie(registerResponse);

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie);

    expect(logoutResponse.status).toBe(200);
    const clearedCookie = String(logoutResponse.headers['set-cookie'] ?? '');
    expect(clearedCookie).toContain(`${REFRESH_COOKIE_NAME}=;`);

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refreshResponse.status).toBe(401);
  });
});

describe('password reset', () => {
  it('stores a reset token and responds generically for a known email', async () => {
    const user = await createUser({ email: newUser.email });

    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });

    expect(response.status).toBe(200);

    const updatedUser = await User.findById(user.id).select(
      '+resetTokenHash +resetTokenExpires',
    );

    expect(updatedUser?.resetTokenHash).toBeTruthy();
    expect(updatedUser?.resetTokenExpires?.getTime() ?? 0).toBeGreaterThan(Date.now());
  });

  it('does not reveal whether an email exists', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'missing@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('resets the password with a valid token', async () => {
    const user = await createUser({ email: newUser.email });
    const rawToken = 'a'.repeat(64);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetTokenHash: hashToken(rawToken),
          resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    );

    const resetResponse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'NewPassword123!' });

    expect(resetResponse.status).toBe(200);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NewPassword123!' });

    expect(loginResponse.status).toBe(200);
  });

  it('rejects an invalid reset token', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'b'.repeat(64), password: 'NewPassword123!' });

    expect(response.status).toBe(400);
  });
});
