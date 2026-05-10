import express from 'express';
import request from 'supertest';
import { bearer } from '../../../src/middleware/auth/bearer';

function buildApp(consumers: Record<string, string | undefined>, options: {
  blockedInEnvironment?: Record<string, string[]>;
  environment?: string;
} = {}) {
  const app = express();
  app.use(bearer({ consumers, ...options }));
  app.get('/test', (req, res) => {
    res.status(200).json({ consumer: req.consumer });
  });
  return app;
}

const PE_SECRET = 'pe-secret-abc';
const MS_SECRET = 'ms-secret-xyz';

describe('auth.bearer', () => {
  describe('valid tokens', () => {
    it('sets req.consumer and calls next for a known PE token', async () => {
      const app = buildApp({ PE: PE_SECRET });
      const res = await request(app).get('/test').set('Authorization', `Bearer ${PE_SECRET}`);
      expect(res.status).toBe(200);
      expect(res.body.consumer).toBe('PE');
    });

    it('sets req.consumer and calls next for a known MS token', async () => {
      const app = buildApp({ PE: PE_SECRET, MS: MS_SECRET });
      const res = await request(app).get('/test').set('Authorization', `Bearer ${MS_SECRET}`);
      expect(res.status).toBe(200);
      expect(res.body.consumer).toBe('MS');
    });
  });

  describe('invalid tokens', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const app = buildApp({ PE: PE_SECRET });
      const res = await request(app).get('/test');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing or malformed/);
    });

    it('returns 401 when Authorization header lacks Bearer prefix', async () => {
      const app = buildApp({ PE: PE_SECRET });
      const res = await request(app).get('/test').set('Authorization', PE_SECRET);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing or malformed/);
    });

    it('returns 401 for an unrecognised token', async () => {
      const app = buildApp({ PE: PE_SECRET });
      const res = await request(app).get('/test').set('Authorization', 'Bearer wrong-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid token/);
    });

    it('skips a consumer whose secret is undefined', async () => {
      const app = buildApp({ PE: undefined });
      const res = await request(app).get('/test').set('Authorization', 'Bearer anything');
      expect(res.status).toBe(401);
    });
  });

  describe('blockedInEnvironment', () => {
    it('returns 403 when the consumer is blocked in the current environment', async () => {
      const app = buildApp(
        { POSTMAN: 'postman-secret' },
        { blockedInEnvironment: { prod: ['POSTMAN'] }, environment: 'prod' }
      );
      const res = await request(app).get('/test').set('Authorization', 'Bearer postman-secret');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/POSTMAN/);
    });

    it('allows the consumer when the environment does not match the block list', async () => {
      const app = buildApp(
        { POSTMAN: 'postman-secret' },
        { blockedInEnvironment: { prod: ['POSTMAN'] }, environment: 'dev' }
      );
      const res = await request(app).get('/test').set('Authorization', 'Bearer postman-secret');
      expect(res.status).toBe(200);
      expect(res.body.consumer).toBe('POSTMAN');
    });

    it('allows the consumer when blockedInEnvironment is not set', async () => {
      const app = buildApp({ POSTMAN: 'postman-secret' });
      const res = await request(app).get('/test').set('Authorization', 'Bearer postman-secret');
      expect(res.status).toBe(200);
    });

    it('blocks consumers listed in multiple environments', async () => {
      const app = buildApp(
        { POSTMAN: 'postman-secret' },
        { blockedInEnvironment: { prod: ['POSTMAN'], stage: ['POSTMAN'] }, environment: 'stage' }
      );
      const res = await request(app).get('/test').set('Authorization', 'Bearer postman-secret');
      expect(res.status).toBe(403);
    });
  });
});
