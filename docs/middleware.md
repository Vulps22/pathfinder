# Middleware

Pathfinder's middleware are plain Express `RequestHandler`s, used through a route's `middleware` list (see [Routing](./routing.md#per-route-middleware)).

## Body parsing

### `jsonBody()`

Parses an `application/json` body into `req.body`.

```ts
import { ApiRoute, jsonBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [jsonBody()],
  post: async (req, res) => {
    res.status(201).json({ received: req.body });
  },
};
```

Malformed JSON gets `400 { "error": "Bad Request" }`, and bodies over Express's default 100kb limit get a `413`.

### `rawBody()`

Reads an `application/json` body into `req.body` as a `Buffer`, without parsing it. [`auth.hmac()`](./auth.md#hmac-signature-auth) needs this, because the signature is computed over the exact bytes that were sent.

```ts
middleware: [rawBody(), auth.hmac({ /* ... */ })],
```

Use one or the other on a route, not both.

## Authentication

The `auth` middleware have their own page: [Authentication](./auth.md).
