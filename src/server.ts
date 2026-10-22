import express from 'express';
import { existsSync } from 'fs';
import http from 'http';
import { errorHandler, notFoundHandler } from './handlers/errors';
import { loadRoutes } from './loader/routeLoader';

export interface GracefulShutdownOptions {
  timeout?: number; // ms to wait for in-flight requests before forcing exit (default 10000)
}

export interface ServerOptions {
  port: number;
  routesPath: string;
  gracefulShutdown?: boolean | GracefulShutdownOptions;
}

const DEFAULT_SHUTDOWN_TIMEOUT = 10_000;
const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export async function createServer(options: ServerOptions): Promise<http.Server> {
  const { port, routesPath, gracefulShutdown } = options;
  const app = express();

  if (existsSync(routesPath)) {
    await loadRoutes(app, routesPath);
  } else {
    console.warn(`[Server] Routes path not found: ${routesPath}`);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = await new Promise<http.Server>((resolve, reject) => {
    const server = app.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`[Server] Listening on port ${port}`);
      resolve(server);
    });
  });

  if (gracefulShutdown) {
    const timeout = typeof gracefulShutdown === 'object'
      ? gracefulShutdown.timeout ?? DEFAULT_SHUTDOWN_TIMEOUT
      : DEFAULT_SHUTDOWN_TIMEOUT;
    handleShutdownSignals(server, timeout);
  }

  return server;
}

// On the first SIGTERM/SIGINT, stop accepting connections, let in-flight
// requests finish, then exit. A second signal falls through to Node's
// default handler and kills the process immediately.
function handleShutdownSignals(server: http.Server, timeout: number): void {
  const onSignal = (signal: NodeJS.Signals) => {
    removeListeners();
    console.log(`[Server] ${signal} received, closing server`);

    const timer = setTimeout(() => {
      console.error(`[Server] Requests still open after ${timeout}ms, forcing exit`);
      server.closeAllConnections();
      process.exit(1);
    }, timeout);
    timer.unref();

    server.close(err => {
      clearTimeout(timer);
      if (err) {
        console.error('[Server] Error while closing:', err);
        process.exit(1);
        return;
      }
      console.log('[Server] Closed');
      process.exit(0);
    });
    server.closeIdleConnections();
  };

  const removeListeners = () => {
    for (const signal of SHUTDOWN_SIGNALS) process.off(signal, onSignal);
  };

  for (const signal of SHUTDOWN_SIGNALS) process.once(signal, onSignal);
  // If the caller closes the server themselves, stop listening for signals.
  server.once('close', removeListeners);
}
