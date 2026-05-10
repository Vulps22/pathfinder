import http from 'http';
import { join } from 'path';
import request from 'supertest';
import { createServer } from '../src/server';

const FIXTURES = join(__dirname, 'fixtures/routes');

describe('createServer', () => {
  let server: http.Server;

  afterEach(done => {
    server.close(done);
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
});
