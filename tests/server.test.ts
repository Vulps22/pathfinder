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
