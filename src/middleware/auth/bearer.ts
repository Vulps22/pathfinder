import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface BearerAuthOptions {
  consumers: Record<string, string | undefined>;
  blockedInEnvironment?: Record<string, string[]>;
  environment?: string;
}

export function bearer(options: BearerAuthOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const {
      consumers,
      blockedInEnvironment = {},
      environment = process.env.ENVIRONMENT ?? '',
    } = options;

    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    for (const [name, secret] of Object.entries(consumers)) {
      if (!secret || token !== secret) continue;

      const blocked = blockedInEnvironment[environment] ?? [];
      if (blocked.includes(name)) {
        res.status(403).json({ error: `${name} is not permitted in ${environment}` });
        return;
      }

      req.consumer = name;
      next();
      return;
    }

    res.status(401).json({ error: 'Invalid token' });
  };
}
