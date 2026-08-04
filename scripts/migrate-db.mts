import 'dotenv/config';

import { createDatabaseClient } from '../src/lib/database/client';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';

async function main(): Promise<void> {
  const url = (process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.error('Database migration failed: DATABASE_MIGRATION_URL or DATABASE_URL is required.');
    process.exitCode = 1;
    return;
  }

  const client = createDatabaseClient({ url, max: 1, prepare: false });
  try {
    const result = await runPostgresMigrations(client);
    await client.healthCheck();
    const status = result.appliedVersions.length > 0
      ? `Applied migration versions: ${result.appliedVersions.join(', ')}`
      : 'Database schema is already current.';
    console.log(status);
    console.log('Database health check passed.');
  } catch {
    console.error('Database migration failed.');
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

await main();
