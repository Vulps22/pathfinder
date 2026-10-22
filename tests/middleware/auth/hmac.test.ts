import express from 'express';
import request from 'supertest';
import { createHmac } from 'crypto';
import { hmac } from '../../../src/middleware/auth/hmac';
import { rawBody } from '../../../src/middleware/body';
import { errorHandler } from '../../../src/handlers/errors';
import type { HmacReplayOptions } from '../../../src/middleware/auth/hmac';

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
  app.use(errorHandler);
  return app;
}

describe('auth.hmac', () => {
  const body = JSON.stringify({ event: 'vote' });
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('replay setting warning', () => {
    it('warns once at creation when replay is not set', async () => {
      const app = buildApp();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/created without replay protection/);

      await request(app).post('/test').set('Content-Type', 'application/json').set(HEADER, sign(body)).send(body);
      await request(app).post('/test').set('Content-Type', 'application/json').set(HEADER, sign(body)).send(body);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('stays silent when replay is false', () => {
      hmac({ secret: SECRET, header: HEADER, replay: false });
      expect(warn).not.toHaveBeenCalled();
    });

    it('stays silent when replay options are given', () => {
      hmac({ secret: SECRET, header: HEADER, replay: { timestampHeader: 'x-timestamp' } });
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not warn when creation throws for an empty secret', () => {
      expect(() => hmac({ secret: '', header: HEADER })).toThrow('non-empty secret');
      expect(warn).not.toHaveBeenCalled();
    });

    it('verifies the body alone when replay is false', async () => {
      const app = express();
      app.use(rawBody());
      app.use(hmac({ secret: SECRET, header: HEADER, replay: false }));
      app.post('/test', (req, res) => { res.status(200).json({ ok: true }); });

      const first = await request(app).post('/test').set('Content-Type', 'application/json').set(HEADER, sign(body)).send(body);
      const again = await request(app).post('/test').set('Content-Type', 'application/json').set(HEADER, sign(body)).send(body);
      expect(first.status).toBe(200);
      expect(again.status).toBe(200);
    });
  });

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

  describe('secret validation', () => {
    it('throws when secret is an empty string', () => {
      expect(() => hmac({ secret: '', header: HEADER })).toThrow('non-empty secret');
    });

    it('throws when secret is missing', () => {
      expect(() => hmac({ header: HEADER } as unknown as Parameters<typeof hmac>[0])).toThrow('non-empty secret');
    });

    it('throws when secret is not a string', () => {
      expect(() => hmac({ secret: 123 as unknown as string, header: HEADER })).toThrow('non-empty secret');
    });
  });

  describe('body parsing guard', () => {
    it('returns 400 when rawBody() middleware is not used', async () => {
      const app = express();
      app.use(express.json());
      app.use(hmac({ secret: SECRET, header: HEADER }));
      app.post('/test', (req, res) => { res.status(200).json({ ok: true }); });
      app.use(errorHandler);

      const res = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .set(HEADER, sign(body))
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/rawBody\(\)/);
    });
  });

  describe('replay protection', () => {
    const TS_HEADER = 'x-timestamp';

    function signAt(ts: string | number, payload = body): string {
      return createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
    }

    function now(): number {
      return Math.floor(Date.now() / 1000);
    }

    function buildReplayApp(replay: Partial<HmacReplayOptions> = {}) {
      const app = express();
      app.use(rawBody());
      app.use(hmac({ secret: SECRET, header: HEADER, replay: { timestampHeader: TS_HEADER, ...replay } }));
      app.post('/test', (req, res) => { res.status(200).json({ ok: true }); });
      app.use(errorHandler);
      return app;
    }

    function send(app: express.Express, ts: string | number | undefined, sig: string, payload = body) {
      const req = request(app).post('/test').set('Content-Type', 'application/json').set(HEADER, sig);
      if (ts !== undefined) req.set(TS_HEADER, String(ts));
      return req.send(payload);
    }

    afterEach(() => jest.restoreAllMocks());

    it('accepts a fresh request signed over timestamp and body', async () => {
      const ts = now();
      const res = await send(buildReplayApp(), ts, signAt(ts));
      expect(res.status).toBe(200);
    });

    it('rejects the same request sent a second time', async () => {
      const app = buildReplayApp();
      const ts = now();
      const sig = signAt(ts);

      expect((await send(app, ts, sig)).status).toBe(200);
      const replayed = await send(app, ts, sig);
      expect(replayed.status).toBe(401);
      expect(replayed.body.error).toMatch(/already processed/);
    });

    it('rejects a replay that re-encodes the signature in upper case', async () => {
      const app = buildReplayApp();
      const ts = now();
      const sig = signAt(ts);

      expect((await send(app, ts, sig)).status).toBe(200);
      expect((await send(app, ts, sig.toUpperCase())).status).toBe(401);
    });

    it('accepts the same body again under a new timestamp', async () => {
      const app = buildReplayApp();
      const ts = now();

      expect((await send(app, ts, signAt(ts))).status).toBe(200);
      expect((await send(app, ts - 1, signAt(ts - 1))).status).toBe(200);
    });

    it('rejects a body-only signature when replay protection is on', async () => {
      const res = await send(buildReplayApp(), now(), sign(body));
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid signature/);
    });

    it('rejects a request whose timestamp was changed after signing', async () => {
      const ts = now();
      const res = await send(buildReplayApp(), ts - 10, signAt(ts));
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid signature/);
    });

    it('returns 401 when the timestamp header is missing', async () => {
      const res = await send(buildReplayApp(), undefined, signAt(now()));
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing x-timestamp header/);
    });

    it.each(['abc', '12.5', '-5', '1e9', '99999999999999999999'])('returns 401 for malformed timestamp %s', async (ts) => {
      const res = await send(buildReplayApp(), ts, signAt(ts));
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/outside tolerance/);
    });

    it('rejects a timestamp older than the default 5 minute window', async () => {
      const ts = now() - 301;
      const res = await send(buildReplayApp(), ts, signAt(ts));
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/outside tolerance/);
    });

    it('rejects a timestamp too far in the future', async () => {
      const ts = now() + 301;
      expect((await send(buildReplayApp(), ts, signAt(ts))).status).toBe(401);
    });

    it('honours a custom toleranceSeconds', async () => {
      const app = buildReplayApp({ toleranceSeconds: 10 });
      const old = now() - 11;
      expect((await send(app, old, signAt(old))).status).toBe(401);
      const fresh = now() - 9;
      expect((await send(app, fresh, signAt(fresh))).status).toBe(200);
    });

    it('uses signedPayload to build the signed string', async () => {
      const app = buildReplayApp({ signedPayload: (ts, raw) => `v0:${ts}:${raw.toString()}` });
      const ts = now();
      const sig = createHmac('sha256', SECRET).update(`v0:${ts}:${body}`).digest('hex');
      expect((await send(app, ts, sig)).status).toBe(200);
    });

    it('records the request in a custom store until it leaves the window', async () => {
      const add = jest.fn().mockResolvedValue(true);
      const ts = now();
      const res = await send(buildReplayApp({ store: { add }, toleranceSeconds: 60 }), ts, signAt(ts));

      expect(res.status).toBe(200);
      expect(add).toHaveBeenCalledWith(signAt(ts), (ts + 61) * 1000);
    });

    it('returns 401 when a custom store reports the request as seen', async () => {
      const ts = now();
      const res = await send(buildReplayApp({ store: { add: async () => false } }), ts, signAt(ts));
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/already processed/);
    });

    it('does not record requests with an invalid signature', async () => {
      const add = jest.fn().mockReturnValue(true);
      await send(buildReplayApp({ store: { add } }), now(), 'deadbeef');
      expect(add).not.toHaveBeenCalled();
    });

    it.each([0, -1, NaN, Infinity])('throws at setup when toleranceSeconds is %s', (toleranceSeconds) => {
      expect(() => hmac({ secret: SECRET, header: HEADER, replay: { timestampHeader: TS_HEADER, toleranceSeconds } }))
        .toThrow('toleranceSeconds must be a positive number');
    });
  });
});
