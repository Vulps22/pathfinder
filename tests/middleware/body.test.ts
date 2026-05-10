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

  it('returns a function', () => {
    expect(typeof rawBody()).toBe('function');
  });
});
