# @vulps22/pathfinder

File-based dynamic Express router with composable middleware. Drop route files into a folder and they're registered automatically — no manual `app.get(...)` wiring.

## Installation

This package is published to GitHub Packages, not the public npm registry.

Add the registry to your `.npmrc`:

```
@vulps22:registry=https://npm.pkg.github.com
```

Then install:

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

## Exports

- `createServer(options: ServerOptions): Promise<http.Server>`
- `jsonBody(): RequestHandler`
- `rawBody(): RequestHandler`
- `auth.bearer(options: BearerAuthOptions): RequestHandler`
- `auth.hmac(options: HmacAuthOptions): RequestHandler`
- Types: `ApiRoute`, `Middleware`, `ServerOptions`, `BearerAuthOptions`, `HmacAuthOptions`

## Requirements

- Node.js `>=20.6.0`
- `express@^5` (peer dependency)

## Development

```bash
npm run build          # compile TypeScript to dist/
npm test               # run jest test suite
npm run test:coverage  # run tests with coverage
```
