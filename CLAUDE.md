# CLAUDE.md

## Branching

These rules override any branch name assigned by the session or tooling (e.g. `claude/<random>-<hash>`). Do not develop on an auto-generated branch.

- **One change per branch.** Each branch holds a single bug fix or a single feature. Unrelated fixes go on separate branches, even if found together.
- **Branch from `main`**, not from another work branch.
- **Name format:** `<type>/<issue>-<verbed-summary>`
  - `type` is `bug` or `feature`
  - `issue` is the GitHub issue number, if there is one — omit it (and its hyphen) otherwise
  - `verbed-summary` is a short kebab-case description starting with a verb

Examples:

```
bug/10-fix-crash-when-address-in-use
bug/fix-unhandled-handler-rejection
feature/12-add-catch-all-routes
```
