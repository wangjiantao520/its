---
name: coze-deploy
description: Diagnose and verify ITS deployment on Coze with Supabase PostgreSQL. Use for Coze loading screens, HTTP 500, GLIBC, startup, environment variables, build, health checks, and release verification.
---

# ITS Coze deployment workflow

1. Read `CLAUDE.md`, `docs/CLAUDE_HANDOFF.md`, and `docs/NEXT_STEPS_COZE.md`.
2. Confirm repository `wangjiantao520/its`, branch `main`, and deployed revision before changing code.
3. Required variable names are `DATABASE_URL`, `ADMIN_PASSWORD`, `ITS_PASSWORD`, and `ITS_PROJECT_ENV=PROD`. Never use a custom `COZE_` prefix and never print values.
4. Confirm production build uses `scripts/build.sh` and startup uses `scripts/start.sh`.
5. Runtime must not load SQLite or `better-sqlite3`; investigate stale revisions/caches if GLIBC errors return.
6. Verify in order: build exit code, migration/start logs, listening port, `/healthz`, login, protected pages, write persistence.
7. Do not click a paid deployment confirmation or push Coze-generated merge commits without explicit user approval.
8. Distinguish local build success from live Coze success and list every unverified step.
