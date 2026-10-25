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

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on Carlo-Codes/ForkLift (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
