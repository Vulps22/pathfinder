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

Each route file exports a `route` object implementing `ApiRoute`. Define any combination of `get`, `post`, `put`, `patch` and `delete`:

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

A request using a method the file doesn't define gets a `404`.

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
