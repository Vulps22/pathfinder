import express from 'express';
import request from 'supertest';
import { join } from 'path';
import { toUrlPath, sortRoutes, loadRoutes } from '../../src/loader/routeLoader';

const FIXTURES = join(__dirname, '../fixtures/routes');

describe('toUrlPath', () => {
  it('converts a simple file path to a URL', () => {
    expect(toUrlPath('api/v1/ping')).toBe('/api/v1/ping');
  });

  it('converts [param] segments to :param', () => {
    expect(toUrlPath('api/v1/item/[id]')).toBe('/api/v1/item/:id');
  });

  it('converts index to the parent path', () => {
    expect(toUrlPath('api/v1/item/index')).toBe('/api/v1/item');
  });

  it('converts a bare index to root', () => {
    expect(toUrlPath('index')).toBe('/');
  });

  it('handles nested [param]/action paths', () => {
    expect(toUrlPath('api/v1/item/[id]/action')).toBe('/api/v1/item/:id/action');
  });

  it('handles Windows-style backslash separators', () => {
    expect(toUrlPath('api\\v1\\item\\[id]')).toBe('/api/v1/item/:id');
  });
});

describe('sortRoutes', () => {
  it('places static routes before dynamic ones', () => {
    const routes = [
      { urlPath: '/api/v1/item/:id', filePath: '', dynamicSegments: 1 },
      { urlPath: '/api/v1/item/random', filePath: '', dynamicSegments: 0 },
    ];
    const sorted = sortRoutes(routes);
    expect(sorted[0].urlPath).toBe('/api/v1/item/random');
    expect(sorted[1].urlPath).toBe('/api/v1/item/:id');
  });

  it('places more-specific dynamic routes first when segment counts match', () => {
    const routes = [
      { urlPath: '/api/v1/item/:id', filePath: '', dynamicSegments: 1 },
      { urlPath: '/api/v1/:type/action', filePath: '', dynamicSegments: 1 },
    ];
    const sorted = sortRoutes(routes);
    // /api/v1/item/:id has its first dynamic segment later → more specific → registered first
    expect(sorted[0].urlPath).toBe('/api/v1/item/:id');
  });

  it('does not mutate the original array', () => {
    const routes = [
      { urlPath: '/api/v1/item/:id', filePath: '', dynamicSegments: 1 },
      { urlPath: '/api/v1/item/random', filePath: '', dynamicSegments: 0 },
    ];
    const original = [...routes];
    sortRoutes(routes);
    expect(routes).toEqual(original);
  });
});

describe('loadRoutes (integration)', () => {
  it('registers GET /api/v1/ping from ping.js fixture', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).get('/api/v1/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pong: true });
  });

  it('registers GET /api/v1/item from item/index.js fixture', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).get('/api/v1/item');
    expect(res.status).toBe(200);
  });

  it('registers POST /api/v1/item from item/index.js fixture', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).post('/api/v1/item');
    expect(res.status).toBe(201);
  });

  it('registers GET /api/v1/item/random before GET /api/v1/item/:id', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).get('/api/v1/item/random');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ random: true });
  });

  it('registers GET /api/v1/item/:id with param', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).get('/api/v1/item/42');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('42');
  });

  it('registers PATCH and DELETE on /api/v1/item/:id', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const patch = await request(app).patch('/api/v1/item/42');
    expect(patch.status).toBe(200);
    const del = await request(app).delete('/api/v1/item/42');
    expect(del.status).toBe(204);
  });

  it('registers POST /api/v1/item/:id/action', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).post('/api/v1/item/99/action');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: true, id: '99' });
  });

  it('applies route-level middleware', async () => {
    const app = express();
    await loadRoutes(app, FIXTURES);
    const res = await request(app).get('/api/v1/middleware-route');
    expect(res.status).toBe(200);
    expect(res.body.middlewareRan).toBe(true);
  });
});
