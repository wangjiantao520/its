#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "Installing dependencies..."
pnpm install --frozen-lockfile --reporter=append-only

echo "Removing stale build artifacts..."
rm -rf .next dist tsconfig.tsbuildinfo

echo "Checking TypeScript and lint..."
pnpm validate

echo "Building the Next.js project..."
pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node24 --outDir dist --no-splitting --no-minify

echo "Copying PostgreSQL migration assets..."
rm -rf dist/database/sql
mkdir -p dist/database
cp -R src/lib/database/sql dist/database/sql

echo "Removing non-runtime build cache..."
rm -rf .next/cache

echo "Build completed successfully!"
