import { STATUS_CODES } from 'http';
import { ErrorRequestHandler, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string = STATUS_CODES[status] ?? 'Error') {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message?: string) { super(400, message); }
}

export class NotAuthorisedError extends HttpError {
  constructor(message?: string) { super(401, message); }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) { super(403, message); }
}

export class NotFoundError extends HttpError {
  constructor(message?: string) { super(404, message); }
}

export class InternalServerError extends HttpError {
  constructor(message?: string) { super(500, message); }
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError();
};

// An HttpError was thrown on purpose, so its status and message are sent as-is.
// Anything else is unexpected: never echo its message or stack to the client, as
// they can expose file paths and internals. Client errors from other middleware
// (e.g. malformed JSON -> 400) keep their status with a generic message; the rest
// is logged and returned as a plain 500.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) console.error('[Server] Server error:', err);
    sendError(res, err.status, err.message);
    return;
  }

  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    sendError(res, status, STATUS_CODES[status] ?? 'Bad Request');
    return;
  }

  console.error('[Server] Unhandled error:', err);
  sendError(res, 500, 'Internal Server Error');
};
