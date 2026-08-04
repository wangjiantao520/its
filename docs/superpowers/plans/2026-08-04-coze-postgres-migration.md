# ITS Coze PostgreSQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the runtime SQLite dependency with Supabase PostgreSQL, preserve all existing accounts and business data, and make every database-backed route work reliably on Coze.

**Architecture:** Keep the existing Next.js API and cookie-based authorization boundary. Introduce one asynchronous PostgreSQL access layer using `postgres`, run versioned migrations before the HTTP server starts, migrate SQLite data through a one-time verified importer, and connect Coze through server-only pooled database URLs.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9.3, PostgreSQL 17, Supabase Supavisor Transaction Pooler, `postgres`, `better-sqlite3` only in the one-time local migration tool until cutover, Node test runner, pnpm 9.

---

## File map

New focused units:

- `src/lib/database/client.ts`: production PostgreSQL client, query result types, transactions and health checks.
- `src/lib/database/errors.ts`: safe database error classification for API and startup logs.
- `src/lib/database/postgres-migrations.ts`: migration runner with advisory locking and `schema_migrations` tracking.
- `src/lib/database/sql/001_initial_schema.sql`: complete PostgreSQL schema.
- `src/lib/database/sql/002_indexes_and_constraints.sql`: indexes, unique constraints and foreign keys.
- `scripts/migrate-db.mts`: explicit migration command used by startup and operators.
- `scripts/migrate-sqlite-to-postgres.mts`: one-time SQLite data importer.
- `scripts/verify-database-migration.mts`: source/target row, key and amount verification report.
- `tests/helpers/postgres.ts`: isolated test schema creation and cleanup.
- `tests/postgres-client.test.ts`: query, transaction and failure behavior.
- `tests/postgres-migrations.test.ts`: first-run, repeat-run and concurrent migration tests.
- `tests/sqlite-postgres-migration.test.ts`: data preservation tests.
- `tests/postgres-auth.test.ts`: login, session and role boundary tests.
- `tests/postgres-business.test.ts`: quote, share, audit and aggregate tests.
- `docs/deployment/coze.md`: operator instructions without secrets.

Existing units to change:

- `src/lib/db.ts`: temporary compatibility facade, then removal after all callers migrate.
- `src/lib/auth.ts`, `src/lib/auth-session-store.ts`: asynchronous PostgreSQL sessions.
- `src/lib/ai-config.ts`, `src/lib/agent-skills.ts`: asynchronous configuration repositories.
- `src/lib/quote-access.ts`, `src/lib/quote-share.ts`, `src/lib/quote-summary.ts`: asynchronous quote services.
- `src/app/api/**/route.ts`: replace synchronous SQLite access with awaited repository/database calls.
- `src/server.ts`, `scripts/start.sh`, `scripts/build.sh`, `scripts/validate.sh`: startup migration, health check and verification.
- `package.json`, `pnpm-lock.yaml`: add `postgres`; remove native SQLite runtime dependencies after cutover.
- `.env.example`, `.gitignore`: document safe variables and exclude database artifacts.

## Task 1: PostgreSQL client contract

**Files:**
- Create: `src/lib/database/client.ts`
- Create: `src/lib/database/errors.ts`
- Create: `tests/postgres-client.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the pure JavaScript PostgreSQL driver**

Run:

```bash
pnpm add postgres
```

Expected: `postgres` appears in `dependencies`; the pnpm lockfile changes; no npm or yarn lockfile is created.

- [ ] **Step 2: Write failing client tests**

Create tests that assert these exported behaviors:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseClient, redactDatabaseUrl } from '../src/lib/database/client';

test('redactDatabaseUrl hides credentials', () => {
  assert.equal(
    redactDatabaseUrl('postgres://user:secret@db.example.com:6543/postgres'),
    'postgres://user:***@db.example.com:6543/postgres',
  );
});

test('createDatabaseClient rejects a missing URL', () => {
  assert.throws(() => createDatabaseClient({ url: '' }), /DATABASE_URL/);
});
```

