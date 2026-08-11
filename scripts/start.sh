#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PORT="${DEPLOY_RUN_PORT:-5000}"
ITS_PROJECT_ENV="${ITS_PROJECT_ENV:-PROD}"
export ITS_PROJECT_ENV

if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL is required for PostgreSQL startup." >&2
    exit 1
fi

# PostgreSQL 迁移与健康检查由 server.ts 启动时执行（preparePostgresStartup），
# 避免在 serverless 冷启动时额外启动一个 tsx 迁移进程导致 30s 启动超时。
echo "Starting HTTP service on port ${PORT} for deploy..."
exec env PORT="${PORT}" node dist/server.js
