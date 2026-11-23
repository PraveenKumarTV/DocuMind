process.env.GEMINI_API_KEY='test';
const request = require('supertest');
const app = require('../backend/server');

describe('backend endpoints', () => {
  test('returns 400 for chat missing question', async () => {
    const response = await request(app).post('/api/chat').send({});
    expect(response.status).toBe(400);
  });
  test('lists documents', async () => {
    const response = await request(app).get('/api/documents');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  test('unknown route returns 404', async () => {
    const response = await request(app).get('/api/missing');
    expect(response.status).toBe(404);
  });
});
