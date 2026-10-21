import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { ForbiddenError, NotAuthorisedError } from '../../handlers/errors';

export interface BearerAuthOptions {
  consumers: Record<string, string | undefined>;
  blockedInEnvironment?: Record<string, string[]>;
  environment?: string;
}

// Hashing both sides gives equal-length buffers, so timingSafeEqual never
// throws and the comparison time doesn't reveal the secret's length.
function tokensMatch(token: string, secret: string): boolean {
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
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
      if (!secret || !tokensMatch(token, secret)) continue;

      const blocked = blockedInEnvironment[environment] ?? [];
      if (blocked.includes(name)) {
        throw new ForbiddenError();
      }

      req.consumer = name;
      next();
      return;
    }

    throw new NotAuthorisedError('Invalid token');
  };
}
