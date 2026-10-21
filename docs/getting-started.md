# Getting started

## Requirements

- Node.js `>=20.6.0`
- `express@^5` (peer dependency)

## Installation

```bash
npm install @vulps22/pathfinder express
```

## Create a server

```ts
import { createServer } from '@vulps22/pathfinder';

await createServer({
  port: 3000,
  routesPath: __dirname + '/routes',
});
```

`createServer()` scans `routesPath` for compiled `.js` route files, registers each one on a new Express app, installs the [error handlers](./errors.md), and starts listening. It resolves with the `http.Server` once the port is bound.

If `routesPath` doesn't exist, the server still starts and logs a warning, so every request gets a `404`.

## Add a route

Create `routes/api/v1/ping.ts`:

```ts
import { ApiRoute } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    res.status(200).json({ pong: true });
  },
};
```

Once compiled, `GET /api/v1/ping` returns `{ "pong": true }`.

## Next steps

- [Routing](./routing.md) covers dynamic segments like `/users/[id]`.
- [Authentication](./auth.md) shows how to protect a route.
