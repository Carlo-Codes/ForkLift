## Project blueprint

ForkLift is a pnpm + Turborepo TypeScript monorepo (Node 22, ESM) built to the blueprint in
`docs/blueprint.md`. Read the matching section of it before **bootstrapping** a package, **adding an
entity** (§10 checklist), writing a **model / Db / Service / route** (§5–8), touching **tooling**
config (§3–4), or the **mobile** app (§9).

Always true:

- **Local-first deviation from the blueprint** (ADR-0001): the phone is the source of truth, `core`
  runs on-device (no Node-only APIs), `mobile → core → db`, and there is no `api` package in v1 (it
  returns later as the encrypted sync relay). The MCP server lives in the app (ADR-0002).
- Packages: `db` (Drizzle schema + connection, the only place table shape lives), `core` (domain:
  per-entity `<entity>Db.ts` + `<entity>Service.ts`), `debug` (`createDebugger`, `ApiError`),
  `mobile` (Expo). Shared configs live in `tooling/`.
- Synced tables use UUID ids, `updatedAt` and soft deletes (ADR-0003). AI writes never touch
  Sessions or Logged Sets. Use `GLOSSARY.md` terms in code and issues.
- Drizzle is pinned exactly to the newest 1.0 RC (`1.0.0-rc.5`), using the v1 `defineRelations`
  API. Every table goes in `relations.ts`'s `tables` **and** its `defineRelations` callback.
- Internal packages export raw `.ts`, consumed via `workspace:*`; no build step.
- Validate all API input with zod `safeParse` → 400 `ValidationError`. Log with `createDebugger`.
- Tests hit a real temp SQLite DB via `setupTestDb()`, seeded through `core` services.
- Package directory names are lowercase; migrations live in root `.drizzle/migrations/`.
- `core` imports only `@forklift/db/client` (RN-safe) and reads the db via `getDb()`, a registry
  filled by `setDb()`: mobile's `openDb()` registers expo-sqlite, `setupTestDb()` a temp
  better-sqlite3 file. `core` is consumed as `@forklift/core` (not `/server`).
- Both drivers are synchronous, so `core` Db/Service functions are **sync** (`.sync()` on
  relational queries, `.get()`/`.all()`/`.run()` on builders). Sync transactions reject async
  callbacks: compose with `getDb().transaction(tx => …)` and plain calls.
- Ids/timestamps are generated in JS (`crypto.randomUUID()`, polyfilled on device with
  `expo-crypto`), so tables need no SQL defaults that the on-device bootstrap SQL must mirror.
- Expo SDK 58 (RN 0.88, React 19.3): check alignment with `npx expo install --check` in
  `packages/mobile` (jest is excluded there; the repo stays on Jest 29 + ts-jest). Components take
  `ref` as a prop, not `forwardRef`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on Carlo-Codes/ForkLift (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
