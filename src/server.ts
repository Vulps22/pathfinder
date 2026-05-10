import express from 'express';
import { existsSync } from 'fs';
import http from 'http';
import { loadRoutes } from './loader/routeLoader';

export interface ServerOptions {
  port: number;
  routesPath: string;
}

export async function createServer(options: ServerOptions): Promise<http.Server> {
  const { port, routesPath } = options;
  const app = express();

  if (existsSync(routesPath)) {
    await loadRoutes(app, routesPath);
  } else {
    console.warn(`[Server] Routes path not found: ${routesPath}`);
  }

  return new Promise(resolve => {
    const server = app.listen(port, () => {
      console.log(`[Server] Listening on port ${port}`);
      resolve(server);
    });
  });
}
