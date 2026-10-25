# Local-first: the phone is the source of truth and `core` runs on-device

ForkLift has no account and no server in v1. All data lives in the phone's SQLite database, and
backup is a manual Export / Import of a file. The phone owns the data and hosts the MCP server
([ADR-0002](./0002-on-phone-mcp-with-toggle.md)), so the domain services in `core` run on the
device. They take a drizzle SQLite database: expo-sqlite in the app, a temporary SQLite database in
tests. This is a deliberate exception to the blueprint, which assumes a server owns the logic and
mobile imports only `@forklift/db/client`. Don't "fix" the app by moving logic back behind an API.

## Consequences

- The `api` package isn't created in v1. It comes back later as the encrypted sync relay
  ([ADR-0003](./0003-sync-ready-schema.md)), which stores data it can't read and has no domain
  logic.
- `core` must not use Node-only APIs.
