import 'dotenv/config';

import { createServer } from 'node:http';
import { parse } from 'node:url';

import next from 'next';

import {
  createDatabaseClient,
  type DatabaseClient,
  type DatabaseClientOptions,
} from './lib/database/client';
import {
  runPostgresMigrations,
  type PostgresMigrationResult,
} from './lib/database/postgres-migrations';

export interface PostgresStartupDependencies {
  env?: Readonly<Record<string, string | undefined>>;
  createClient?: (options: DatabaseClientOptions) => DatabaseClient;
  runMigrations?: (client: DatabaseClient) => Promise<PostgresMigrationResult>;
}

export async function preparePostgresStartup(
  dependencies: PostgresStartupDependencies = {},
): Promise<DatabaseClient> {
  const env = dependencies.env ?? process.env;
  const url = (env.DATABASE_URL ?? '').trim();
  if (!url) {
    throw new Error('DATABASE_URL is required for PostgreSQL startup.');
  }

  const createClient = dependencies.createClient ?? createDatabaseClient;
  const runMigrations = dependencies.runMigrations ?? runPostgresMigrations;
  let database: DatabaseClient | undefined;

  try {
    database = createClient({ url, prepare: false });
    await runMigrations(database);
  } catch {
    await database?.close().catch(() => undefined);
    throw new Error('PostgreSQL startup migration failed.');
  }

  try {
    await database.healthCheck();
    return database;
  } catch {
    await database.close().catch(() => undefined);
    throw new Error('PostgreSQL startup health check failed.');
  }
}

async function startServer(): Promise<void> {
  const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
  const hostname = process.env.HOSTNAME || 'localhost';
  const port = Number.parseInt(
    process.env.PORT || process.env.DEPLOY_RUN_PORT || '5000',
    10,
  );
  const database = await preparePostgresStartup();
  let databaseReady = true;

  // Coze preview uses the production path. Retain Webpack for an explicitly
  // requested development run to avoid the Turbopack iframe hydration race.
  const app = next({ dev, hostname, port, webpack: dev });
  const handle = app.getRequestHandler();

  try {
    await app.prepare();
  } catch (error) {
    databaseReady = false;
    await database.close().catch(() => undefined);
    throw error;
  }

  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    if (parsedUrl.pathname === '/healthz') {
      res.statusCode = databaseReady ? 200 : 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ status: databaseReady ? 'ok' : 'unavailable' }));
      return;
    }

    try {
      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error('HTTP request handling failed.', error);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  server.once('error', async (error) => {
    databaseReady = false;
    await database.close().catch(() => undefined);
    console.error('HTTP server failed.', error);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
}

if (require.main === module) {
  void startServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'PostgreSQL startup failed.');
    process.exit(1);
  });
}