- [ ] **Step 3: Run the focused test and verify failure**

Run:

```bash
pnpm exec tsx --test tests/postgres-client.test.ts
```

Expected: FAIL because `src/lib/database/client.ts` does not exist.

- [ ] **Step 4: Implement the client and safe errors**

Expose this contract from `client.ts`:

```ts
export interface QueryResult<Row extends Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
}

export interface DatabaseClient {
  query<Row extends Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabaseClient(options: {
  url: string;
  max?: number;
  prepare?: boolean;
}): DatabaseClient;

export function getDatabase(): DatabaseClient;
export function redactDatabaseUrl(value: string): string;
```

Configure `postgres(options.url, { ssl: 'require', prepare: false, max, connect_timeout: 10, idle_timeout: 20 })`. Implement `query` with `sql.unsafe(text, params)` and return `{ rows: Array.from(result), rowCount: result.count }`. Implement transactions with `sql.begin`, and cache only the production client on `globalThis` so Next.js module reloads do not create duplicate pools.

`errors.ts` must map connection timeout/unavailable errors to a safe `DatabaseUnavailableError` and must never include a connection string in its message.

- [ ] **Step 5: Verify client tests and static checks**

Run:

```bash
pnpm exec tsx --test tests/postgres-client.test.ts
pnpm ts-check
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the client foundation**

```bash
git add package.json pnpm-lock.yaml src/lib/database/client.ts src/lib/database/errors.ts tests/postgres-client.test.ts
git commit -m "feat: add PostgreSQL database client"
```

## Task 2: Versioned PostgreSQL schema migrations

**Files:**
- Create: `src/lib/database/postgres-migrations.ts`
- Create: `src/lib/database/sql/001_initial_schema.sql`
- Create: `src/lib/database/sql/002_indexes_and_constraints.sql`
- Create: `scripts/migrate-db.mts`
- Create: `tests/postgres-migrations.test.ts`
- Create: `tests/helpers/postgres.ts`
- Modify: `package.json`

- [ ] **Step 1: Add an isolated PostgreSQL test harness**

`tests/helpers/postgres.ts` must require `TEST_DATABASE_URL`, create a unique schema named `its_test_<uuid without hyphens>`, set `search_path`, and drop only that schema in `t.after()`. If the variable is absent, the integration test must be skipped with an explicit reason rather than silently passing.

- [ ] **Step 2: Write failing migration tests**

Cover these cases:

```ts
test('applies every migration exactly once', async (t) => {
  const db = await createIsolatedPostgres(t);
  const first = await runPostgresMigrations(db);
  const second = await runPostgresMigrations(db);
  assert.deepEqual(first.appliedVersions, [1, 2]);
  assert.deepEqual(second.appliedVersions, []);
});

test('creates the canonical tables', async (t) => {
  const db = await createIsolatedPostgres(t);
  await runPostgresMigrations(db);
  const tables = await listPublicTables(db);
  assert.ok(tables.includes('users'));
  assert.ok(tables.includes('auth_sessions'));
  assert.ok(tables.includes('engineering_quotes'));
  assert.ok(tables.includes('maintenance_quotes'));
  assert.ok(tables.includes('agent_sessions'));
});
```

- [ ] **Step 3: Run the migration test and verify failure**

Run:

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-migrations.test.ts
```

Expected: FAIL because the migration runner and SQL files do not exist.

- [ ] **Step 4: Create the canonical PostgreSQL schema**

Convert every table currently declared by `src/lib/database/schema.ts` and `src/lib/database/migrations.ts`. Preserve table and column names. Use:

```sql
CREATE TABLE IF NOT EXISTS users (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'its_member',
  is_active boolean NOT NULL DEFAULT true,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  role text NOT NULL,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  username text,
  name text,
  expires_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
```

Apply the same explicit type policy to all remaining schema statements: money as `numeric(18,2)`, boolean flags as `boolean`, IDs as `bigint`, JSON payloads as `jsonb` only where the API already treats the value as structured JSON, and timestamps as `timestamptz`.

