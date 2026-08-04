#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PORT="${DEPLOY_RUN_PORT:-5000}"
COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-PROD}"
export COZE_PROJECT_ENV

start_service() {
    echo "Starting HTTP service on port ${PORT} for deploy..."
    PORT=${PORT} node dist/server.js
}

start_service
