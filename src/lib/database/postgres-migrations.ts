import fs from 'node:fs';
import path from 'node:path';

import type { DatabaseClient } from './client';

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

const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_indexes_and_constraints.sql',
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

function safeMigrationError(): Error {
  return new Error('PostgreSQL migration failed. Check database connectivity and migration status.');
}

export async function runPostgresMigrations(
  client: DatabaseClient,
  options: RunPostgresMigrationOptions = {},
): Promise<PostgresMigrationResult> {
  try {
    const migrations = [...(options.migrations ?? loadPostgresMigrations())]
      .sort((left, right) => left.version - right.version);

    return await client.transaction(async (transactionClient) => {
      await transactionClient.query('SELECT pg_advisory_xact_lock(49375483)');
      await transactionClient.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version integer PRIMARY KEY,
          name text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const status = await transactionClient.query<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version',
      );
      const applied = new Set(status.rows.map(({ version }) => Number(version)));
      const appliedVersions: number[] = [];

      for (const migration of migrations) {
        if (applied.has(migration.version)) continue;
        await transactionClient.query(migration.sql);
        await transactionClient.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name],
        );
        appliedVersions.push(migration.version);
      }

      return { appliedVersions };
    });
  } catch {
    throw safeMigrationError();
  }
}
