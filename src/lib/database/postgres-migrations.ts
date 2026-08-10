import fs from 'node:fs';
import path from 'node:path';

import type { DatabaseClient } from './client';
import { DatabaseUnavailableError } from './errors';

export interface PostgresMigration {
  version: number;
  name: string;
  sql: string;
}

export interface PostgresMigrationResult {
  appliedVersions: number[];
}

export interface RunPostgresMigrationOptions {
  migrations?: readonly PostgresMigration[];
}

export type PostgresMigrationStage =
  | 'load-assets'
  | 'begin-transaction'
  | 'acquire-lock'
  | 'ensure-history'
  | 'read-status'
  | 'apply-migration'
  | 'record-migration';

export class PostgresMigrationError extends Error {
  readonly stage: PostgresMigrationStage;
  readonly version?: number;

  constructor(stage: PostgresMigrationStage, version?: number) {
    const versionDescription = version === undefined ? '' : ` ${version}`;
    super(`PostgreSQL migration${versionDescription} failed during ${stage}.`);
    this.name = 'PostgresMigrationError';
    this.stage = stage;
    this.version = version;
  }
}

const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_indexes_and_constraints.sql',
  '003_sqlite_import_runs.sql',
  '004_quote_library.sql',
] as const;

function migrationDirectories(): string[] {
  const entrypointDirectory = process.argv[1]
    ? path.dirname(path.resolve(process.argv[1]))
    : process.cwd();

  return [
    path.resolve(process.cwd(), 'src/lib/database/sql'),
    path.resolve(process.cwd(), 'dist/database/sql'),
    path.resolve(entrypointDirectory, 'database/sql'),
  ];
}

function readMigrationFile(fileName: string): string {
  for (const directory of migrationDirectories()) {
    const filePath = path.join(directory, fileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  }

  throw new Error(`PostgreSQL migration asset is unavailable: ${fileName}`);
}

export function loadPostgresMigrations(): PostgresMigration[] {
  return MIGRATION_FILES.map((fileName) => {
    const match = /^(\d+)_([a-z0-9_]+)\.sql$/.exec(fileName);
    if (!match) throw new Error(`Invalid PostgreSQL migration filename: ${fileName}`);

    return {
      version: Number.parseInt(match[1], 10),
      name: fileName,
      sql: readMigrationFile(fileName),
    };
  }).sort((left, right) => left.version - right.version);
}

function classifyMigrationError(
  error: unknown,
  stage: PostgresMigrationStage,
  version?: number,
): Error {
  if (error instanceof DatabaseUnavailableError || error instanceof PostgresMigrationError) {
    return error;
  }

  return new PostgresMigrationError(stage, version);
}

export async function runPostgresMigrations(
  client: DatabaseClient,
  options: RunPostgresMigrationOptions = {},
): Promise<PostgresMigrationResult> {
  let migrations: PostgresMigration[];
  try {
    migrations = [...(options.migrations ?? loadPostgresMigrations())]
      .sort((left, right) => left.version - right.version);
  } catch (error) {
    throw classifyMigrationError(error, 'load-assets');
  }

  let stage: PostgresMigrationStage = 'begin-transaction';
  let activeVersion: number | undefined;
  try {
    return await client.transaction(async (transactionClient) => {
      stage = 'acquire-lock';
      await transactionClient.query('SELECT pg_advisory_xact_lock(49375483)');
      stage = 'ensure-history';
      await transactionClient.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version integer PRIMARY KEY,
          name text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      stage = 'read-status';
      const status = await transactionClient.query<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version',
      );
      const applied = new Set(status.rows.map(({ version }) => Number(version)));
      const appliedVersions: number[] = [];

      for (const migration of migrations) {
        if (applied.has(migration.version)) continue;
        activeVersion = migration.version;
        stage = 'apply-migration';
        await transactionClient.query(migration.sql);
        stage = 'record-migration';
        await transactionClient.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name],
        );
        appliedVersions.push(migration.version);
      }

      return { appliedVersions };
    });
  } catch (error) {
    throw classifyMigrationError(error, stage, activeVersion);
  }
}
