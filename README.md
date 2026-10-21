# @vulps22/pathfinder

File-based dynamic Express router with composable middleware. Drop route files into a folder and they're registered automatically — no manual `app.get(...)` wiring.

## Installation

```bash
npm install @vulps22/pathfinder
```

`express@^5` is a peer dependency and must be installed alongside it.

## Quick start

```ts
import { createServer } from '@vulps22/pathfinder';

await createServer({
  port: 3000,
  routesPath: __dirname + '/routes',
});
```

This scans `routesPath` for compiled `.js` route files and registers each one on an Express app before starting the server.

## File-based routing

Each file under `routesPath` becomes a route. The file path maps to a URL path:

| File | URL |
|---|---|
| `routes/api/v1/ping.js` | `/api/v1/ping` |
| `routes/api/v1/item/index.js` | `/api/v1/item` |
| `routes/api/v1/item/[id].js` | `/api/v1/item/:id` |
| `routes/api/v1/item/[id]/action.js` | `/api/v1/item/:id/action` |

- Square-bracket segments (`[id]`) become Express dynamic params (`:id`).
- `index.js` files map to their parent directory.
- Routes are sorted so static segments take priority over dynamic ones — e.g. `/item/random.js` is registered before `/item/[id].js`, so `GET /item/random` won't be swallowed by the `:id` route.

## Route file shape

Each route file exports a `route` object implementing `ApiRoute`. Any combination of HTTP methods can be defined:

```ts
import { ApiRoute } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    res.status(200).json({ id: req.params.id });
  },
  patch: async (req, res) => {
    res.status(200).json({ updated: req.params.id });
  },
  delete: async (req, res) => {
    res.status(204).send();
  },
};
```

### Per-route middleware

Attach an ordered list of Express middleware via `middleware` — it runs before the matched handler:

```ts
import { ApiRoute } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    (req, res, next) => {
      req.middlewareRan = true;
      next();
    },
  ],
  get: async (req, res) => {
    res.status(200).json({ middlewareRan: req.middlewareRan ?? false });
  },
};
```

## Middleware

### Body parsing

```ts
import { jsonBody, rawBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [jsonBody()],
  post: async (req, res) => { /* req.body is parsed JSON */ },
};
```

`rawBody()` parses `application/json` as a `Buffer` instead — required by `auth.hmac()`, which needs the raw bytes to verify a signature.

### Bearer auth

Validates an `Authorization: Bearer <token>` header against a map of named consumers, optionally blocking specific consumers per environment. On success, sets `req.consumer` to the matched consumer name.

```ts
import { auth } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    auth.bearer({
      consumers: { serviceA: process.env.SERVICE_A_SECRET, serviceB: process.env.SERVICE_B_SECRET },
      blockedInEnvironment: { prod: ['internalTool'] },
      environment: process.env.ENVIRONMENT,
    }),
  ],
  get: async (req, res) => {
    res.status(200).json({ consumer: req.consumer });
  },
};
```

### HMAC signature auth

Verifies a request body signature (e.g. for webhooks) using HMAC-SHA256 with a timing-safe comparison. Requires `rawBody()` to run first so the raw request bytes are available.

```ts
import { auth, rawBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    rawBody(),
    auth.hmac({
      secret: process.env.WEBHOOK_SECRET!,
      header: 'x-signature',
      parseSignature: value => value.replace('sha256=', ''),
    }),
  ],
  post: async (req, res) => { /* signature verified */ },
};
```

`auth.hmac()` throws when created with an empty or missing `secret`, so a misconfigured environment fails at startup instead of accepting forged signatures.

#### Replay protection

By default a captured signed request can be sent again and will still pass. If the sender includes a timestamp header, turn on `replay` to block that:

```ts
auth.hmac({
  secret: process.env.WEBHOOK_SECRET!,
  header: 'x-signature',
  replay: {
    timestampHeader: 'x-timestamp', // Unix time in seconds
    toleranceSeconds: 300,          // default: 5 minutes either side of now
  },
}),
```

With `replay` on:

- The signature must cover the timestamp as well as the body. By default the signed string is `<timestamp>.<body>` (Stripe's format). Use `signedPayload(timestamp, body)` to match other formats, such as Slack's `v0:<timestamp>:<body>`.
- Requests with a missing, malformed or out-of-window timestamp get a `401`.
- Each accepted request is remembered until its timestamp leaves the window, so sending it a second time gets a `401`.

Seen requests are kept in memory by default, which only protects a single process. If you run several instances, pass a shared `store` implementing `add(key, expiresAt)`, which must atomically record the key and return `false` if it was already there:

```ts
replay: {
  timestampHeader: 'x-timestamp',
  store: {
    add: async (key, expiresAt) => (await redis.set(`hmac:${key}`, '1', { NX: true, PXAT: expiresAt })) === 'OK',
  },
},
```

## Errors

Every error response is JSON in the form `{ "error": "<message>" }`.

To send an error from a handler or middleware, throw one of the error classes. `createServer()` installs a global error handler that turns it into the response:

```js
import { NotFoundError } from '@vulps22/pathfinder';

get: async (req, res) => {
  const user = await findUser(req.params.id);
  if (!user) throw new NotFoundError('User not found'); // 404 { "error": "User not found" }
  res.json(user);
},
```

| Class | Status | Default message |
| --- | --- | --- |
| `BadRequestError` | 400 | Bad Request |
| `NotAuthorisedError` | 401 | Unauthorized |
| `ForbiddenError` | 403 | Forbidden |
| `NotFoundError` | 404 | Not Found |
| `InternalServerError` | 500 | Internal Server Error |

The message is optional, so `throw new ForbiddenError()` works too. For any other status, use `new HttpError(status, message)`, which all of these classes extend.

Everything else is handled for you:

- Unmatched routes return `404 { "error": "Not Found" }`.
- Any other thrown error (a bug, a database failure) returns `500 { "error": "Internal Server Error" }` and is logged server-side with `console.error`. Its message and stack are never sent to the client.
- Client errors raised by other middleware keep their status with a generic message, e.g. malformed JSON sent to a `jsonBody()` route returns `400 { "error": "Bad Request" }`.

Throwing works directly inside handlers and middleware, including async ones. Inside a callback that runs later (e.g. `setTimeout`), pass the error to `next(err)` instead.

The built-in auth middleware throws these classes too, so its responses only come back as JSON when the error handler is installed. `createServer()` does that for you. If you mount `auth.bearer()` or `auth.hmac()` on your own Express app, add `app.use(errorHandler)` after your routes.

## Exports

- `createServer(options: ServerOptions): Promise<http.Server>`
- `jsonBody(): RequestHandler`
- `rawBody(): RequestHandler`
- `HttpError`, `BadRequestError`, `NotAuthorisedError`, `ForbiddenError`, `NotFoundError`, `InternalServerError`
- `errorHandler: ErrorRequestHandler`
- `auth.bearer(options: BearerAuthOptions): RequestHandler`
- `auth.hmac(options: HmacAuthOptions): RequestHandler`
- `auth.memoryReplayStore(): ReplayStore`
- Types: `ApiRoute`, `Middleware`, `ServerOptions`, `BearerAuthOptions`, `HmacAuthOptions`, `HmacReplayOptions`, `ReplayStore`

## Requirements

- Node.js `>=20.6.0`
- `express@^5` (peer dependency)

## Development

```bash
npm run build          # compile TypeScript to dist/
npm test               # run jest test suite
npm run test:coverage  # run tests with coverage
```
