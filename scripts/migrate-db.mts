import 'dotenv/config';

import {
  createDatabaseClient,
  type DatabaseClient,
  type DatabaseClientOptions,
} from '../src/lib/database/client';
import { DatabaseUnavailableError } from '../src/lib/database/errors';
import {
  runPostgresMigrations,
  type PostgresMigrationResult,
} from '../src/lib/database/postgres-migrations';

export interface MigrationCliDependencies {
  env?: Readonly<Record<string, string | undefined>>;
  createClient?: (options: DatabaseClientOptions) => DatabaseClient;
  runMigrations?: (client: DatabaseClient) => Promise<PostgresMigrationResult>;
  writeStdout?: (message: string) => void;
  writeStderr?: (message: string) => void;
}

export async function runMigrationCli(
  dependencies: MigrationCliDependencies = {},
): Promise<number> {
  const env = dependencies.env ?? process.env;
  const createClient = dependencies.createClient ?? createDatabaseClient;
  const runMigrations = dependencies.runMigrations ?? runPostgresMigrations;
  const writeStdout = dependencies.writeStdout ?? console.log;
  const writeStderr = dependencies.writeStderr ?? console.error;
  let client: DatabaseClient | undefined;

  try {
    const url = (env.DATABASE_MIGRATION_URL || env.DATABASE_URL || '').trim();
    if (!url) throw new Error('Database URL is not configured.');

    client = createClient({ url, max: 1, prepare: false });
    const result = await runMigrations(client);
    await client.healthCheck();
    for (const version of result.appliedVersions) writeStdout(String(version));
    return 0;
  } catch (error) {
    writeStderr(
      error instanceof DatabaseUnavailableError
        ? error.message
        : 'Database migration failed.',
    );
    return 1;
  } finally {
    if (client) await client.close().catch(() => undefined);
  }
}

const isDirectExecution = process.argv[1]?.endsWith('/scripts/migrate-db.mts') ?? false;
if (isDirectExecution) {
  void runMigrationCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      console.error('Database migration failed.');
      process.exitCode = 1;
    });
}
