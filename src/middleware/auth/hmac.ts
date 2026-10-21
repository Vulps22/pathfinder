import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestError, NotAuthorisedError } from '../../handlers/errors';
import { ReplayStore, memoryReplayStore } from './replayStore';

export interface HmacReplayOptions {
  timestampHeader: string;
  toleranceSeconds?: number;
  signedPayload?: (timestamp: string, body: Buffer) => Buffer | string;
  store?: ReplayStore;
}

export interface HmacAuthOptions {
  secret: string;
  header: string;
  parseSignature?: (value: string) => string;
  replay?: HmacReplayOptions;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

const defaultSignedPayload = (timestamp: string, body: Buffer): Buffer =>
  Buffer.concat([Buffer.from(`${timestamp}.`), body]);

export function hmac(options: HmacAuthOptions): RequestHandler {
  const { secret, header, parseSignature = (v: string) => v, replay } = options;

  // An empty key makes every signature trivially forgeable, so refuse it at setup time.
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('auth.hmac() requires a non-empty secret');
  }

  const tolerance = replay?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (replay && (!Number.isFinite(tolerance) || tolerance <= 0)) {
    throw new Error('auth.hmac() replay.toleranceSeconds must be a positive number');
  }
  const signedPayload = replay?.signedPayload ?? defaultSignedPayload;
  const store = replay ? (replay.store ?? memoryReplayStore()) : undefined;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {

    const headerValue = req.headers[header.toLowerCase()];

    if (!headerValue || typeof headerValue !== 'string') {
      throw new NotAuthorisedError(`Missing ${header} header`);
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestError('Raw body required — use rawBody() middleware before auth.hmac()');
    }

    let payload: Buffer | string = req.body;
    let timestamp = 0;

    if (replay) {
      const timestampValue = req.headers[replay.timestampHeader.toLowerCase()];

      if (!timestampValue || typeof timestampValue !== 'string') {
        throw new NotAuthorisedError(`Missing ${replay.timestampHeader} header`);
      }

      timestamp = /^\d+$/.test(timestampValue) ? Number(timestampValue) : NaN;
      const now = Math.floor(Date.now() / 1000);

      if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > tolerance) {
        throw new NotAuthorisedError('Request timestamp outside tolerance');
      }

      payload = signedPayload(timestampValue, req.body);
    }

    const signature = parseSignature(headerValue);
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

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

    // Key on our own digest, not the header, so re-encoding the same signature (e.g. upper-case hex) can't dodge the check.
    // Kept until the timestamp can no longer pass the tolerance check, after which that rejects the replay instead.
    if (store && !(await store.add(expected, (timestamp + tolerance + 1) * 1000))) {
      throw new NotAuthorisedError('Request already processed');
    }

    next();
  };
}
