# Contributing

## Development

```bash
npm install
npm run build          # compile TypeScript to dist/
npm test               # run jest test suite
npm run test:coverage  # run tests with coverage
```

CI runs the tests on Node 20 and 22 for every pull request, and pull requests must keep coverage at 95% or above.

## Branches

Each branch holds one bug fix or one feature, branched from `main`, named `<type>/<issue>-<verbed-summary>`, for example `bug/10-fix-crash-when-address-in-use`. See [CLAUDE.md](./CLAUDE.md) for the full rules.

## Documentation

User docs live in [`docs/`](./docs/index.md) as plain markdown. Keep one `#` heading per page and link between pages with relative links (`./auth.md`), so the folder can later be built into a site with VitePress.

Every export gets its own entry in [`docs/api.md`](./docs/api.md) with a short description, its signature and a realistic example. Add one when you add an export.

## Releasing

Publishing a GitHub release publishes the package to npm (see `.github/workflows/release.yml`).

1. Bump `version` in `package.json` on `main`, e.g. `1.1.0`.
2. Create a GitHub release with a matching tag, e.g. `v1.1.0`. The workflow fails if the tag and version differ.
3. The workflow runs the tests, then publishes with provenance. Releases marked as pre-release are published under the `next` dist-tag.
