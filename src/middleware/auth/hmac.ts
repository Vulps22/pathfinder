import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestError, NotAuthorisedError } from '../../handlers/errors';

export interface HmacAuthOptions {
  secret: string;
  header: string;
  parseSignature?: (value: string) => string;
}

export function hmac(options: HmacAuthOptions): RequestHandler {
  const { secret, header, parseSignature = (v: string) => v } = options;

  // An empty key makes every signature trivially forgeable, so refuse it at setup time.
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('auth.hmac() requires a non-empty secret');
  }

  return (req: Request, _res: Response, next: NextFunction): void => {

    const headerValue = req.headers[header.toLowerCase()];

    if (!headerValue || typeof headerValue !== 'string') {
      throw new NotAuthorisedError(`Missing ${header} header`);
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestError('Raw body required — use rawBody() middleware before auth.hmac()');
    }

    const signature = parseSignature(headerValue);
    const expected = createHmac('sha256', secret).update(req.body).digest('hex');

    let valid = false;
    try {
      const sigBuffer = Buffer.from(signature, 'hex');
      const expBuffer = Buffer.from(expected, 'hex');
      valid = sigBuffer.length === expBuffer.length && timingSafeEqual(sigBuffer, expBuffer);
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new NotAuthorisedError('Invalid signature');
    }

    next();
  };
}
