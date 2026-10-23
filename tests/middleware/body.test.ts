import express from 'express';
import request from 'supertest';
import { jsonBody, rawBody } from '../../src/middleware/body';

describe('jsonBody', () => {
  it('parses JSON and attaches to req.body', async () => {
    const app = express();
    app.use(jsonBody());
    app.post('/test', (req, res) => { res.status(200).json(req.body); });

    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ hello: 'world' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hello: 'world' });
  });

  it('returns a function', () => {
    expect(typeof jsonBody()).toBe('function');
  });
});

describe('rawBody', () => {
  it('attaches req.body as a Buffer', async () => {
    const app = express();
    app.use(rawBody());
    app.post('/test', (req, res) => {
      res.status(200).json({ isBuffer: Buffer.isBuffer(req.body) });
    });

    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ hello: 'world' }));

    expect(res.status).toBe(200);
    expect(res.body.isBuffer).toBe(true);
  });

  it('reads non-JSON bodies by default', async () => {
    const app = express();
    app.use(rawBody());
    app.post('/test', (req, res) => {
      res.status(200).json({ isBuffer: Buffer.isBuffer(req.body), text: req.body.toString('utf8') });
    });

    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('payload=%7B%22ok%22%3Atrue%7D');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isBuffer: true, text: 'payload=%7B%22ok%22%3Atrue%7D' });
  });

  it('reads bodies sent without a Content-Type', async () => {
    const app = express();
    app.use(rawBody());
    app.post('/test', (req, res) => {
      res.status(200).json({ isBuffer: Buffer.isBuffer(req.body) });
    });

    const res = await request(app)
      .post('/test')
      .unset('Content-Type')
      .send(Buffer.from('hello'));

    expect(res.status).toBe(200);
    expect(res.body.isBuffer).toBe(true);
  });

  it('only reads the content types given in `type`', async () => {
    const app = express();
    app.use(rawBody({ type: 'application/json' }));
    app.post('/test', (req, res) => {
      res.status(200).json({ isBuffer: Buffer.isBuffer(req.body) });
    });

    const json = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send('{}');
    const text = await request(app)
      .post('/test')
      .set('Content-Type', 'text/plain')
      .send('hello');

    expect(json.body.isBuffer).toBe(true);
    expect(text.body.isBuffer).toBe(false);
  });

  it('accepts a list of content types and wildcards', async () => {
    const app = express();
    app.use(rawBody({ type: ['application/json', 'text/*'] }));
    app.post('/test', (req, res) => {
      res.status(200).json({ isBuffer: Buffer.isBuffer(req.body) });
    });

    const text = await request(app)
      .post('/test')
      .set('Content-Type', 'text/plain')
      .send('hello');

    expect(text.body.isBuffer).toBe(true);
  });

  it('returns a function', () => {
    expect(typeof rawBody()).toBe('function');
  });
});