- [ ] **Step 5: Implement migration locking and history**

`runPostgresMigrations(client)` must:

1. begin a transaction;
2. call `SELECT pg_advisory_xact_lock(49375483)`;
3. create `schema_migrations(version integer primary key, name text not null, applied_at timestamptz not null default now())`;
4. execute unapplied SQL files in numeric order;
5. insert the version and filename in the same transaction;
6. return `{ appliedVersions: number[] }`.

Add `pnpm db:migrate` as `tsx scripts/migrate-db.mts`. The command must read `DATABASE_MIGRATION_URL || DATABASE_URL`, run migrations, execute `SELECT 1`, print only applied version numbers, close the client and exit nonzero on failure.

- [ ] **Step 6: Run migration tests twice**

Run:

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-migrations.test.ts
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-migrations.test.ts
```

Expected: both runs exit 0; the isolated schema is removed after each test.

- [ ] **Step 7: Commit migrations**

```bash
git add package.json src/lib/database/postgres-migrations.ts src/lib/database/sql scripts/migrate-db.mts tests/helpers/postgres.ts tests/postgres-migrations.test.ts
git commit -m "feat: add versioned PostgreSQL migrations"
```

## Task 3: Verified SQLite-to-PostgreSQL importer

**Files:**
- Create: `scripts/migrate-sqlite-to-postgres.mts`
- Create: `scripts/verify-database-migration.mts`
- Create: `tests/sqlite-postgres-migration.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write a failing preservation test**

Create a temporary SQLite database containing one admin, one member, one engineering quote, one maintenance quote, one version, one share and one AI session. Import it into an isolated PostgreSQL schema, then assert exact IDs, usernames, password hashes, ownership, totals and timestamps.

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/sqlite-postgres-migration.test.ts
```

Expected: FAIL because `migrate-sqlite-to-postgres.mts` does not exist.

- [ ] **Step 3: Implement backup and integrity verification**

Before importing, the script must run SQLite `PRAGMA integrity_check`, use `database.backup(<timestamped path>)`, reopen the backup read-only, rerun integrity check and write a JSON baseline containing table row counts, primary-key minimum/maximum values and quote amount sums.

Command interface:

```bash
pnpm db:import-sqlite --source data/quotation.db --report data/migration-report.json --maintenance-mode-confirmed
```

The script must refuse to run when the target contains business rows unless `--allow-nonempty-target` is explicitly provided.

- [ ] **Step 4: Implement deterministic import order**

Import parent tables before child tables, preserve primary keys, convert integer flags to booleans, normalize invalid empty timestamps to `null`, and use parameterized inserts. Execute each logical group in a transaction and finish by resetting every identity sequence with `setval(pg_get_serial_sequence(...), max(id), true)`.

- [ ] **Step 5: Implement the independent verifier**

`verify-database-migration.mts` must read the source and target independently and fail on any mismatch in:

- table row count;
- primary-key range;
- username, role, active state and password hash;
- engineering and maintenance quote count and total amount;
- version, share, audit and AI session count.

Write a JSON report with `success`, per-table results and aggregate results. Do not include password hashes or database URLs in the report.

- [ ] **Step 6: Verify test and CLI help**

Run:

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/sqlite-postgres-migration.test.ts
pnpm db:import-sqlite --help
pnpm db:verify-migration --help
```

Expected: all commands exit 0; help output documents every required flag.

- [ ] **Step 7: Commit the migration tools**

```bash
git add package.json scripts/migrate-sqlite-to-postgres.mts scripts/verify-database-migration.mts tests/sqlite-postgres-migration.test.ts
git commit -m "feat: migrate SQLite data to PostgreSQL"
```

## Task 4: Authentication, sessions and users

