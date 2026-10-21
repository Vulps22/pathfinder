import express from 'express';
import request from 'supertest';
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NotAuthorisedError,
  NotFoundError,
  errorHandler,
  notFoundHandler,
} from '../../src/handlers/errors';

function appThatThrows(err: unknown): express.Express {
  const app = express();
  app.get('/boom', () => { throw err; });
  app.get('/async-boom', async () => { throw err; });
  app.use(errorHandler);
  return app;
}

describe('HttpError classes', () => {
  it.each([
    [BadRequestError, 400, 'Bad Request'],
    [NotAuthorisedError, 401, 'Unauthorized'],
    [ForbiddenError, 403, 'Forbidden'],
    [NotFoundError, 404, 'Not Found'],
    [InternalServerError, 500, 'Internal Server Error'],
  ])('%p has status %i and default message "%s"', (ErrorClass, status, message) => {
    const err = new ErrorClass();

    expect(err).toBeInstanceOf(HttpError);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(status);
    expect(err.message).toBe(message);
    expect(err.name).toBe(ErrorClass.name);
  });

  it('accepts a custom message', () => {
    expect(new NotFoundError('User not found').message).toBe('User not found');
  });

  it('falls back to "Error" for a status with no standard reason phrase', () => {
    expect(new HttpError(599).message).toBe('Error');
  });
});

describe('notFoundHandler', () => {
  it('responds 404 with a JSON body', async () => {
    const app = express();
    app.use(notFoundHandler);
    app.use(errorHandler);

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

  it('sends the status and message of a thrown HttpError', async () => {
    const res = await request(appThatThrows(new NotFoundError('User not found'))).get('/boom');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('handles an HttpError thrown from an async handler', async () => {
    const res = await request(appThatThrows(new ForbiddenError())).get('/async-boom');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('logs a thrown InternalServerError', async () => {
    const err = new InternalServerError('Payment provider unavailable');
    const res = await request(appThatThrows(err)).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Payment provider unavailable' });
    expect(consoleError).toHaveBeenCalledWith('[Server] Server error:', err);
  });

  it('returns a generic 500 for unexpected errors and never exposes the message or stack', async () => {
    const res = await request(appThatThrows(new Error('db password is hunter2'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(res.text).not.toContain('hunter2');
    expect(res.text).not.toContain('at ');
  });

  it('logs unexpected errors server-side', async () => {
    const err = new Error('handler failed');
    await request(appThatThrows(err)).get('/boom');

    expect(consoleError).toHaveBeenCalledWith('[Server] Unhandled error:', err);
  });

  it('keeps a 4xx status from other middleware but uses a generic message', async () => {
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

  it('treats a 5xx status on a non-HttpError as a plain 500', async () => {
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
