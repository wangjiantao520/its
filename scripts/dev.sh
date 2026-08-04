#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

EXPOSE_PORT=$(awk -F '[ =]+' '/^expose_port/ {gsub(/[^0-9]/, "", $2); print $2; exit}' .preview 2>/dev/null || echo 5000)

kill_port_if_listening() {
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${EXPOSE_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${EXPOSE_PORT} is free."
      return
    fi
    echo "Port ${EXPOSE_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${EXPOSE_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${EXPOSE_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${EXPOSE_PORT} cleared."
    fi
}

echo "Clearing port ${EXPOSE_PORT} before start."
kill_port_if_listening
echo "Starting dev server on port ${EXPOSE_PORT}..."

export PORT="${EXPOSE_PORT}"
export HOSTNAME="0.0.0.0"

exec pnpm tsx watch src/server.ts