**Files:**
- Modify: `src/lib/auth-session-store.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/api-auth.ts`
- Modify: `src/app/api/auth/route.ts`
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`
- Create: `tests/postgres-auth.test.ts`
- Update: `tests/auth-session-store.test.ts`
- Update: `tests/api-auth.test.ts`

- [ ] **Step 1: Write failing asynchronous auth tests**

Cover successful admin/member login, wrong password, disabled member, hashed session persistence, expiration, logout, unauthenticated 401, member-on-admin-route 403 and user update/delete isolation.

- [ ] **Step 2: Verify the tests fail for synchronous SQLite dependencies**

Run:

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-auth.test.ts tests/auth-session-store.test.ts tests/api-auth.test.ts
```

Expected: FAIL until auth functions accept and await `DatabaseClient`.

- [ ] **Step 3: Convert session storage to async PostgreSQL**

Use `$1` parameters and return explicit types. Required signatures:

```ts
export async function saveAuthSession(
  database: DatabaseClient,
  token: string,
  session: AuthSession,
): Promise<void>;

export async function findAuthSession(
  database: DatabaseClient,
  token: string,
): Promise<AuthSession | null>;

export async function deleteAuthSession(
  database: DatabaseClient,
  token: string,
): Promise<boolean>;
```

Preserve SHA-256 token hashing. Replace the module-level cleanup interval with an opportunistic, rate-limited cleanup invoked after successful authentication so server instances do not keep unnecessary timers.

- [ ] **Step 4: Convert login and user routes**

Every handler must await session lookup and role verification. Preserve status codes and `{ success, data?, error? }`. Use `INSERT ... RETURNING id` for new users and `UPDATE ... RETURNING` for edits. Password hashes remain bcrypt hashes and never appear in responses.

- [ ] **Step 5: Run focused and regression tests**

Run:

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-auth.test.ts tests/auth-session-store.test.ts tests/api-auth.test.ts tests/session-verification.test.ts tests/request-session-token.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit the login slice**

```bash
git add src/lib/auth-session-store.ts src/lib/auth.ts src/lib/api-auth.ts src/app/api/auth src/app/api/users tests/postgres-auth.test.ts tests/auth-session-store.test.ts tests/api-auth.test.ts
git commit -m "feat: move authentication to PostgreSQL"
```

## Task 5: Configuration and reference-data routes

**Files:**
- Modify: `src/lib/ai-config.ts`
- Modify: `src/lib/agent-skills.ts`
- Modify routes under: `src/app/api/ai-models`, `src/app/api/device-params`, `src/app/api/intelligent-project-quotas`, `src/app/api/labor-price-config`, `src/app/api/self-construction-quotas`
- Create: `tests/postgres-config.test.ts`

- [ ] **Step 1: Write failing CRUD and permission tests**

Test list/create/update/default/delete for AI models, device parameters and each quota configuration. Assert members can read permitted configuration but only admins can mutate it.

- [ ] **Step 2: Run and verify the SQLite-dependent failure**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-config.test.ts
```

Expected: FAIL from direct `db.prepare` or incompatible SQLite SQL.

- [ ] **Step 3: Convert repositories and routes**

Replace `?` with `$1...$n`, `INSERT OR REPLACE` with explicit `INSERT ... ON CONFLICT ... DO UPDATE`, integer truth checks with boolean values, and insert-ID reads with `RETURNING`. Keep API response payloads unchanged.

- [ ] **Step 4: Verify configuration tests**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-config.test.ts tests/ai-model-client.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit configuration migration**

```bash
git add src/lib/ai-config.ts src/lib/agent-skills.ts src/app/api/ai-models src/app/api/device-params src/app/api/intelligent-project-quotas src/app/api/labor-price-config src/app/api/self-construction-quotas tests/postgres-config.test.ts
git commit -m "feat: move configuration APIs to PostgreSQL"
```

## Task 6: Quotes, versions, sharing, audit and dashboard

**Files:**
- Modify: `src/lib/quote-access.ts`
- Modify: `src/lib/quote-share.ts`
- Modify: `src/lib/quote-summary.ts`
- Modify routes under: `src/app/api/engineering-quotes`, `src/app/api/maintenance-quotes`, `src/app/api/quotations`, `src/app/api/quotes`, `src/app/api/share`, `src/app/api/audit-logs`, `src/app/api/dashboard`
- Create: `tests/postgres-business.test.ts`
- Update: `tests/quote-share.test.ts`
- Update: `tests/quote-summary.test.ts`

- [ ] **Step 1: Write failing business-flow tests**

Create one admin and two members. Verify quote creation, ownership-filtered listing, forbidden cross-user detail/update, version creation, status transition with audit log, expiring share token, aggregate totals and dashboard statistics.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-business.test.ts tests/quote-share.test.ts tests/quote-summary.test.ts
```

