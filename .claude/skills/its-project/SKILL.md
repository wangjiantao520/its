---
name: its-project
description: Maintain and verify the ITS engineering quotation system. Use for ITS code, pages, APIs, authentication, quotations, PostgreSQL, tests, and project handoff work.
---

# ITS project workflow

1. Read `CLAUDE.md` and `docs/CLAUDE_HANDOFF.md` before acting.
2. Run `git status --short --branch`; preserve user changes and never touch `trae-agent/`.
3. Use pnpm only. Keep TypeScript strict and reuse shadcn/ui patterns.
4. Production storage is PostgreSQL. Do not add runtime SQLite or `better-sqlite3`.
5. Diagnose with the smallest relevant files and tests before editing.
6. After edits run focused tests, then `pnpm validate`, `pnpm test`, and `pnpm build` before final delivery.
7. Report exact commands, failures, skipped integration tests, and unverified behavior.
8. Never read back or print secret values. Never use production data for destructive tests.
