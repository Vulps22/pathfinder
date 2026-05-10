import express from 'express';
import request from 'supertest';
import { createHmac } from 'crypto';
import { hmac } from '../../../src/middleware/auth/hmac';
import { rawBody } from '../../../src/middleware/body';

const SECRET = 'test-secret';
const HEADER = 'x-signature';

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(Buffer.from(body)).digest('hex');
}

function buildApp(parseSignature?: (v: string) => string) {
  const app = express();
  app.use(rawBody());
  app.use(hmac({ secret: SECRET, header: HEADER, parseSignature }));
  app.post('/test', (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('auth.hmac', () => {
  const body = JSON.stringify({ event: 'vote' });

  describe('valid signatures', () => {
    it('calls next when signature matches', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .set(HEADER, sign(body))
        .send(body);
      expect(res.status).toBe(200);
    });

    it('uses parseSignature to extract hash from compound header format', async () => {
      const app = buildApp((v) => v.split(',v1=')[1]);
      const sig = `t=1234567890,v1=${sign(body)}`;
      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .set(HEADER, sig)
        .send(body);
      expect(res.status).toBe(200);
    });
  });

  describe('invalid signatures', () => {
    it('returns 401 when signature header is missing', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send(body);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing x-signature header/);
    });

    it('returns 401 when signature does not match', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .set(HEADER, 'deadbeef')
        .send(body);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid signature/);
    });

    it('returns 401 when body changes after signing', async () => {
      const app = buildApp();
      const sig = sign(body);
      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .set(HEADER, sig)
        .send(JSON.stringify({ event: 'tampered' }));
      expect(res.status).toBe(401);
    });
  });

  describe('body parsing guard', () => {
    it('returns 400 when rawBody() middleware is not used', async () => {
      const app = express();
      app.use(express.json());
      app.use(hmac({ secret: SECRET, header: HEADER }));
      app.post('/test', (req, res) => { res.status(200).json({ ok: true }); });

      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .set(HEADER, sign(body))
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/rawBody\(\)/);
    });
  });
});
