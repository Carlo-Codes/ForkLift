# ForkLift Blueprint: TypeScript Monorepo (API + Domain + DB + Mobile)

How ForkLift is structured, tooled and written. Adapted from `PROJECT_BLUEPRINT.md` in the
reference implementation, the private repo `Carlo-Codes/PatchyInternetTest` ("Patchy"). When
copying `tooling/` or configs from it, clone it (`gh repo clone Carlo-Codes/PatchyInternetTest`)
and rename the `@patchy` scope to `@forklift`. Everything below is enough to rebuild without it.

npm scope: `@forklift`. Display name (debug namespaces): `ForkLift`.

---

## 1. Tech stack

| Concern | Choice | Version used |
| --- | --- | --- |
| Runtime | Node | 22 (`.nvmrc` = `22`, `engines.node >= 22`) |
| Package manager | pnpm workspaces | `pnpm@11.9.0` (`packageManager` field) |
| Task runner | Turborepo | `turbo@2.10.0` |
| Language | TypeScript, strict, ESM everywhere (`"type": "module"`) | `typescript@^6` |
| DB / ORM | SQLite + Drizzle ORM **v1 RC** (`defineRelations` API), pinned exactly — newest RC; switch to 1.0 stable once it ships | `drizzle-orm@1.0.0-rc.5`, `drizzle-kit@1.0.0-rc.5` |
| Server SQLite driver | `better-sqlite3` | `^12` |
| Validation | Zod v4 (hand-written schemas, not drizzle-zod generators) | `zod@^4.3.6` |
| API | Express 4 + `cors`, run with `tsx` (no build step) | `express@^4.21`, `tsx@^4` |
| Logging / errors | `debug` package wrapped in an internal package; shared `ApiError` | `debug@^4` |
| Tests | Jest 29 + `ts-jest` (ESM), `supertest` for HTTP | `jest@^29`, `ts-jest@^29` |
| Lint | ESLint 9 flat config, `typescript-eslint` type-checked, `eslint-plugin-import-x`, `eslint-plugin-turbo` | `eslint@^9` |
| Format | Prettier 3 + `@ianvs/prettier-plugin-sort-imports` + `prettier-plugin-tailwindcss` | `prettier@^3` |
| Mobile (optional) | Expo SDK 58 + Expo Router, `expo-sqlite` + Drizzle, NativeWind 4 (Tailwind 3.3) | `expo@~58`, `react-native@0.88`, `react@19.3` |

Do not add a build step for internal packages: they export raw `.ts` via `exports`/`main` and are
consumed directly through `workspace:*` (bundler module resolution + `tsx`/`ts-jest`/Metro handle
it).

---

## 2. Directory layout

```
.
├── CLAUDE.md                  # agent guidance for THIS project (write it as you go)
├── .drizzle/migrations/       # drizzle-kit output (repo root, NOT inside packages/db)
├── .nvmrc                     # 22
├── drizzle.config.ts          # root drizzle-kit config, absolute paths
├── eslint.config.mjs          # root: [...baseConfig]
├── package.json               # root scripts → turbo
├── pnpm-workspace.yaml
├── tsconfig.json              # root: extends @forklift/tsconfig/base.json
├── turbo.json
├── README.md                  # design rationale + trade-offs
├── packages/
│   ├── db/        @forklift/db       schema + connection (only place table shape lives)
│   ├── core/      @forklift/core     domain layer: per-entity Db + Service
│   ├── api/       @forklift/api      Express app, routes, handlers
│   ├── debug/     @forklift/debug    createDebugger + ApiError
│   └── mobile/    @forklift/mobile   Expo Router app (optional)
└── tooling/
    ├── eslint/      @forklift/eslint-config     (base.js, react.js)
    ├── prettier/    @forklift/prettier-config   (index.mjs)
    ├── typescript/  @forklift/tsconfig          (base.json)
    ├── jest/        @forklift/jest-config       (index.js → jestModuleBaseConfig)
    └── tailwind/    @forklift/tailwind-config   (index.ts, postcss.js; only if there's a UI)
```

