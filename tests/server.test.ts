import http from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import request from 'supertest';
import { createServer } from '../src/server';

const FIXTURES = join(__dirname, 'fixtures/routes');

describe('createServer', () => {
  let server: http.Server;

  afterEach(done => {
    if (server?.listening) server.close(done);
    else done();
  });

  it('returns an http.Server that listens on the given port', async () => {
    server = await createServer({ port: 0, routesPath: FIXTURES });
    expect(server.listening).toBe(true);
  });

  it('serves registered routes', async () => {
    server = await createServer({ port: 0, routesPath: FIXTURES });
    const res = await request(server).get('/api/v1/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pong: true });
  });

  it('does not throw when routesPath does not exist', async () => {
    await expect(
      createServer({ port: 0, routesPath: '/nonexistent/path' }).then(s => { server = s; })
    ).resolves.not.toThrow();
  });

  it('returns a 500 instead of crashing when a handler throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    server = await createServer({ port: 0, routesPath: FIXTURES });
    const res = await request(server).get('/api/v1/error');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(res.text).not.toContain('handler failed');
    jest.restoreAllMocks();
  });

  it('responds with the status and message of an HttpError thrown by a handler', async () => {
    server = await createServer({ port: 0, routesPath: FIXTURES });
    const res = await request(server).get('/api/v1/missing-user');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });

  it('returns a JSON 404 for unmatched routes', async () => {
    server = await createServer({ port: 0, routesPath: FIXTURES });
    const res = await request(server).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('returns a JSON 404 when routesPath does not exist', async () => {
    server = await createServer({ port: 0, routesPath: '/nonexistent/path' });
    const res = await request(server).get('/anything');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('does not leak a stack trace for malformed JSON sent without credentials', async () => {
    server = await createServer({ port: 0, routesPath: FIXTURES });
    const res = await request(server)
      .post('/api/v1/protected')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
    expect(res.text).not.toMatch(/node_modules|body-parser|at /);
  });

  it('rejects when the port is already in use', async () => {
    server = await createServer({ port: 0, routesPath: FIXTURES });
    const { port } = server.address() as AddressInfo;

    await expect(createServer({ port, routesPath: FIXTURES })).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });
});

describe('createServer gracefulShutdown', () => {
  const SLOW = join(__dirname, 'fixtures/slow-routes');
  let server: http.Server;
  let exit: jest.SpyInstance;

  // Resolves with the exit code once the shutdown handler calls process.exit().
  const exited = () => new Promise<number | undefined>(resolve => {
    exit.mockImplementation(((code?: number) => resolve(code)) as never);
  });

  beforeEach(() => {
    exit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(done => {
    jest.restoreAllMocks();
    if (server?.listening) server.close(done);
    else done();
  });

  const signalListeners = () => process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');

  it('does not listen for signals unless enabled', async () => {
    const before = signalListeners();
    server = await createServer({ port: 0, routesPath: SLOW });
    expect(signalListeners()).toBe(before);
  });

  it.each(['SIGTERM', 'SIGINT'] as const)('closes the server and exits 0 on %s', async signal => {
    server = await createServer({ port: 0, routesPath: SLOW, gracefulShutdown: true });
    const code = exited();
    process.emit(signal);
    expect(await code).toBe(0);
    expect(server.listening).toBe(false);
  });

  it('lets in-flight requests finish before exiting', async () => {
    server = await createServer({ port: 0, routesPath: SLOW, gracefulShutdown: true });
    const inFlight = request(server).get('/slow?ms=100').then(res => res);
    await new Promise(resolve => setTimeout(resolve, 20));

    const code = exited();
    process.emit('SIGTERM');

    const res = await inFlight;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ done: true });
    expect(await code).toBe(0);
  });

  it('forces exit 1 when requests outlast the timeout', async () => {
    server = await createServer({ port: 0, routesPath: SLOW, gracefulShutdown: { timeout: 50 } });
    const inFlight = request(server).get('/slow?ms=500').then(() => null, err => err);
    await new Promise(resolve => setTimeout(resolve, 20));

    const code = exited();
    process.emit('SIGTERM');

    expect(await code).toBe(1);
    expect(await inFlight).toMatchObject({ code: 'ECONNRESET' });
  });

  it('only handles the first signal', async () => {
    server = await createServer({ port: 0, routesPath: SLOW, gracefulShutdown: {} });
    const before = signalListeners();
    const code = exited();
    process.emit('SIGTERM');
    expect(signalListeners()).toBe(before - 2);
    expect(await code).toBe(0);
  });

  it('stops listening for signals when the server is closed directly', async () => {
    const before = signalListeners();
    server = await createServer({ port: 0, routesPath: SLOW, gracefulShutdown: true });
    expect(signalListeners()).toBe(before + 2);
    await new Promise(resolve => server.close(resolve));
    expect(signalListeners()).toBe(before);
  });

  it('exits 1 when the server is already closing', async () => {
    server = await createServer({ port: 0, routesPath: SLOW, gracefulShutdown: true });
    const code = exited();
    server.close();
    process.emit('SIGTERM');
    expect(await code).toBe(1);
  });
});
