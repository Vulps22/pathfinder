import { STATUS_CODES } from 'http';
import { ErrorRequestHandler, RequestHandler, Response } from 'express';

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, 'Not Found');
};

// Never echo err.message or err.stack to the client: they can expose file paths
// and internals. Client errors (e.g. malformed JSON -> 400) keep their status but
// get a generic message; anything else is logged and returned as a plain 500.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
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
