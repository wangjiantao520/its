import 'dotenv/config';

import {
  createDatabaseClient,
  type DatabaseClient,
  type DatabaseClientOptions,
} from '../src/lib/database/client';
import {
  migrateSqliteDatabase,
  preflightJsonReport,
  writeJsonReportAtomic,
  type MigrateSqliteDatabaseOptions,
} from './database/sqlite-postgres-migration';

const HELP = `Usage:
  pnpm db:import-sqlite --source <sqlite.db> --target <postgres-url> --report <report.json>

Options:
  --source <path>              Source SQLite database (opened read-only)
  --target <url>               Target PostgreSQL URL; defaults only to DATABASE_MIGRATION_URL
  --report <path>              Atomic JSON report output
  --allow-nonempty-target      Allow existing schema metadata only; business rows still refuse
  --help                       Show this help
`;

interface ImportCliArguments {
  source: string;
  target: string;
  report: string;
  allowNonemptyTarget: boolean;
  help: boolean;
}

export interface ImportCliDependencies {
  argv?: readonly string[];
  env?: Readonly<Record<string, string | undefined>>;
  createClient?: (options: DatabaseClientOptions) => DatabaseClient;
  migrateDatabase?: (options: MigrateSqliteDatabaseOptions) => ReturnType<typeof migrateSqliteDatabase>;
  preflightReport?: (reportPath: string) => void;
  writeReport?: (reportPath: string, report: unknown) => void;
  writeStdout?: (message: string) => void;
  writeStderr?: (message: string) => void;
}

function parseArguments(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): ImportCliArguments {
  let source = '';
  let target = '';
  let report = '';
  let allowNonemptyTarget = false;
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      help = true;
    } else if (argument === '--allow-nonempty-target') {
      allowNonemptyTarget = true;
    } else if (argument === '--source' || argument === '--target' || argument === '--report') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`);
      if (argument === '--source') source = value;
      if (argument === '--target') target = value;
      if (argument === '--report') report = value;
      index += 1;
    } else {
      throw new Error('Unknown migration option.');
    }
  }
  if (help) return { source, target, report, allowNonemptyTarget, help };
  target = target.trim() || (env.DATABASE_MIGRATION_URL ?? '').trim();
  if (!source || !target || !report) throw new Error('Required migration options are missing.');
  return { source, target, report, allowNonemptyTarget, help };
}

export async function runImportCli(dependencies: ImportCliDependencies = {}): Promise<number> {
  const writeStdout = dependencies.writeStdout ?? console.log;
  const writeStderr = dependencies.writeStderr ?? console.error;
  let client: DatabaseClient | undefined;
  try {
    const parsed = parseArguments(
      dependencies.argv ?? process.argv.slice(2),
      dependencies.env ?? process.env,
    );
    if (parsed.help) {
      writeStdout(HELP);
      return 0;
    }
    (dependencies.preflightReport ?? preflightJsonReport)(parsed.report);
    client = (dependencies.createClient ?? createDatabaseClient)({
      url: parsed.target,
      max: 1,
      prepare: false,
    });
    const report = await (dependencies.migrateDatabase ?? migrateSqliteDatabase)({
      sourcePath: parsed.source,
      client,
      allowNonemptyTarget: parsed.allowNonemptyTarget,
    });
    try {
      (dependencies.writeReport ?? writeJsonReportAtomic)(parsed.report, report);
    } catch {
      writeStderr(
        'Database migration completed, but report materialization failed. Rerun the same command to recover the report without reinserting rows.',
      );
      return 2;
    }
    writeStdout('SQLite to PostgreSQL migration completed.');
    return 0;
  } catch {
    writeStderr('SQLite to PostgreSQL migration failed. No credentials or row data were logged.');
    return 1;
  } finally {
    if (client) await client.close().catch(() => undefined);
  }
}

const isDirectExecution = process.argv[1]?.endsWith('/scripts/migrate-sqlite-to-postgres.mts') ?? false;
if (isDirectExecution) {
  void runImportCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      console.error('SQLite to PostgreSQL migration failed. No credentials or row data were logged.');
      process.exitCode = 1;
    });
}
