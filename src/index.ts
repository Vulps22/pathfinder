declare global {
  namespace Express {
    interface Request {
      consumer?: string;
    }
  }
}

export { createServer } from './server';
export type { ServerOptions } from './server';

export { jsonBody, rawBody } from './middleware/body';

export * as auth from './middleware/auth';

export type { ApiRoute, Middleware } from './types/ApiRoute';
