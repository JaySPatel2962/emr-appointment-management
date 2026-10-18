import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '#app/app.js';

import { bodyOf } from '../helpers/http.js';

const app = createApp();
const CLIENT_URL = 'http://localhost:5173';

describe('GET /api/v1/health', () => {
  it('reports a healthy service when the database is connected', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(bodyOf(res)).toMatchObject({
      success: true,
      message: 'Service is healthy',
      data: { status: 'ok', database: 'up' },
      meta: {},
    });
  });
});

describe('error responses', () => {
  it('returns 404 in the standard envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(bodyOf(res)).toMatchObject({
      success: false,
      message: 'Route not found: GET /api/v1/does-not-exist',
      data: null,
    });
    expect(bodyOf(res).meta.requestId).toBe(res.get('X-Request-Id'));
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(bodyOf(res).message).toBe('Malformed JSON in request body');
  });

  it('rejects a deeply nested body with 400, not a 500', async () => {
    const depth = 20_000;
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Content-Type', 'application/json')
      .send(`${'['.repeat(depth)}${']'.repeat(depth)}`);

    expect(res.status).toBe(400);
    expect(bodyOf(res)).toMatchObject({
      success: false,
      message: 'Request body is nested too deeply',
      data: null,
    });
  });

  it('rejects a body over the size limit with 413', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .send({ blob: 'x'.repeat(200 * 1024) });

    expect(res.status).toBe(413);
    expect(bodyOf(res).message).toBe('Request body is too large');
  });
});

describe('request ids', () => {
  it('echoes a safe incoming X-Request-Id', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-123');

    expect(res.get('X-Request-Id')).toBe('trace-123');
  });

  it('replaces an unsafe incoming X-Request-Id with a generated UUID', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'not safe\tid');

    expect(res.get('X-Request-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('security headers and CORS', () => {
  it('sets helmet headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.get('X-Powered-By')).toBeUndefined();
  });

  it('allows credentialed CORS requests from CLIENT_URL only', async () => {
    const preflight = (origin: string) =>
      request(app)
        .options('/api/v1/health')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET');

    const allowed = await preflight(CLIENT_URL);
    expect(allowed.get('Access-Control-Allow-Origin')).toBe(CLIENT_URL);
    expect(allowed.get('Access-Control-Allow-Credentials')).toBe('true');

    const blocked = await preflight('https://evil.example');
    expect(blocked.get('Access-Control-Allow-Origin')).toBeUndefined();
  });
});
