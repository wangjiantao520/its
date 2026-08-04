import 'dotenv/config';

import { createDatabaseClient, type DatabaseClient } from '../src/lib/database/client';
import { DatabaseUnavailableError } from '../src/lib/database/errors';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';

async function main(): Promise<void> {
  let client: DatabaseClient | undefined;
  try {
    const url = (process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL || '').trim();
    if (!url) {
      throw new Error('Database URL is not configured.');
    }

    client = createDatabaseClient({ url, max: 1, prepare: false });
    const result = await runPostgresMigrations(client);
    await client.healthCheck();
    const status = result.appliedVersions.length > 0
      ? `Applied migration versions: ${result.appliedVersions.join(', ')}`
      : 'Database schema is already current.';
    console.log(status);
    console.log('Database health check passed.');
  } finally {
    if (client) await client.close().catch(() => undefined);
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof DatabaseUnavailableError
    ? error.message
    : 'Database migration failed.';
  console.error(message);
  process.exitCode = 1;
}
