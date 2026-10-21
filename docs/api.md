# API reference

## Server

- `createServer(options: ServerOptions): Promise<http.Server>`. See [Getting started](./getting-started.md).

| `ServerOptions` | Type | Description |
|---|---|---|
| `port` | `number` | Port to listen on. |
| `routesPath` | `string` | Folder of compiled route files. See [Routing](./routing.md). |

## Middleware

- `jsonBody(): RequestHandler`. See [Middleware](./middleware.md#jsonbody).
- `rawBody(): RequestHandler`. See [Middleware](./middleware.md#rawbody).
- `auth.bearer(options: BearerAuthOptions): RequestHandler`. See [Bearer auth](./auth.md#bearer-auth).
- `auth.hmac(options: HmacAuthOptions): RequestHandler`. See [HMAC signature auth](./auth.md#hmac-signature-auth).
- `auth.memoryReplayStore(): ReplayStore`. See [Replay protection](./auth.md#replay-protection).

## Errors

See [Errors](./errors.md).

- `HttpError`, `BadRequestError`, `NotAuthorisedError`, `ForbiddenError`, `NotFoundError`, `InternalServerError`
- `errorHandler: ErrorRequestHandler`

## Types

- `ApiRoute`, `Middleware`
- `ServerOptions`
- `BearerAuthOptions`, `HmacAuthOptions`, `HmacReplayOptions`, `ReplayStore` (exported under `auth`, e.g. `auth.BearerAuthOptions`)

## Request properties

- `req.consumer?: string` is set by `auth.bearer()` to the matched consumer's name.
