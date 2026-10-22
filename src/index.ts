declare global {
  namespace Express {
    interface Request {
      consumer?: string;
    }
  }
}

export { createServer } from './server';
export type { ServerOptions, GracefulShutdownOptions } from './server';

export { listRoutes } from './loader/routeLoader';

export { jsonBody, rawBody } from './middleware/body';

export {
  HttpError,
  BadRequestError,
  NotAuthorisedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
  errorHandler,
} from './handlers/errors';

export * as auth from './middleware/auth';

export type { ApiRoute, Middleware, RouteInfo, RouteMethod } from './types/ApiRoute';
