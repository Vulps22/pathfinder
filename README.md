# @vulps22/pathfinder

File-based dynamic Express router with composable middleware. Drop route files into a folder and they're registered automatically, with no manual `app.get(...)` wiring.

## Installation

```bash
npm install @vulps22/pathfinder express
```

Requires Node.js `>=20.6.0` and `express@^5` (peer dependency).

## Quick start

```ts
// server.ts
import { createServer } from '@vulps22/pathfinder';

await createServer({
  port: 3000,
  routesPath: __dirname + '/routes',
});
```

```ts
// routes/users/[id].ts  ->  GET /users/:id
import { ApiRoute, NotFoundError } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    const user = await findUser(req.params.id);
    if (!user) throw new NotFoundError('User not found');
    res.json(user);
  },
};
```

## Documentation

- [Getting started](https://github.com/Vulps22/pathfinder/blob/main/docs/getting-started.md)
- [Routing](https://github.com/Vulps22/pathfinder/blob/main/docs/routing.md): file paths to URLs, route files, per-route middleware
- [Middleware](https://github.com/Vulps22/pathfinder/blob/main/docs/middleware.md): body parsing
- [Authentication](https://github.com/Vulps22/pathfinder/blob/main/docs/auth.md): bearer tokens, HMAC-signed webhooks, replay protection
- [Errors](https://github.com/Vulps22/pathfinder/blob/main/docs/errors.md): throwing HTTP errors, the built-in error handler
- [API reference](https://github.com/Vulps22/pathfinder/blob/main/docs/api.md)

## Contributing

See [CONTRIBUTING.md](https://github.com/Vulps22/pathfinder/blob/main/CONTRIBUTING.md).

## Licence

[MIT](https://github.com/Vulps22/pathfinder/blob/main/LICENSE)
