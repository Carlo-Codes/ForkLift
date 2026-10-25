# ForkLift

A free, open-source, local-first app for planning and running set-based weight-training workouts.
No account, no tracking: all data lives on the phone. Licensed AGPL-3.0.

## Getting started

Requires Node 22 and pnpm 11 (`corepack enable`, or `npx pnpm@11.9.0`).

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

The app needs an Expo **dev build**, not Expo Go:

```sh
cd packages/mobile
pnpm android   # or: pnpm ios — builds and installs the dev client
pnpm start     # Metro for the dev client
```

## Layout

| Package | What it is |
| --- | --- |
| `packages/db` | Drizzle schema (the only place table shape lives), db registry, test DB |
| `packages/core` | Domain services; runs on the phone and in Node tests |
| `packages/debug` | `createDebugger` and `ApiError` |
| `packages/mobile` | Expo Router app |
| `tooling/*` | Shared TypeScript, ESLint, Prettier, Jest and Tailwind config |

Schema changes: edit `packages/db/src/schemas/*Model.ts`, run
`pnpm --filter @forklift/db db:generate --name <change>`, and mirror the table in the bootstrap SQL
in `packages/mobile/src/db/client.ts`.

See `docs/blueprint.md` for conventions, `docs/adr/` for decisions and `GLOSSARY.md` for terms.
