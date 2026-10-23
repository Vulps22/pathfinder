# API reference

Every export from `@vulps22/pathfinder`. Each entry has a description, its signature and an example. The guides linked from each entry cover the wider picture.

## Server

### `createServer()`

Creates an Express app, registers every route file under `routesPath`, installs the 404 and [error handlers](./errors.md), and starts listening. Resolves with the `http.Server` once the port is bound, or rejects if it can't be (for example, the port is in use).

```ts
createServer(options: ServerOptions): Promise<http.Server>
```

```ts
import { createServer } from '@vulps22/pathfinder';

const server = await createServer({
  port: 3000,
  routesPath: __dirname + '/routes',
});

console.log(server.address());
```

See [Getting started](./getting-started.md).

### `ServerOptions`

The options passed to `createServer()`.

```ts
interface ServerOptions {
  port: number;       // port to listen on
  routesPath: string; // folder of compiled .js route files
  gracefulShutdown?: boolean | GracefulShutdownOptions; // close cleanly on SIGTERM/SIGINT (default false)
}
```

```ts
import { createServer, ServerOptions } from '@vulps22/pathfinder';

const options: ServerOptions = {
  port: Number(process.env.PORT ?? 3000),
  routesPath: __dirname + '/routes',
};

await createServer(options);
```

If `routesPath` doesn't exist, the server still starts and logs a warning.

### `GracefulShutdownOptions`

Turns on graceful shutdown when passed as `gracefulShutdown`. Passing `true` uses the defaults.

On the first `SIGTERM` or `SIGINT`, the server stops accepting new connections, closes idle keep-alive connections, and waits for in-flight requests to finish. It then exits with code `0`. If requests are still open after `timeout` milliseconds, the remaining connections are dropped and the process exits with code `1`. A second signal kills the process straight away.

Leave it off if your app has its own shutdown logic, such as closing a database pool before exiting.

```ts
interface GracefulShutdownOptions {
  timeout?: number; // ms to wait for in-flight requests before forcing exit (default 10000)
}
```

```ts
import { createServer } from '@vulps22/pathfinder';

// Kubernetes sends SIGTERM and waits 30s before SIGKILL, so finish within 25s.
await createServer({
  port: 3000,
  routesPath: __dirname + '/routes',
  gracefulShutdown: { timeout: 25_000 },
});
```

## Routes

### `ApiRoute`

The shape of the `route` object every route file exports. Define any of `get`, `post`, `put`, `patch` and `delete`, plus an optional `middleware` list that runs before whichever method matched.

```ts
interface ApiRoute {
  middleware?: Middleware[];
  get?:    (req: Request, res: Response) => Promise<void>;
  post?:   (req: Request, res: Response) => Promise<void>;
  put?:    (req: Request, res: Response) => Promise<void>;
  patch?:  (req: Request, res: Response) => Promise<void>;
  delete?: (req: Request, res: Response) => Promise<void>;
}
```

```ts
// routes/books/[id].ts  ->  /books/:id
import { ApiRoute, NotFoundError } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    const book = await books.find(req.params.id);
    if (!book) throw new NotFoundError('Book not found');
    res.json(book);
  },
  delete: async (req, res) => {
    await books.remove(req.params.id);
    res.status(204).send();
  },
};
```

See [Routing](./routing.md).

### `Middleware`

An Express `RequestHandler`, the type of each entry in `ApiRoute.middleware`. Use it to type your own middleware.

```ts
type Middleware = RequestHandler;
```

```ts
import { ApiRoute, Middleware } from '@vulps22/pathfinder';

const logRequest: Middleware = (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
};

export const route: ApiRoute = {
  middleware: [logRequest],
  get: async (req, res) => {
    res.json({ ok: true });
  },
};
```

