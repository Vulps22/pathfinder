import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

export interface HmacAuthOptions {
  secret: string;
  header: string;
  parseSignature?: (value: string) => string;
}

export function hmac(options: HmacAuthOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { secret, header, parseSignature = (v: string) => v } = options;

    const headerValue = req.headers[header.toLowerCase()];

    if (!headerValue || typeof headerValue !== 'string') {
      res.status(401).json({ error: `Missing ${header} header` });
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'Raw body required — use rawBody() middleware before auth.hmac()' });
      return;
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
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  };
}