**Dependency direction (never reverse it):** `api → core → db`, everything → `debug`,
`mobile → db/client`. `db` must not import `core`; `core` must not import `api`.

**Directory names are lowercase.** A capitalised package dir (`packages/Mobile`) works on macOS but
breaks `pnpm install` on Linux because the lockfile importer key is lowercase.

---

## 3. Root config files

`pnpm-workspace.yaml`
```yaml
packages:
  - "tooling/*"
  - "packages/*"
allowBuilds:
  better-sqlite3: true
  esbuild: true
  unrs-resolver: true
publicHoistPattern:
  - "@ianvs/prettier-plugin-sort-imports"
  - "prettier-plugin-tailwindcss"
```

`package.json` (root)
```json
{
  "name": "@forklift",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "format": "turbo run format",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db": "drizzle-kit --config=drizzle.config.ts"
  },
  "devDependencies": {
    "@forklift/eslint-config": "workspace:*",
    "@forklift/prettier-config": "workspace:*",
    "@forklift/tsconfig": "workspace:*",
    "drizzle-kit": "1.0.0-rc.5",
    "eslint": "^9",
    "prettier": "^3",
    "turbo": "2.10.0",
    "typescript": "^6"
  },
  "prettier": "@forklift/prettier-config"
}
```
(Patchy lacks the root `build` script; ForkLift includes it from the start.)

`turbo.json`
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "persistent": true, "cache": false },
    "format": { "outputs": ["node_modules/.cache/.prettiercache"] },
    "lint": { "outputs": ["node_modules/.cache/.eslintcache"] },
    "typecheck": { "outputs": ["node_modules/.cache/tsbuildinfo.json"] },
    "test": {},
    "clean:self": { "cache": false },
    "clean-cache:self": { "cache": false }
  }
}
```

`drizzle.config.ts` — use absolute paths anchored to the file so it works whether invoked from the
root or from `packages/db`:
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: path.join(ROOT_DIR, "./packages/db/src/schemas/*Model.ts"),
  out: path.join(ROOT_DIR, "./.drizzle/migrations"),
  dialect: "sqlite",
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? path.join(ROOT_DIR, "./packages/db/local.db")
  }
});
```

`.gitignore` must include: `node_modules`, `.turbo`, `dist`, `.env`, `.env*`, `*.db`/`local.db`,
`*.db-journal`, `*.db-wal`, `*.db-shm`, `.expo`.

---

## 4. Shared tooling packages

Every workspace package depends on these as `workspace:*` devDependencies and has the same four
scripts:

```json
"lint": "eslint .",
"format": "eslint --fix .",
"typecheck": "tsc --noEmit",
"test": "NODE_OPTIONS=--experimental-vm-modules jest --silent=false --detectOpenHandles"
```

Tooling packages set `"installConfig": { "hoistingLimits": "none" }` and `"private": true`.