Expected: FAIL until quote services are asynchronous.

- [ ] **Step 3: Convert quote service boundaries**

All quote helpers must accept `DatabaseClient`, return promises and perform multi-statement writes inside `database.transaction`. Preserve the established quote identity format and response DTOs. Use `numeric` values as strings at the driver boundary and convert through the existing amount formatting functions to avoid floating-point aggregation.

- [ ] **Step 4: Convert all quote-facing routes**

Await every query and authorization decision. Use dynamic `$n` placeholder generation for batch IDs, `RETURNING` for inserts/updates and PostgreSQL date expressions for expiry. Keep 401, 403, 404 and validation errors distinct.

- [ ] **Step 5: Run business and authorization tests**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-business.test.ts tests/quote-share.test.ts tests/quote-summary.test.ts tests/route-access.test.ts
```

Expected: all tests pass with no cross-user records returned.

- [ ] **Step 6: Commit business migration**

```bash
git add src/lib/quote-access.ts src/lib/quote-share.ts src/lib/quote-summary.ts src/app/api/engineering-quotes src/app/api/maintenance-quotes src/app/api/quotations src/app/api/quotes src/app/api/share src/app/api/audit-logs src/app/api/dashboard tests/postgres-business.test.ts tests/quote-share.test.ts tests/quote-summary.test.ts
git commit -m "feat: move quote workflows to PostgreSQL"
```

## Task 7: AI assistant, agents and learning data

**Files:**
- Modify routes under: `src/app/api/agents`, `src/app/api/agent-logs`, `src/app/api/agent-sessions`, `src/app/api/ai-feedback`, `src/app/api/ai-learning`, `src/app/api/ai-match-devices`, `src/app/api/ai-recommend`
- Create: `tests/postgres-assistant.test.ts`
- Update: `tests/assistant-stream.test.ts`

- [ ] **Step 1: Write failing assistant persistence tests**

Test new conversation, continued conversation, history list, ownership-protected detail, soft delete, completed stream log, interrupted stream log, AI feedback and learning-memory writes.

- [ ] **Step 2: Run and verify failure**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-assistant.test.ts tests/assistant-stream.test.ts
```

Expected: FAIL from direct SQLite access.

- [ ] **Step 3: Convert assistant routes**

Perform session create/update and final log insert in transactions. Preserve SSE event shapes. When the external model fails or disconnects, persist the terminal status without writing a partial success response. Enforce session ownership for reads, writes and deletion.

- [ ] **Step 4: Run assistant tests**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-assistant.test.ts tests/assistant-stream.test.ts tests/ai-model-client.test.ts
```

Expected: all tests pass, including mocked timeout and malformed-provider responses.

- [ ] **Step 5: Commit assistant migration**

```bash
git add src/app/api/agents src/app/api/agent-logs src/app/api/agent-sessions src/app/api/ai-feedback src/app/api/ai-learning src/app/api/ai-match-devices src/app/api/ai-recommend tests/postgres-assistant.test.ts tests/assistant-stream.test.ts
git commit -m "feat: move assistant storage to PostgreSQL"
```

## Task 8: Import, seed and remaining database routes

**Files:**
- Modify routes under: `src/app/api/import-excel`, `src/app/api/import-file`, `src/app/api/init-db`, `src/app/api/quotas-seed`, `src/app/api/seed-all-data`, `src/app/api/seed-config`, `src/app/api/seed-maintenance-devices`
- Create: `tests/postgres-import-seed.test.ts`

- [ ] **Step 1: Write failing idempotency and validation tests**

Test invalid imports, valid device import, repeated seed calls, admin-only seed protection and unchanged row counts after the second seed.

- [ ] **Step 2: Run and verify failure**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-import-seed.test.ts
```

