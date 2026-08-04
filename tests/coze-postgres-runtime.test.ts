import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { preparePostgresStartup } from '../src/server';

const root = path.resolve(import.meta.dirname, '..');

class StartupDatabase implements DatabaseClient {
  readonly events: string[] = [];

  async query<Row extends Record<string, unknown>>(): Promise<QueryResult<Row>> {
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  async healthCheck(): Promise<void> {
    this.events.push('health');
  }

  async close(): Promise<void> {
    this.events.push('close');
  }
}

test('production startup rejects a missing DATABASE_URL before creating a client', async () => {
  let created = false;

  await assert.rejects(
    preparePostgresStartup({
      env: { COZE_PROJECT_ENV: 'PROD' },
      createClient: () => {
        created = true;
        return new StartupDatabase();
      },
      runMigrations: async () => ({ appliedVersions: [] }),
    }),
    /DATABASE_URL is required for PostgreSQL startup/,
  );
  assert.equal(created, false);
});

test('production startup rejects migration failure and closes before health', async () => {
  const database = new StartupDatabase();

  await assert.rejects(
    preparePostgresStartup({
      env: { COZE_PROJECT_ENV: 'PROD', DATABASE_URL: 'postgres://safe-placeholder' },
      createClient: () => database,
      runMigrations: async () => {
        database.events.push('migrate');
        throw new Error('migration unavailable');
      },
    }),
    /PostgreSQL startup migration failed/,
  );
  assert.deepEqual(database.events, ['migrate', 'close']);
});

test('production startup migrates and health-checks before returning a ready client', async () => {
  const database = new StartupDatabase();

  const readyDatabase = await preparePostgresStartup({
    env: { COZE_PROJECT_ENV: 'PROD', DATABASE_URL: 'postgres://safe-placeholder' },
    createClient: () => database,
    runMigrations: async () => {
      database.events.push('migrate');
      return { appliedVersions: [] };
    },
  });

  assert.equal(readyDatabase, database);
  assert.deepEqual(database.events, ['migrate', 'health']);
});

test('Coze starts migrations before the HTTP process and defaults to deploy port 5000', () => {
  const startScript = fs.readFileSync(path.join(root, 'scripts/start.sh'), 'utf8');

  assert.match(startScript, /DATABASE_URL is required for PostgreSQL startup/);
  assert.match(startScript, /pnpm db:migrate/);
  assert.match(startScript, /exec env PORT="\$\{PORT\}" node dist\/server\.js/);
  assert.match(startScript, /PORT="\$\{DEPLOY_RUN_PORT:-5000\}"/);
});

test('server exposes health only after PostgreSQL startup and never logs database URLs', () => {
  const server = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');

  assert.match(server, /await preparePostgresStartup/);
  assert.match(server, /pathname === ['"]\/healthz['"]/);
  assert.match(server, /statusCode = databaseReady \? 200 : 503/);
  assert.doesNotMatch(server, /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|databaseUrl)/);
});

test('build and runtime sources contain no native or runtime SQLite artifacts', () => {
  const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const lockfile = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
  const buildScript = fs.readFileSync(path.join(root, 'scripts/build.sh'), 'utf8');

  const nativePackage = ['better', 'sqlite3'].join('-');
  const nativeBinary = ['better', 'sqlite3'].join('_');
  assert.equal(`${packageJson}\n${lockfile}\n${buildScript}`.includes(nativePackage), false);
  assert.equal(`${packageJson}\n${lockfile}\n${buildScript}`.includes(nativeBinary), false);
  assert.doesNotMatch(buildScript, /db:migrate|quotation\.db|node:sqlite/);
  assert.match(buildScript, /pnpm validate/);
  assert.match(buildScript, /rm -rf \.next dist tsconfig\.tsbuildinfo/);
  assert.match(buildScript, /rm -rf \.next\/cache/);

  for (const file of [
    'src/lib/db.ts',
    'src/lib/database/migrations.ts',
    'src/lib/database/schema.ts',
    `scripts/ensure-${nativePackage}-prebuild.mjs`,
    'tests/native-sqlite-runtime.test.ts',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must be removed`);
  }
});

test('runtime database artifacts are ignored without deleting the tracked live database', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

  assert.match(gitignore, /^data\/\*\.db$/m);
  assert.match(gitignore, /^data\/\*\.db-\*$/m);
  assert.match(gitignore, /^data\/backups\/$/m);
  assert.match(gitignore, /^data\/migration-\*\.json$/m);
});
