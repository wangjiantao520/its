#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PORT="${DEPLOY_RUN_PORT:-5000}"
COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-PROD}"
export COZE_PROJECT_ENV

if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL is required for PostgreSQL startup." >&2
    exit 1
fi

echo "Applying PostgreSQL migrations and checking database health..."
pnpm db:migrate

echo "Starting HTTP service on port ${PORT} for deploy..."
exec env PORT="${PORT}" node dist/server.js
