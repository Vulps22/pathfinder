# Errors

Every error response is JSON in the form `{ "error": "<message>" }`.

## Throwing errors

To send an error from a handler or middleware, throw one of the error classes. `createServer()` installs a global error handler that turns it into the response:

```ts
import { ApiRoute, NotFoundError } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  get: async (req, res) => {
    const user = await findUser(req.params.id);
    if (!user) throw new NotFoundError('User not found'); // 404 { "error": "User not found" }
    res.json(user);
  },
};
```

| Class | Status | Default message |
| --- | --- | --- |
| `BadRequestError` | 400 | Bad Request |
| `NotAuthorisedError` | 401 | Unauthorized |
| `ForbiddenError` | 403 | Forbidden |
| `NotFoundError` | 404 | Not Found |
| `InternalServerError` | 500 | Internal Server Error |

The message is optional, so `throw new ForbiddenError()` works too. For any other status, use `new HttpError(status, message)`, which all of these classes extend. Leave the message out and it defaults to the standard status text:

```ts
throw new HttpError(409, 'Username already taken');
throw new HttpError(429); // 429 { "error": "Too Many Requests" }
```

Throwing works directly inside handlers and middleware, including async ones. Inside a callback that runs later (e.g. `setTimeout`), pass the error to `next(err)` instead.

## What's handled for you

- Unmatched routes, and methods a route file doesn't define (unless it defines `all`), return `404 { "error": "Not Found" }`.
- Any other thrown error (a bug, a database failure) returns `500 { "error": "Internal Server Error" }` and is logged server-side with `console.error`. Its message and stack are never sent to the client.
- An `HttpError` with a 5xx status is sent with its message, and also logged.
- Client errors raised by other middleware keep their status with a generic message. For example, malformed JSON sent to a `jsonBody()` route returns `400 { "error": "Bad Request" }`.

## Using your own Express app

The built-in [auth middleware](./auth.md) throw these classes too, so their responses only come back as JSON when the error handler is installed. `createServer()` does that for you. If you mount `auth.bearer()` or `auth.hmac()` on your own Express app, add the handler after your routes:

```ts
import express from 'express';
import { auth, errorHandler } from '@vulps22/pathfinder';

const app = express();
app.get('/reports', auth.bearer({ consumers: { reporting: process.env.REPORTING_TOKEN } }), getReports);
app.use(errorHandler);
```
