import express, { RequestHandler } from 'express';

export function jsonBody(): RequestHandler {
  return express.json();
}

export function rawBody(): RequestHandler {
  return express.raw({ type: 'application/json' });
}
