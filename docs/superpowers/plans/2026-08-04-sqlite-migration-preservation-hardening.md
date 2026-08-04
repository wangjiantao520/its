# SQLite Migration Preservation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SQLite-to-PostgreSQL import and verification preservation-safe under path aliasing, concurrent writes, schema drift, bigint IDs, and same-count row corruption.

**Architecture:** Keep `scripts/database/sqlite-postgres-migration.ts` as the stable public facade while moving responsibilities into `migration/manifest.ts`, `migration/sqlite-source.ts`, `migration/safe-report.ts`, `migration/importer.ts`, and `migration/verifier.ts`. The importer works only from an integrity-checked immutable backup, serializes cutover with a transaction-scoped advisory lock plus deterministic table locks, and persists a completed ledger only after independent row-level verification. Source and target canonicalizers are separate implementations and expose only secret-safe match metadata.

**Tech Stack:** TypeScript 5 strict mode, Node SQLite, postgres.js, Node SHA-256/fsync APIs, Node test runner, pnpm.

---

### Task 1: Protected path identities and durable reports

**Files:**
- Create: `scripts/database/migration/safe-report.ts`
- Modify: `scripts/migrate-sqlite-to-postgres.mts`
- Modify: `scripts/verify-database-migration.mts`
- Test: `tests/sqlite-postgres-migration.test.ts`

- [ ] Add failing CLI tests that pass the source as the report directly, through `./` aliases, symlinks, and hardlinks; assert no client is created and source SHA-256, size, and mtime remain unchanged.
- [ ] Add failing writer tests using `writeJsonReportAtomic(path, report, { protectedPaths: [source, backup] })` for path and `(dev, ino)` aliases.
- [ ] Implement `resolvePathIdentity`, `assertDistinctProtectedPaths`, preflight probing, protected-path recheck immediately before rename, temp-file `fsync`, atomic rename, and containing-directory `fsync`.
- [ ] Run `node --experimental-sqlite --import tsx --test --test-name-pattern='path|report' tests/sqlite-postgres-migration.test.ts`; expect all new tests to pass.

### Task 2: Exact source and target manifests

**Files:**
- Create: `scripts/database/migration/manifest.ts`
- Modify: `scripts/database/migration/sqlite-source.ts`
- Modify: `scripts/database/migration/verifier.ts`
- Test: `tests/sqlite-postgres-migration.test.ts`

- [ ] Add failing source tests for an unexpected column on a recognized empty and populated table; preserve explicit zero-row unknown-table and empty obsolete-table behavior.
- [ ] Add failing target tests for wrong type, numeric precision/scale, nullability, identity/default, primary/unique constraint, and foreign-key metadata.
- [ ] Define exact column metadata and explicit legacy ignored-column manifest; reject any recognized-table column absent from both.
- [ ] Query `information_schema.columns`, `table_constraints`, `key_column_usage`, `constraint_column_usage`, and identity/default metadata, then compare against the canonical SQL-derived manifest.
- [ ] Run focused schema tests and confirm the malformed fixtures all fail for their intended reason.

### Task 3: Independent row-level verification and bigint IDs

**Files:**
- Create: `scripts/database/migration/source-canonical.ts`
- Create: `scripts/database/migration/target-canonical.ts`
- Create: `scripts/database/migration/verifier.ts`
- Test: `tests/sqlite-postgres-migration.test.ts`

- [ ] Add failing tests for swapped same-count/same-range rows, unchanged aggregate with a wrong row amount, config/quota/labor/device corruption, ownership/status corruption, secret mismatch, and polymorphic quote orphan.
- [ ] Add failing tests around `9007199254740991`, `9007199254740992`, and larger bigint IDs plus lexical text keys and sequence reset SQL.
- [ ] Build separate source and target canonicalizers over every included table and relevant column; normalize source and target money independently, preserve null markers, and SHA-256 each canonical row internally.
- [ ] Compare sorted `table + canonical PK -> internal digest` maps and emit only deterministic non-secret digest identifiers, counts, and booleans; never emit row values or secret digests.
- [ ] Add polymorphic orphan checks for versions, shares, audits, and history against the selected engineering/maintenance parent.
- [ ] Run focused corruption tests and confirm each deliberate mutation flips verification success to false without exposing values.

### Task 4: Maintenance-mode cutover and writer exclusion

**Files:**
- Modify: `scripts/database/migration/importer.ts`
- Modify: `scripts/migrate-sqlite-to-postgres.mts`
- Modify: `tests/sqlite-postgres-migration.test.ts`
- Modify: `docs/database-migration.md`

- [ ] Add failing CLI tests requiring `--maintenance-mode-confirmed` before client creation and showing the flag in help.
- [ ] Add a faithful fake concurrency test in which a non-import writer waits or fails while the import holds locks; add a real PostgreSQL variant guarded by `TEST_DATABASE_URL`.
- [ ] Import exclusively from a verified backup snapshot and compare source identity/fingerprint before and after backup creation; fail with a retry message on change.
- [ ] Inside the advisory-locked outer transaction set a safe local `lock_timeout`, then `LOCK TABLE` every business table in sorted order with `ACCESS EXCLUSIVE MODE` before ledger/nonempty checks; never table-lock migration metadata.
- [ ] Document application shutdown, maintenance flag, environment-only target URL, backup/report paths, verification, and restart order.

### Task 5: Stable facade and pnpm diagnostics

**Files:**
- Modify: `scripts/database/sqlite-postgres-migration.ts`
- Create: `scripts/database/migration/importer.ts`
- Create: `scripts/database/migration/sqlite-source.ts`
- Create: `scripts/database/migration/safe-report.ts`
- Create: `scripts/database/migration/verifier.ts`
- Modify: `.npmrc`
- Modify: `package.json`
- Test: `tests/sqlite-postgres-migration.test.ts`

- [ ] Move code by responsibility while preserving every current facade export and CLI import path; keep source and target money implementations in different files.
- [ ] Remove global `loglevel=silent` and `reporter=silent`; keep normal install/build diagnostics and prevent CLI code from echoing argument URLs.
- [ ] Run the focused suite after every move so refactoring stays behavior-preserving.

### Task 6: Completion verification

**Files:**
- Verify all files above.

- [ ] Run `pnpm ts-check` and `pnpm lint:build`; expect exit 0.
- [ ] Run the focused migration tests; expect no failures and only explicit `TEST_DATABASE_URL` skips.
- [ ] Run `pnpm test` with a temporary `DB_PATH`; expect no failures.
- [ ] Run `pnpm build` with a temporary `DB_PATH`; expect a successful production bundle with visible pnpm diagnostics.
- [ ] Probe both CLI help/error paths and assert no supplied URL or credentials appear.
- [ ] Rehearse backup creation and all transforms against `data/quotation.db`; compare pre/post SHA-256, mtime, and size and require zero source changes.
- [ ] Review `git diff --check`, status, requirements coverage, then create one focused commit and report the exact SHA plus the explicit lack of live PostgreSQL execution when `TEST_DATABASE_URL` is absent.