### `tooling/typescript/base.json`
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "checkJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noUncheckedIndexedAccess": true
  },
  "exclude": ["node_modules", "build", "dist", ".expo", ".web"]
}
```
Per-package `tsconfig.json`:
```json
{
  "extends": "@forklift/tsconfig/base.json",
  "compilerOptions": {
    "tsBuildInfoFile": "node_modules/.cache/tsbuildinfo.json",
    "types": ["jest", "node"],
    "rootDir": "."
  },
  "include": ["."],
  "exclude": ["node_modules"]
}
```
Mobile instead extends `["expo/tsconfig.base", "@forklift/tsconfig/base.json"]`, uses
`"types": ["jest"]` and `"paths": { "@/*": ["./src/*"] }`.

### `tooling/eslint` (`base.js`, `react.js`)
Exports `./base` and `./react`. Per-package `eslint.config.mjs` is just
`export default [...baseConfig];` (mobile adds `...reactConfig`, turns off
`import-x/no-unused-modules` and `import-x/no-cycle` because they choke on React Native's Flow
entrypoint, and ignores `.expo/**`).

`base.js` = `typescript-eslint` `flat/recommended-type-checked` + `flat/stylistic-type-checked`
with `parserOptions.project: true`, globals `es2022 + node + jest`, plugins `import-x` and `turbo`.
The house style it enforces (copy `tooling/eslint/base.js` from Patchy verbatim when possible):

- Double quotes, semicolons always, 2-space indent, **no trailing commas**.
- **Spaces inside array brackets and computed props**: `[ a, b ]`, `obj[ key ]`, `const [ x ] = …`.
- Spaces inside object braces `{ a }`; objects with **≥3 properties** (literals, destructuring,
  imports, exports) break one-per-line; arrays with ≥3 elements break one-per-line.
- `arrow-parens: as-needed` (`x => x`), `operator-linebreak: after` (ternary `?`/`:` at line end).
- `padding-line-between-statements`: blank line after imports, before `return`/`if`/`for`/`try`,
  around multi-line `const`s; consecutive single-line `const`/`let` stay together.
- `import-x/order` groups: builtin, external, internal (`@forklift/**`), then parent/sibling, with
  blank lines between groups; `import-x/no-cycle` (maxDepth 2); no file extensions in imports.
- `@typescript-eslint/consistent-type-imports` with **separate** `import type { … }` statements.
- Unused vars allowed only with `_` prefix. `no-console` warns (except `warn`/`error`) — use the
  debug package instead.
- Ignores `*.config.{js,cjs,mjs}`, `*.test.ts`, `dist/**`.

`react.js` adds `eslint-plugin-react` flat recommended, `react-hooks` `recommended-latest`,
`jsx-a11y` recommended, `react/prop-types: off`, one JSX prop per line, browser globals.

### `tooling/prettier/index.mjs`
Plugins `@ianvs/prettier-plugin-sort-imports` and `prettier-plugin-tailwindcss` (pointing
`tailwindConfig` at `tooling/tailwind/index.ts`). `importOrder`:
```js
[
  "^(react/(.*)$)|^(react$)|^(react-native(.*)$)",
  "^(expo(.*)$)|^(expo$)",
  "<THIRD_PARTY_MODULES>",
  "",
  "^@forklift/(.*)$",
  "",
  "^~/",
  "^[../]",
  "^[./]"
]
```
Every package.json sets `"prettier": "@forklift/prettier-config"`.

### `tooling/jest/index.js`
```js
export const jestModuleBaseConfig = {
  preset: "ts-jest",
  extensionsToTreatAsEsm: [ ".ts" ],
  globalSetup: "<rootDir>/jest.setup.ts",
  displayName: "@forklift",
  passWithNoTests: true,
  testMatch: [ "<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)" ],
  testPathIgnorePatterns: [ "/node_modules/", "/dist/", "/types/" ],
  transform: { "\\.[jt]sx?$": [ "ts-jest", { useESM: true } ] }
};
```
Each package has `jest.config.mjs`:
```js
import { jestModuleBaseConfig } from "@forklift/jest-config";

export default { ...jestModuleBaseConfig, displayName: "@forklift/<pkg>" };
```
and a `jest.setup.ts` (`export default function setup() { return undefined; }`, or loading
`.env.test` via dotenv when the package needs env). Tests live in `src/**/__tests__/*.test.ts`.

---

## 5. `packages/db` — schema and connection

`package.json` exports two entrypoints, no build:
```json
"exports": {
  "./client": ["./src/client.index.ts"],
  "./server": ["./src/server.index.ts"]
},
"scripts": {
  "db:generate": "drizzle-kit generate --config ../../drizzle.config.ts",
  "db:migrate": "drizzle-kit migrate --config ../../drizzle.config.ts"
}
```
- `./server` — Node-only: re-exports `drizzle-orm`, all schemas, `getDb`, `runMigrations`,
  pagination helpers, query-filter types, `setupTestDb`.
- `./client` — safe for React Native (no `better-sqlite3`): re-exports `drizzle-orm`, table
  objects, zod schemas, `export type * from "./schemas"`, and `relations`/`tables`.

```
packages/db/src/
├── schemas/
│   ├── <entity>Model.ts   # one file per table; filename MUST end in Model.ts (config glob)
│   └── index.ts           # export * from "./<entity>Model";  for every model
├── relations.ts           # `tables` object + defineRelations(...)
├── types.d.ts             # QueryFilters<T>, TransactionType, WhereInput<T>, …
├── dbUtils.ts             # Pagination, PaginatedData, formatPaginated, customCount
├── connection.ts          # getDb (lazy singleton), runMigrations
├── testUtils/db.ts        # setupTestDb(): temp-dir DB + migrate + teardown
├── server.index.ts
└── client.index.ts
```

### Model file convention (follow exactly)
```ts
import { sql } from "drizzle-orm";
import {
  integer, sqliteTable, text
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { parentTable } from "./parentModel";

export const widgetTable = sqliteTable("widget", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("clientId").notNull().unique(),          // only if client-generated ids are needed
  parentId: integer("parentId").references(() => parentTable.id, {
    onDelete: "restrict",
    onUpdate: "cascade"
  }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const widgetSchema = z.object({
  id: z.number().int().optional(),
  clientId: z.uuid(),
  parentId: z.number().int().nullable().optional(),
  createdAt: z.date().optional()
});

type WidgetDbSelect = typeof widgetTable.$inferSelect;
type WidgetDbInsert = typeof widgetTable.$inferInsert;
type WidgetCreateAttributes = z.infer<typeof widgetSchema>;
type WidgetAttributes = Omit<WidgetCreateAttributes, "id"> & { id: number };

export type {
  WidgetAttributes,
  WidgetDbSelect,
  WidgetDbInsert,
  WidgetCreateAttributes
};
```
Rules:
- Table var is camelCase + `Table`; SQL table name is camelCase singular.
- JS key and SQL column name are **identical camelCase** (`tagNumber: text("tagNumber")`), never
  snake_case.
- Integer autoincrement PKs. Client-generated reconciliation ids are an extra `text` uuid column
  (`clientId`), not the PK.
- FKs inline via `.references(() => x.id, { onDelete, onUpdate })` — always state both explicitly.
- Hand-write the `<entity>Schema` zod object mirroring the insert shape (`id` optional). Extra
  request-payload schemas (`<entity>CreatePayloadSchema`) live in the same file.
- End every model with a single `export type { … }` block of `<Entity>DbSelect`,
  `<Entity>DbInsert`, `<Entity>CreateAttributes`, `<Entity>Attributes`.
- Enum-like columns: export a `const <x>Values = [ … ] as const` and use
  `text("col", { enum: <x>Values })` + `z.enum(<x>Values)`.

### `relations.ts` (drizzle v1 API — not the old `relations()` helper)
```ts
import { defineRelations } from "drizzle-orm";

import { parentTable, widgetTable } from "./schemas";

export const tables = { parentTable, widgetTable };

export const relations = () => {
  return defineRelations(tables, r => ({
    parentTable: { widgets: r.many.widgetTable() },
    widgetTable: {
      parent: r.one.parentTable({
        from: r.widgetTable.parentId,
        to: r.parentTable.id,
        optional: false
      })
    }
  }));
};
```
**Every table must appear in `tables` AND in the callback** (use `{}` if it has no relations), or
`db.query.<x>Table` won't exist.

### `types.d.ts`
Derive everything from `tables` and `getDb`:
```ts
import type { getDb } from "./connection";
import type { Pagination } from "./dbUtils";
import type { tables } from "./relations";

export type TableNames = keyof typeof tables;
export type DatabaseType = Awaited<ReturnType<typeof getDb>>;
export type TransactionType = Parameters<Parameters<DatabaseType["transaction"]>[0]>[0];
export type WithInput<T extends TableNames> =
  NonNullable<Parameters<DatabaseType["query"][T]["findFirst"]>[0]> extends { with?: infer W } ? W : never;
export type WhereInput<T extends TableNames> =
  NonNullable<Parameters<DatabaseType["query"][T]["findFirst"]>[0]> extends { where?: infer W } ? W : never;
export type QueryReturnType<T extends TableNames> =
  NonNullable<Awaited<ReturnType<DatabaseType["query"][T]["findFirst"]>>>;
export type ColumnsInput<T extends TableNames> =
  Record<keyof (typeof tables)[T]["_"]["columns"], boolean>;
export interface QueryFilters<T extends TableNames> {
  columns?: ColumnsInput<T>;
  pagination?: Pagination<QueryReturnType<T>>;
  where?: WhereInput<T>;
  with?: WithInput<T>;
}
```

### `connection.ts`
- `getDb()` is a **lazy singleton** (`dbInstance ??= createDb()`) — never open a new
  `better-sqlite3` handle per call (leaks file descriptors).
- `createDb()` opens `process.env.DATABASE_URL ?? <packages/db/local.db>`, sets pragmas
  `foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`, and returns
  `drizzle({ client, relations: relations() })`.
- `runMigrations()` calls `migrate(getDb(), { migrationsFolder: <repo>/.drizzle/migrations })`;
  the API calls it once at boot.
- Resolve all paths with `path.resolve(path.dirname(fileURLToPath(import.meta.url)), …)`.

### `testUtils/db.ts`
`setupTestDb()` creates a `fs.mkdtempSync` dir, sets `process.env.DATABASE_URL` to a file in it
**before** first `getDb()`, runs migrations, and returns `{ teardown }` that `rmSync`s the dir.

### Pagination (`dbUtils.ts`)
`Pagination<T> = { limit, offset, orderBy }`; `PaginatedData<T> = { data, totalCount, pageCount,
currentPage }`; `formatPaginated(totalCount, pagination, rows)`; `customCount()` is an `extras`
helper (`count(*) over()`) so one query returns rows + total.

---

## 6. `packages/core` — domain layer

`package.json`: `"exports": { "./server": ["./src/server.index.ts"] }`, deps `@forklift/db`,
`@forklift/debug`, `zod`.

Folder per entity; child/join entities nest under their parent, mirroring the FK:
```
packages/core/src/
├── parent/
│   ├── src/{parentDb.ts, parentService.ts, index.ts}
│   └── widget/
│       └── src/{widgetDb.ts, widgetService.ts, index.ts}
├── queue/src/…                # background jobs, if any
└── server.index.ts            # export * from "./parent/src"; export * from "./parent/widget/src"; …
```

### `<entity>Db.ts` — raw drizzle, every function takes optional `tx`
```ts
import { eq, getDb, widgetTable } from "@forklift/db/server";
import type {
  QueryFilters,
  TransactionType,
  WidgetAttributes,
  WidgetCreateAttributes
} from "@forklift/db/server";

export async function getAllWidgetByQuery(
  filters: QueryFilters<"widgetTable">,
  tx?: TransactionType
): Promise<WidgetAttributes[]> {
  const db = tx ?? getDb();

  return await db.query.widgetTable.findMany({
    columns: filters.columns,
    where: filters.where,
    with: filters.with,
    orderBy: filters.pagination?.orderBy,
    offset: filters.pagination?.offset,
    limit: filters.pagination?.limit
  });
}
```
Required set: `getAll<Entity>ByQuery`, `get<Entity>ByQuery` (findFirst, may return `undefined`),
`create<Entity>Db` (insert…returning, throw if no row), `update<Entity>Db(id, data, tx?)`,
`delete<Entity>Db(id, tx?)`. Add `getAll<Entity>PaginatedByQuery` when a list endpoint needs it.

### `<entity>Service.ts` — thin pass-through
Same names without the `Db`/`ByQuery` suffix, same `tx?` parameter. The **only** logic by default:
single-record `get<Entity>` throws `new ApiError(404, "...not found", "NotFoundError")` on a miss.
Business rules that span entities go here or in a dedicated job module, composed inside
`getDb().transaction(async tx => …)`.

`index.ts`: `export * from "./<entity>Db"; export * from "./<entity>Service";`

---

## 7. `packages/debug` — logging and errors

```ts
// src/index.ts
import debug from "debug";

let enabled = false;

export function createDebugger(nameSpace: string) {
  if (!enabled && process.env.ENVIRONMENT === "development") {
    debug.enable("ForkLift:*");
    enabled = true;
  }

  return {
    log: debug(`ForkLift:${nameSpace}:`),
    info: debug(`ForkLift:${nameSpace}:INFO`),
    error: debug(`ForkLift:${nameSpace}:ERROR`)
  };
}

export { ApiError } from "./apiError";
```
```ts
// src/apiError.ts
export class ApiError extends Error {
  readonly statusCode: number;
  readonly type: string;

  constructor(statusCode: number, message: string, type = "ApiError") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.type = type;
  }
}
```
Keep errors in this package — don't create a separate `errors` package.

---

## 8. `packages/api` — Express app

```
packages/api/src/
├── index.ts                    # runMigrations(); ApiRouter.listen(PORT)
├── routes/
│   ├── index.ts                # Routes: CustomRouter[] → export const ApiRouter = buildRouter(Routes)
│   ├── status.ts               # GET / health check
│   ├── <resource>.ts           # one default-exported handler per file
│   └── __tests__/<resource>.test.ts
└── utils/
    ├── buildRouter.ts
    ├── apiEventHandler.ts
    └── pagination.ts
```
Scripts: `"dev": "ENVIRONMENT=development tsx watch src/index.ts"`, `"start": "tsx src/index.ts"`.
Port from `process.env.PORT` (default 4000).

- **`buildRouter(routes: CustomRouter[])`** — creates the express app (`cors()`, `express.json()`,
  `express.urlencoded`), and for each `{ baseUrl, endPoints: [{ method, path, eventHandler }] }`
  registers `router[method](baseUrl + path, …)` that calls the handler and does
  `res.status(statusCode).send(body)`.
- **`ApiEventHandler(handler)`** — wraps `async (req) => ({ statusCode, body })`; catches errors:
  `ApiError` → its `statusCode` + `{ message, type }`; anything else → 500
  `{ message, type: "InternalServerError" }`. Logs via `debug.error`.
- **Handler shape:**
  ```ts
  export default ApiEventHandler(async req => {
    const parsed = querySchema.safeParse(req.query ?? {});

    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map(i => i.message).join("; "), "ValidationError");
    }

    const result = await getAllWidgetPaginated({ … });

    return { statusCode: 200, body: { ...result } };
  });
  ```
  Validate all input with zod `safeParse` → 400 `ValidationError`. Handlers call **only**
  `@forklift/core/server`, never drizzle directly.
- **`parsePaginationQuery(query, allowedColumns, defaultOrderBy)`** — zod-coerced `limit`
  (default 20, max 100), `offset` (default 0), `orderBy` as `"<column>:asc|desc"` checked against
  an allow-list.
- For booleans in query strings use `z.enum(["true","false"])`, not `z.coerce.boolean()`
  (`"false"` coerces to `true`).
- No auth by default; mount routes at plain paths.

**Tests** use the real app and a real temp SQLite DB:
```ts
import request from "supertest";

import { setupTestDb } from "@forklift/db/server";

import { ApiRouter } from "../index";

describe("GET /widgets", () => {
  let teardown: () => void;

  beforeAll(() => { ({ teardown } = setupTestDb()); });
  afterAll(() => teardown());

  it("returns paginated widgets", async () => {
    const res = await request(ApiRouter).get("/widgets");

    expect(res.status).toBe(200);
  });
});
```
Seed through `core` service functions, not raw SQL. Don't mock the DB.

---

## 9. `packages/mobile` — Expo app (only if the project has a mobile client)

- Expo Router: screens in `app/` (`_layout.tsx`, `index.tsx`, `<resource>/[id].tsx`,
  `<resource>/new.tsx`); code in `src/` aliased as `@/*`.
- `main: "expo-router/entry"`; scripts `start`/`android`/`ios` plus the standard four.
- Styling: NativeWind 4 + Tailwind 3.3 via `@forklift/tailwind-config`; `babel.config.js` uses
  `["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"`;
  `metro.config.js` wraps with `withNativeWind`; `src/global.css` imported in `_layout.tsx`.
- Shared primitives in `src/components/` (`AppText`, `AppButton`, `AppTextInput`) — screens use
  these rather than raw RN `Text`/`TextInput`.
- On-device DB: `src/db/client.ts` opens `expo-sqlite` (`openDatabaseSync(..., {
  enableChangeListener: true })`), sets `foreign_keys = ON` and `journal_mode = WAL`, bootstraps
  tables with `CREATE TABLE IF NOT EXISTS` (hand-kept in sync with the shared `@forklift/db/client`
  tables — there is no on-device drizzle-kit migration path), then
  `drizzle(expoDb, { relations: relations() })` using `relations` from `@forklift/db/client`.
  Local-only tables (e.g. an outbox) live in `src/db/localSchema.ts`.
- Import **only** `@forklift/db/client` from mobile — never `/server`.
- Offline-first pattern (if needed): writes go to the local DB + a `syncQueue` outbox row with a
  client-generated `clientRequestId` (`expo-crypto` `randomUUID`); a `useSyncQueue` hook drains
  the outbox on NetInfo/AppState changes with retry/backoff; server ingests into a
  `receivedLog`-style table and a separate job applies it idempotently. Read hooks merge server
  data with pending local rows for display.
- Splash screen stays up until fonts + local DB seed are ready; render an error state if the DB
  fails to open.

---

## 10. Bootstrapping order for a new project

1. `git init`; create `.nvmrc`, `.gitignore`, root `package.json`, `pnpm-workspace.yaml`,
   `turbo.json`, root `tsconfig.json`, root `eslint.config.mjs`.
2. Create `tooling/{typescript,eslint,prettier,jest}` (and `tailwind` if UI). Copy from Patchy if
   available.
3. Create `packages/debug` (`createDebugger`, `ApiError`) + a test for `ApiError`.
4. Create `packages/db`: first models, `schemas/index.ts`, `relations.ts`, `types.d.ts`,
   `dbUtils.ts`, `connection.ts`, `testUtils/db.ts`, both index files; root `drizzle.config.ts`.
   Run `pnpm install`, then `pnpm --filter @forklift/db db:generate`.
5. Create `packages/core` with one entity folder per table (Db + Service + index), then
   `server.index.ts`.
6. Create `packages/api`: utils, `status` route, resource routes, `routes/index.ts`, `index.ts`,
   supertest tests.
7. (Optional) `npx create-expo-app` into `packages/mobile`, rename to `@forklift/mobile`, wire
   tooling, NativeWind, `src/db/client.ts`.
8. Run `pnpm lint && pnpm typecheck && pnpm test` and fix everything before the first commit.
9. Write `README.md` (design rationale, schema, trade-offs) and `CLAUDE.md` (commands,
   architecture, gotchas) describing the new project.

### Adding a new entity later (checklist)
1. `packages/db/src/schemas/<entity>Model.ts` following the model convention.
2. Add to `schemas/index.ts`.
3. Add to `tables` **and** the `defineRelations` callback in `relations.ts`.
4. Export the table/schema from `client.index.ts` if mobile needs it.
5. `pnpm --filter @forklift/db db:generate` (output lands in root `.drizzle/migrations/`).
6. `packages/core/src/<entity>/src/{<entity>Db.ts,<entity>Service.ts,index.ts}` (nest under the
   parent if it's a child entity); export from `core/src/server.index.ts`.
7. Route file + entry in `api/src/routes/index.ts` + test.
8. If mobile mirrors it: add the `CREATE TABLE IF NOT EXISTS` to `mobile/src/db/client.ts`.

---

## 11. Gotchas

- `drizzle-kit` resolves relative config paths against `cwd`; keep the config's paths absolute.
- Migrations live at the **repo root** (`.drizzle/migrations`), not in `packages/db`.
- Never commit `local.db`; regenerate/migrate instead of editing it.
- `better-sqlite3`, `esbuild`, `unrs-resolver` need `allowBuilds` in `pnpm-workspace.yaml` or
  their native builds are skipped.
- Jest needs `NODE_OPTIONS=--experimental-vm-modules` for ESM.
- `setupTestDb()` must run before anything calls `getDb()` in that process (singleton).
- Ignore any stray `package-lock.json`; pnpm is the only package manager.
- Multiple agents may work in the repo at once — re-read files before editing, especially schemas.