Expected: FAIL until the remaining routes use PostgreSQL.

- [ ] **Step 3: Convert imports and seeds**

Use transactions for each uploaded file, `ON CONFLICT` for idempotent seeds, bounded batch inserts and explicit validation failures. Change `/api/init-db` into an authenticated health/migration-status endpoint; it must not create tables from an HTTP request.

- [ ] **Step 4: Prove no runtime SQLite imports remain**

Run:

```bash
rg "@/lib/db|better-sqlite3|db\.prepare|db\.exec" src/app src/lib --glob '!src/lib/db.ts' --glob '!src/lib/database/migrations.ts' --glob '!src/lib/database/schema.ts'
```

Expected: no output.

- [ ] **Step 5: Run import tests**

```bash
TEST_DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm exec tsx --test tests/postgres-import-seed.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit remaining routes**

```bash
git add src/app/api/import-excel src/app/api/import-file src/app/api/init-db src/app/api/quotas-seed src/app/api/seed-all-data src/app/api/seed-config src/app/api/seed-maintenance-devices tests/postgres-import-seed.test.ts
git commit -m "feat: move import and seed routes to PostgreSQL"
```

## Task 9: Remove runtime SQLite and make startup Coze-safe

**Files:**
- Delete: `src/lib/db.ts`
- Delete: `src/lib/database/migrations.ts`
- Delete: `src/lib/database/schema.ts`
- Delete: `scripts/ensure-better-sqlite3-prebuild.mjs`
- Delete: `tests/native-sqlite-runtime.test.ts`
- Modify: `src/server.ts`
- Modify: `scripts/build.sh`
- Modify: `scripts/start.sh`
- Modify: `scripts/validate.sh`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `tests/coze-postgres-runtime.test.ts`

- [ ] **Step 1: Write failing startup tests**

Assert that production startup fails before listening when `DATABASE_URL` is absent or migration health fails, starts when migrations and `SELECT 1` succeed, and never references `better_sqlite3.node`, `quotation.db` or WAL files.

- [ ] **Step 2: Run and verify failure**

```bash
pnpm exec tsx --test tests/coze-postgres-runtime.test.ts
```

Expected: FAIL while startup and build scripts still install and initialize SQLite.

- [ ] **Step 3: Update startup and build behavior**

`scripts/build.sh` must install dependencies, run type/lint checks and build Next.js/tsup without database access. `scripts/start.sh` must validate variables, run `pnpm db:migrate`, run a health check, then `exec node dist/server.js` on `${DEPLOY_RUN_PORT:-5000}`.

`src/server.ts` must not import a module that writes to the database before the server listens. It may expose `/healthz` that returns 200 only after a successful database health check.

- [ ] **Step 4: Remove native SQLite runtime dependencies**

Change the one-time importer and verifier to read SQLite through Node 24's built-in `node:sqlite` `DatabaseSync` API. Rerun `tests/sqlite-postgres-migration.test.ts` before removing the package, then run:

Run:

```bash
pnpm remove better-sqlite3 @types/better-sqlite3
```

Delete the native prebuild script and obsolete SQLite runtime tests. Confirm `rg "better-sqlite3" package.json pnpm-lock.yaml src scripts tests` returns no output.

- [ ] **Step 5: Stop tracking the live database artifact**

Add `data/*.db`, `data/*.db-*`, `data/backups/` and migration reports to `.gitignore`. Use `git rm --cached data/quotation.db` only after the timestamped backup and PostgreSQL verification report both exist.

- [ ] **Step 6: Verify runtime isolation**

```bash
pnpm exec tsx --test tests/coze-postgres-runtime.test.ts tests/coze-preview-runtime.test.ts tests/runtime-login-regression.test.ts
pnpm validate
pnpm build
find .next dist -type f -print0 | xargs -0 rg -l "better_sqlite3|quotation\.db" || true
```

Expected: tests, validation and build pass; the final search returns no production artifact references.

- [ ] **Step 7: Commit Coze-safe runtime**

```bash
git add -A src/lib/db.ts src/lib/database scripts src/server.ts package.json pnpm-lock.yaml .env.example .gitignore tests
git commit -m "fix: make PostgreSQL startup safe on Coze"
```

## Task 10: Full regression and migration rehearsal

**Files:**
- Modify: `tests/system-api.e2e.mjs`
- Modify: `scripts/validate.sh`
- Create: `docs/deployment/coze.md`
- Create: `data/migration-report.example.json`

- [ ] **Step 1: Extend system API traversal**

Run the server against an isolated PostgreSQL schema and test every route as admin, member and unauthenticated user. The traversal must allow only expected 401/403 responses for deliberately unauthorized calls and fail on any unexpected 500 or non-JSON API response.

- [ ] **Step 2: Rehearse the real SQLite migration into a disposable PostgreSQL schema**

```bash
DATABASE_MIGRATION_URL="$TEST_DATABASE_URL" pnpm db:import-sqlite --source data/quotation.db --report /tmp/its-migration-report.json --maintenance-mode-confirmed
DATABASE_MIGRATION_URL="$TEST_DATABASE_URL" pnpm db:verify-migration --source data/quotation.db --report /tmp/its-migration-verification.json
```

Expected: both reports contain `"success": true`.

- [ ] **Step 3: Run the complete quality gate**

```bash
pnpm lint
pnpm ts-check
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm test
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm test:system
pnpm test:sidebar
pnpm build
pnpm audit --prod
```

Expected: every command exits 0 and production dependencies contain no high-severity vulnerability.

- [ ] **Step 4: Write operator documentation**

Document exact Supabase project creation, Transaction Pooler and migration URLs, Coze variables, migration rehearsal, production import, deployment, `/healthz` verification, rollback and credential rotation. Use redacted examples only.

- [ ] **Step 5: Commit rehearsal and documentation**

```bash
git add tests/system-api.e2e.mjs scripts/validate.sh docs/deployment/coze.md data/migration-report.example.json
git commit -m "test: verify PostgreSQL migration and Coze deployment"
```

## Task 11: Production cutover and acceptance

**Files:**
- Runtime configuration only: Supabase and Coze dashboards
- Generated locally and kept out of Git: timestamped SQLite backup and migration verification report

- [ ] **Step 1: Create the production Supabase project**

Choose a region with acceptable latency from Coze, generate a strong database password, record the direct/session migration URL and IPv4 Transaction Pooler runtime URL, and verify TLS connectivity without printing credentials.

- [ ] **Step 2: Back up and migrate production data**

Run integrity check, timestamped backup, versioned migrations, data import and independent verifier. Stop if any table or aggregate differs.

- [ ] **Step 3: Configure Coze secrets**

Add `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `SESSION_SECRET` and `DATABASE_POOL_MAX` in deployment variables. Never paste them into chat, source files, build logs or GitHub.

- [ ] **Step 4: Deploy the verified commit**

Deploy from `main`, wait for migration/health startup success, then request `/healthz`, `/robots.txt` and `/api/auth`. Expected responses are 200, 200 and JSON 401 respectively.

- [ ] **Step 5: Run role and business acceptance**

Log in as administrator and member. Verify dashboard, member management, engineering quote, maintenance quote, history, version, review, share, export, AI sessions and logout. Verify an unauthenticated browser cannot access protected data.

- [ ] **Step 6: Verify persistence after redeploy**

Create a marked test quote, redeploy the same commit, and confirm the quote and login session behavior remain correct. Delete only the marked test record through the normal authorized UI/API.

- [ ] **Step 7: Push the completed branch**

```bash
git status --short
git log --oneline --decorate -12
git push new-origin main
```

Expected: only the unrelated local `trae-agent/` path may remain untracked; GitHub `its-new/main` points to the final verified commit.
