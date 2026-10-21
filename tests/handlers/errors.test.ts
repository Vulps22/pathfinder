import express from 'express';
import request from 'supertest';
import { errorHandler, notFoundHandler, sendError } from '../../src/handlers/errors';

function appThatThrows(err: unknown): express.Express {
  const app = express();
  app.get('/boom', () => { throw err; });
  app.use(errorHandler);
  return app;
}

describe('sendError', () => {
  it('responds with the given status and a JSON error message', async () => {
    const app = express();
    app.get('/teapot', (req, res) => sendError(res, 418, 'I am a teapot'));

    const res = await request(app).get('/teapot');

    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: 'I am a teapot' });
  });
});

describe('notFoundHandler', () => {
  it('responds 404 with a JSON body', async () => {
    const app = express();
    app.use(notFoundHandler);

    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not Found' });
  });
});

describe('errorHandler', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('returns a generic 500 and never exposes the error message or stack', async () => {
    const res = await request(appThatThrows(new Error('db password is hunter2'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(res.text).not.toContain('hunter2');
    expect(res.text).not.toContain('at ');
  });

  it('logs server errors server-side', async () => {
    const err = new Error('handler failed');
    await request(appThatThrows(err)).get('/boom');

    expect(consoleError).toHaveBeenCalledWith('[Server] Unhandled error:', err);
  });

  it('keeps a 4xx status from err.status but uses a generic message', async () => {
    const err = Object.assign(new Error('Unexpected token b in JSON'), { status: 400 });
    const res = await request(appThatThrows(err)).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('reads the status from err.statusCode too', async () => {
    const err = Object.assign(new Error('too big'), { statusCode: 413 });
    const res = await request(appThatThrows(err)).get('/boom');

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Payload Too Large' });
  });

  it('falls back to "Bad Request" for an unknown 4xx code', async () => {
    const res = await request(appThatThrows({ status: 499 })).get('/boom');

    expect(res.status).toBe(499);
    expect(res.body).toEqual({ error: 'Bad Request' });
  });

  it('treats a 5xx status on the error as a plain 500', async () => {
    const err = Object.assign(new Error('upstream detail'), { status: 503 });
    const res = await request(appThatThrows(err)).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });

  it('handles non-Error values being thrown', async () => {
    const res = await request(appThatThrows('something broke')).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });

  it('hands off to Express when headers have already been sent', () => {
    const next = jest.fn();
    const err = new Error('late failure');
    const res = { headersSent: true, status: jest.fn() } as unknown as express.Response;

    errorHandler(err, {} as express.Request, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