See [Per-route middleware](./routing.md#per-route-middleware).

### `listRoutes()`

Scans `routesPath` the same way `createServer()` does and resolves with one entry per route file, in the order the routes are registered (static segments first). Nothing is registered or served. Handy for asserting in tests that a route exists, printing a route table at startup, or feeding a docs generator.

```ts
listRoutes(routesPath: string): Promise<RouteInfo[]>
```

```ts
import { listRoutes } from '@vulps22/pathfinder';

const routes = await listRoutes(__dirname + '/routes');

for (const { path, methods, file } of routes) {
  console.log(`${methods.join(', ').padEnd(20)} ${path}  (${file})`);
}
// GET, POST            /orders  (orders/index.js)
// GET                  /orders/export  (orders/export.js)
// GET, PATCH, DELETE   /orders/:orderId  (orders/[orderId].js)
```

Route files are imported to read their methods, so any top-level code in them runs, just as it would when the server starts.

### `RouteInfo`

One entry from `listRoutes()`.

```ts
type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RouteInfo {
  path:    string;        // Express path, e.g. /orders/:orderId
  methods: RouteMethod[]; // methods the route file defines
  file:    string;        // route file, relative to routesPath
}
```

```ts
import { listRoutes, RouteInfo } from '@vulps22/pathfinder';

it('exposes a refund endpoint', async () => {
  const routes: RouteInfo[] = await listRoutes(__dirname + '/../dist/routes');
  const refund = routes.find(r => r.path === '/orders/:orderId/refund');

  expect(refund?.methods).toContain('POST');
});
```

`file` always uses forward slashes, on Windows too.

## Body parsing

### `jsonBody()`

Parses an `application/json` request body into `req.body`. Malformed JSON gets `400 { "error": "Bad Request" }`.

```ts
jsonBody(): RequestHandler
```

```ts
import { ApiRoute, jsonBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [jsonBody()],
  post: async (req, res) => {
    const { title, author } = req.body;
    res.status(201).json(await books.create({ title, author }));
  },
};
```

See [Middleware](./middleware.md#jsonbody).

### `rawBody()`

Reads the request body into `req.body` as an unparsed `Buffer`, whatever its content type. `auth.hmac()` needs this, because the signature covers the exact bytes sent. Pass `type` to read only some content types.

```ts
rawBody(options?: RawBodyOptions): RequestHandler
```

```ts
import { ApiRoute, auth, rawBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    rawBody(),
    auth.hmac({ secret: process.env.WEBHOOK_SECRET!, header: 'x-signature', replay: false }),
  ],
  post: async (req, res) => {
    const event = JSON.parse(req.body.toString('utf8'));
    res.status(204).send();
  },
};
```

See [Middleware](./middleware.md#rawbody).

### `RawBodyOptions`

The options for `rawBody()`. `type` picks which content types are read. It takes a MIME type, a wildcard such as `text/*`, a list of those, or a function that decides per request. Leave it out to read every content type. Bodies of any other type are left alone, so `req.body` stays `undefined`.

```ts
interface RawBodyOptions {
  type?: string | string[] | ((req: IncomingMessage) => boolean); // default: every type
}
```

```ts
import { ApiRoute, auth, rawBody } from '@vulps22/pathfinder';
import { parse } from 'querystring';

// Slack slash commands arrive as application/x-www-form-urlencoded
export const route: ApiRoute = {
  middleware: [
    rawBody({ type: 'application/x-www-form-urlencoded' }),
    auth.hmac({
      secret: process.env.SLACK_SIGNING_SECRET!,
      header: 'x-slack-signature',
      parseSignature: value => value.replace('v0=', ''),
      replay: {
        timestampHeader: 'x-slack-request-timestamp',
        signedPayload: (timestamp, body) => `v0:${timestamp}:${body.toString('utf8')}`,
      },
    }),
  ],
  post: async (req, res) => {
    const { command, text } = parse(req.body.toString('utf8'));
    res.json({ text: `You ran ${command} ${text}` });
  },
};
```

## Authentication

### `auth.bearer()`

Checks an `Authorization: Bearer <token>` header against a map of named consumers, in constant time. On success, sets `req.consumer` to the matching name. Responds `401` for a missing or unknown token, and a generic `403` for a consumer blocked in the current environment.

```ts
auth.bearer(options: BearerAuthOptions): RequestHandler
```

```ts
import { ApiRoute, auth } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    auth.bearer({
      consumers: {
        billingService: process.env.BILLING_SERVICE_TOKEN,
        adminDashboard: process.env.ADMIN_DASHBOARD_TOKEN,
      },
    }),
  ],
  get: async (req, res) => {
    res.json({ calledBy: req.consumer });
  },
};
```

See [Bearer auth](./auth.md#bearer-auth).

### `auth.BearerAuthOptions`

The options passed to `auth.bearer()`.

```ts
interface BearerAuthOptions {
  consumers: Record<string, string | undefined>; // consumer name -> token; empty tokens never match
  blockedInEnvironment?: Record<string, string[]>; // environment -> consumers refused there
  environment?: string;                            // defaults to process.env.ENVIRONMENT
}
```

```ts
import { ApiRoute, auth } from '@vulps22/pathfinder';

const internalOnly: auth.BearerAuthOptions = {
  consumers: {
    billingService: process.env.BILLING_SERVICE_TOKEN,
    loadTester: process.env.LOAD_TESTER_TOKEN,
  },
  blockedInEnvironment: { production: ['loadTester'] },
  environment: process.env.ENVIRONMENT,
};

export const route: ApiRoute = {
  middleware: [auth.bearer(internalOnly)],
  // ...
};
```

### `auth.hmac()`

Verifies an HMAC-SHA256 signature over the raw request body, in constant time, as used by webhook senders like GitHub and Stripe. Throws at creation if `secret` is empty. Logs a warning at creation if `replay` isn't set (pass `false` to turn replay protection off without the warning). Responds `401` for a missing or wrong signature. Needs `rawBody()` first.

```ts
auth.hmac(options: HmacAuthOptions): RequestHandler
```

```ts
import { ApiRoute, auth, rawBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    rawBody(),
    auth.hmac({
      secret: process.env.GITHUB_WEBHOOK_SECRET!,
      header: 'x-hub-signature-256',
      parseSignature: value => value.replace('sha256=', ''),
      replay: false, // GitHub doesn't send a timestamp
    }),
  ],
  post: async (req, res) => {
    res.status(204).send();
  },
};
```

See [HMAC signature auth](./auth.md#hmac-signature-auth).

### `auth.HmacAuthOptions`

The options passed to `auth.hmac()`.

```ts
interface HmacAuthOptions {
  secret: string;                             // shared signing secret, non-empty
  header: string;                             // header carrying the signature
  parseSignature?: (value: string) => string; // turns the header value into a hex digest
  replay?: HmacReplayOptions | false;         // turns on replay protection; false leaves it off, unset warns at startup
}
```

```ts
import { ApiRoute, auth, rawBody } from '@vulps22/pathfinder';

const shopifyWebhook: auth.HmacAuthOptions = {
  secret: process.env.SHOPIFY_WEBHOOK_SECRET!,
  header: 'x-shopify-hmac-sha256',
  // Shopify sends base64, so convert it to hex
  parseSignature: value => Buffer.from(value, 'base64').toString('hex'),
  // Shopify sends no timestamp, so replay protection can't be used
  replay: false,
};

export const route: ApiRoute = {
  middleware: [rawBody(), auth.hmac(shopifyWebhook)],
  // ...
};
```

### `auth.HmacReplayOptions`

The `replay` option of `auth.hmac()`. Requires a timestamp header, includes it in the signed payload, rejects timestamps outside the tolerance window, and rejects a request it has already accepted.

```ts
interface HmacReplayOptions {
  timestampHeader: string; // header carrying Unix time in seconds
  toleranceSeconds?: number; // default 300
  signedPayload?: (timestamp: string, body: Buffer) => Buffer | string; // default `${timestamp}.${body}`
  store?: ReplayStore; // default auth.memoryReplayStore()
}
```

```ts
import { ApiRoute, auth, rawBody } from '@vulps22/pathfinder';

// Slack signs `v0:<timestamp>:<body>` and sends `v0=<hex>`
const slackReplay: auth.HmacReplayOptions = {
  timestampHeader: 'x-slack-request-timestamp',
  toleranceSeconds: 300,
  signedPayload: (timestamp, body) => `v0:${timestamp}:${body.toString('utf8')}`,
};

export const route: ApiRoute = {
  middleware: [
    rawBody(),
    auth.hmac({
      secret: process.env.SLACK_SIGNING_SECRET!,
      header: 'x-slack-signature',
      parseSignature: value => value.replace('v0=', ''),
      replay: slackReplay,
    }),
  ],
  // ...
};
```

See [Replay protection](./auth.md#replay-protection).

### `auth.memoryReplayStore()`

Creates the in-memory `ReplayStore` that `replay` uses by default. Entries expire as their timestamps leave the window. It only protects a single process, so use a shared store when running several instances. Create it yourself to share one store across several routes.

```ts
auth.memoryReplayStore(): ReplayStore
```

```ts
import { auth } from '@vulps22/pathfinder';

// One store shared by two webhook routes, so a request replayed against the other route is caught too
export const webhookReplayStore = auth.memoryReplayStore();

// routes/webhooks/orders.ts and routes/webhooks/refunds.ts both use:
auth.hmac({
  secret: process.env.WEBHOOK_SECRET!,
  header: 'x-signature',
  replay: { timestampHeader: 'x-timestamp', store: webhookReplayStore },
});
```

### `auth.ReplayStore`

The interface for where `replay` records requests it has accepted. `add(key, expiresAt)` must atomically record the key until `expiresAt` (milliseconds since epoch), returning `true` if it was new and `false` if it was already there.

```ts
interface ReplayStore {
  add(key: string, expiresAt: number): boolean | Promise<boolean>;
}
```

```ts
import { auth } from '@vulps22/pathfinder';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const redisReplayStore: auth.ReplayStore = {
  add: async (key, expiresAt) =>
    (await redis.set(`hmac:${key}`, '1', { NX: true, PXAT: expiresAt })) === 'OK',
};
```

## Errors

### `HttpError`

The base error class. Throw it from a handler or middleware and the error handler sends `{ "error": message }` with its `status`. The message defaults to the standard status text. Use it for statuses without their own class.

```ts
class HttpError extends Error {
  constructor(status: number, message?: string);
  readonly status: number;
}
```

```ts
import { ApiRoute, HttpError, jsonBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [jsonBody()],
  post: async (req, res) => {
    if (await users.exists(req.body.username)) {
      throw new HttpError(409, 'Username already taken'); // 409 { "error": "Username already taken" }
    }
    res.status(201).json(await users.create(req.body));
  },
};
```

See [Errors](./errors.md).

### `BadRequestError`

Sends a `400`. Default message: `Bad Request`.

```ts
class BadRequestError extends HttpError {
  constructor(message?: string);
}
```

```ts
if (!req.body.email) throw new BadRequestError('email is required');
```

### `NotAuthorisedError`

Sends a `401`. Default message: `Unauthorized`.

```ts
class NotAuthorisedError extends HttpError {
  constructor(message?: string);
}
```

```ts
const session = await sessions.find(req.headers['x-session-id']);
if (!session) throw new NotAuthorisedError('Session expired');
```

### `ForbiddenError`

Sends a `403`. Default message: `Forbidden`.

```ts
class ForbiddenError extends HttpError {
  constructor(message?: string);
}
```

```ts
if (invoice.ownerId !== session.userId) throw new ForbiddenError();
```

### `NotFoundError`

Sends a `404`. Default message: `Not Found`.

```ts
class NotFoundError extends HttpError {
  constructor(message?: string);
}
```

```ts
const order = await orders.find(req.params.id);
if (!order) throw new NotFoundError('Order not found');
```

### `InternalServerError`

Sends a `500` and logs the error server-side. Default message: `Internal Server Error`.

```ts
class InternalServerError extends HttpError {
  constructor(message?: string);
}
```

```ts
if (!process.env.PAYMENT_API_KEY) {
  throw new InternalServerError('Payments are not configured');
}
```

### `errorHandler`

The Express error handler `createServer()` installs. It sends `HttpError`s as `{ "error": message }` with their status, keeps other 4xx statuses with a generic message, and turns anything else into a logged `500` without leaking the message or stack. Add it yourself only when mounting Pathfinder middleware on your own Express app.

```ts
const errorHandler: ErrorRequestHandler;
```

```ts
import express from 'express';
import { auth, errorHandler } from '@vulps22/pathfinder';

const app = express();
app.get('/reports', auth.bearer({ consumers: { reporting: process.env.REPORTING_TOKEN } }), getReports);
app.use(errorHandler); // after all routes

app.listen(3000);
```

See [Using your own Express app](./errors.md#using-your-own-express-app).

## Request properties

### `req.consumer`

The name of the consumer whose token matched, set by `auth.bearer()`. `undefined` on routes without bearer auth.

```ts
req.consumer?: string
```

```ts
import { ApiRoute, auth } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [auth.bearer({ consumers: { billingService: process.env.BILLING_SERVICE_TOKEN } })],
  post: async (req, res) => {
    await auditLog.write({ action: 'refund', by: req.consumer }); // "billingService"
    res.status(204).send();
  },
};
```
