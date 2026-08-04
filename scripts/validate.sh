#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "🔍 Running validate..."
pnpm validate

if rg -n "better[-]sqlite3|better[_]sqlite3" \
  package.json pnpm-lock.yaml src scripts tests pnpm-workspace.yaml; then
  echo "Runtime SQLite dependency check failed." >&2
  exit 1
fi

if rg -n "@/lib/db|database/(migrations|schema)|\bdb\.(prepare|exec)\b" \
  src/app src/lib; then
  echo "Runtime SQLite isolation check failed." >&2
  exit 1
fi
echo "✅ Validate passed!"
