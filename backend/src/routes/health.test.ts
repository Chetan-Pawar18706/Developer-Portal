import request from 'supertest';
import { app } from '../app';

describe('GET /api/health', () => {
  it('returns a successful health response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok' },
      message: 'API is healthy',
    });
    expect(typeof response.body.data.timestamp).toBe('string');
  });

  it('returns a structured 404 response for unknown routes', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
    });
  });
});
