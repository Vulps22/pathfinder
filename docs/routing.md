# Routing

## File-based routing

Each file under `routesPath` becomes a route. The file path maps to a URL path:

| File | URL |
|---|---|
| `routes/api/v1/ping.js` | `/api/v1/ping` |
| `routes/api/v1/item/index.js` | `/api/v1/item` |
| `routes/api/v1/item/[id].js` | `/api/v1/item/:id` |
| `routes/api/v1/item/[id]/action.js` | `/api/v1/item/:id/action` |

- Square-bracket segments (`[id]`) become Express dynamic params (`:id`), available as `req.params.id`.
- `index.js` files map to their parent directory.
- Only compiled `.js` files are loaded, so point `routesPath` at your build output.

### Static segments win

Routes are sorted so static segments take priority over dynamic ones. For example, `item/random.js` is registered before `item/[id].js`, so `GET /item/random` isn't swallowed by the `:id` route.

This is deliberate. A more specific file is a separate handler with its own middleware, so `teams/public/members.js` and `teams/[id]/members.js` can have different auth.

## Route file shape

Each route file exports a `route` object implementing `ApiRoute`. Define any combination of `get`, `post`, `put`, `patch`, `delete`, `head` and `options`:

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

A request using a method the file doesn't define gets a `404`, unless the file defines `all`.

### `head`

Express already answers `HEAD` with your `get` handler, minus the body. Define `head` when you can answer more cheaply, for example by skipping the database read and only sending headers:

```ts
// routes/reports/[id].ts  ->  /reports/:id
import { ApiRoute, NotFoundError } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    res.json(await reports.load(req.params.id));
  },
  head: async (req, res) => {
    const size = await reports.size(req.params.id);
    if (size === null) throw new NotFoundError('Report not found');
    res.set('Content-Length', String(size)).end();
  },
};
```

### `options`

Handles `OPTIONS` requests, such as a browser's CORS preflight:

```ts
// routes/orders/index.ts  ->  /orders
import { ApiRoute } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  options: async (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': 'https://shop.example.com',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }).status(204).end();
  },
  get: async (req, res) => {
    res.set('Access-Control-Allow-Origin', 'https://shop.example.com');
    res.json(await orders.list());
  },
};
```

### `all`

Catches any method the file doesn't define. Methods the file does define still go to their own handler. Useful for a custom `405` or for proxying:

```ts
// routes/invoices/[id].ts  ->  /invoices/:id
import { ApiRoute, HttpError } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    res.json(await invoices.find(req.params.id));
  },
  all: async (req, res) => {
    res.set('Allow', 'GET, HEAD');
    throw new HttpError(405, 'Method Not Allowed');
  },
};
```

## Per-route middleware

Attach an ordered list of Express middleware via `middleware`. It runs before the matched handler, for every method in the file:

```ts
import { ApiRoute, auth, jsonBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    auth.bearer({ consumers: { billing: process.env.BILLING_TOKEN } }),
    jsonBody(),
  ],
  post: async (req, res) => {
    res.status(201).json({ createdBy: req.consumer, invoice: req.body });
  },
};
```

Any Express `RequestHandler` works here, including your own. See [Middleware](./middleware.md) and [Authentication](./auth.md) for the built-in ones.

## Listing routes

`listRoutes()` returns every route file under a folder with its path, methods and source file, in registration order, without starting a server:

```ts
import { listRoutes } from '@vulps22/pathfinder';

console.table(await listRoutes(__dirname + '/routes'));
```

See [`listRoutes()`](./api.md#listroutes) for the full shape.
