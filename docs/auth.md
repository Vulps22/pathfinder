# Authentication

The `auth` export holds two middleware: `auth.bearer()` for API tokens and `auth.hmac()` for signed webhooks. Add them to a route's `middleware` list (see [Routing](./routing.md#per-route-middleware)).

Both reject requests by throwing [error classes](./errors.md), so their responses come back as JSON. `createServer()` installs the error handler that does this. If you mount them on your own Express app, add `app.use(errorHandler)` after your routes.

## Bearer auth

Checks an `Authorization: Bearer <token>` header against a map of named consumers. On success, `req.consumer` is set to the matching consumer's name.

```ts
import { ApiRoute, auth } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    auth.bearer({
      consumers: {
        billingService: process.env.BILLING_SERVICE_TOKEN,
        adminDashboard: process.env.ADMIN_DASHBOARD_TOKEN,
      },
      blockedInEnvironment: { production: ['adminDashboard'] },
      environment: process.env.ENVIRONMENT,
    }),
  ],
  get: async (req, res) => {
    res.status(200).json({ calledBy: req.consumer }); // "billingService"
  },
};
```

### Options

| Option | Type | Description |
|---|---|---|
| `consumers` | `Record<string, string \| undefined>` | Consumer name to token. Entries with an empty or missing token are skipped, so an unset environment variable never matches. |
| `blockedInEnvironment` | `Record<string, string[]>` | Optional. Environment name to the consumers refused there. |
| `environment` | `string` | Optional. The current environment. Defaults to `process.env.ENVIRONMENT`. |

### Responses

| Situation | Response |
|---|---|
| No header, or it doesn't start with `Bearer ` | `401 { "error": "Missing or malformed Authorization header" }` |
| Token matches no consumer | `401 { "error": "Invalid token" }` |
| Token matches a consumer blocked in this environment | `403 { "error": "Forbidden" }` |

The `403` is deliberately generic and doesn't name the consumer or the environment. Tokens are compared in constant time, so response timing doesn't leak how much of a token was right.

## HMAC signature auth

Verifies an HMAC-SHA256 signature over the request body, the way services like GitHub and Stripe sign webhooks. Signatures are compared in constant time.

`rawBody()` must run first so the exact bytes that were signed are available.

```ts
import { ApiRoute, auth, rawBody } from '@vulps22/pathfinder';

export const route: ApiRoute = {
  middleware: [
    rawBody(),
    auth.hmac({
      secret: process.env.GITHUB_WEBHOOK_SECRET!,
      header: 'x-hub-signature-256',
      parseSignature: value => value.replace('sha256=', ''),
    }),
  ],
  post: async (req, res) => {
    const event = JSON.parse(req.body.toString());
    res.status(204).send();
  },
};
```

`auth.hmac()` throws when it's created with an empty or missing `secret`, so a misconfigured environment fails at startup instead of accepting forged signatures.

### Options

| Option | Type | Description |
|---|---|---|
| `secret` | `string` | The shared signing secret. Required and non-empty. |
| `header` | `string` | The header carrying the signature. |
| `parseSignature` | `(value: string) => string` | Optional. Turns the header value into a hex digest, e.g. stripping a `sha256=` prefix. |
| `replay` | `HmacReplayOptions` | Optional. Turns on [replay protection](#replay-protection). |

### Responses

| Situation | Response |
|---|---|
| Signature header missing | `401 { "error": "Missing <header> header" }` |
| `rawBody()` didn't run first | `400` with a message saying so |
| Signature doesn't match | `401 { "error": "Invalid signature" }` |

### Replay protection

By default, a captured signed request can be sent again and will still pass. If the sender includes a timestamp header, turn on `replay` to block that:

```ts
auth.hmac({
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
  header: 'x-signature',
  replay: {
    timestampHeader: 'x-timestamp', // Unix time in seconds
    toleranceSeconds: 300,          // default: 5 minutes either side of now
  },
}),
```

With `replay` on:

- The signature must cover the timestamp as well as the body. By default the signed string is `<timestamp>.<body>` (Stripe's format). Use `signedPayload(timestamp, body)` to match other formats, such as Slack's `v0:<timestamp>:<body>`.
- A missing timestamp gets `401 { "error": "Missing <timestampHeader> header" }`.
- A malformed or out-of-window timestamp gets `401 { "error": "Request timestamp outside tolerance" }`.
- Each accepted request is remembered until its timestamp leaves the window, so sending it again gets `401 { "error": "Request already processed" }`.

| `replay` option | Type | Description |
|---|---|---|
| `timestampHeader` | `string` | The header carrying the Unix timestamp in seconds. |
| `toleranceSeconds` | `number` | Optional. How far from now a timestamp may be. Default `300`. Must be positive. |
| `signedPayload` | `(timestamp: string, body: Buffer) => Buffer \| string` | Optional. Builds the bytes the signature covers. |
| `store` | `ReplayStore` | Optional. Where seen requests are recorded. Defaults to `auth.memoryReplayStore()`. |

#### Running several instances

The default store is in memory, so it only protects a single process. With more than one instance, pass a shared `store`. Its `add(key, expiresAt)` must atomically record the key and return `false` if it was already there. With Redis:

```ts
replay: {
  timestampHeader: 'x-timestamp',
  store: {
    add: async (key, expiresAt) =>
      (await redis.set(`hmac:${key}`, '1', { NX: true, PXAT: expiresAt })) === 'OK',
  },
},
```
