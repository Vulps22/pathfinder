import express, { RequestHandler } from 'express';
import type { IncomingMessage } from 'http';

export interface RawBodyOptions {
  /**
   * Which content types to read. A MIME type (`'application/x-www-form-urlencoded'`),
   * a wildcard (`'text/*'`), a list of those, or a function that decides per request.
   * Defaults to every content type.
   */
  type?: string | string[] | ((req: IncomingMessage) => boolean);
}

export function jsonBody(): RequestHandler {
  return express.json();
}

export function rawBody(options: RawBodyOptions = {}): RequestHandler {
  return express.raw({ type: options.type ?? (() => true) });
}
