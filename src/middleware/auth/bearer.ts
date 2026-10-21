import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError, NotAuthorisedError } from '../../handlers/errors';

export interface BearerAuthOptions {
  consumers: Record<string, string | undefined>;
  blockedInEnvironment?: Record<string, string[]>;
  environment?: string;
}

export function bearer(options: BearerAuthOptions): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const {
      consumers,
      blockedInEnvironment = {},
      environment = process.env.ENVIRONMENT ?? '',
    } = options;

    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new NotAuthorisedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    for (const [name, secret] of Object.entries(consumers)) {
      if (!secret || token !== secret) continue;

      const blocked = blockedInEnvironment[environment] ?? [];
      if (blocked.includes(name)) {
        throw new ForbiddenError(`${name} is not permitted in ${environment}`);
      }

      req.consumer = name;
      next();
      return;
    }

    throw new NotAuthorisedError('Invalid token');
  };
}
