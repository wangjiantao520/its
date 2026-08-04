import 'dotenv/config';

import {
  createDatabaseClient,
  type DatabaseClient,
  type DatabaseClientOptions,
} from '../src/lib/database/client';
import {
  assertTargetSchema,
  MigrationVerificationError,
  verifyDatabaseMigration,
  writeJsonReportAtomic,
} from './database/sqlite-postgres-migration';

const HELP = `Usage:
  pnpm db:verify-migration --source <sqlite.db> --target <postgres-url> --report <report.json>

Options:
  --source <path>   Source SQLite database (opened read-only)
  --target <url>    Target PostgreSQL URL; defaults only to DATABASE_MIGRATION_URL
  --report <path>   Atomic JSON verification report output
  --help            Show this help
`;

interface VerifyCliArguments {
  source: string;
  target: string;
  report: string;
  help: boolean;
}

export interface VerifyCliDependencies {
  argv?: readonly string[];
  env?: Readonly<Record<string, string | undefined>>;
  createClient?: (options: DatabaseClientOptions) => DatabaseClient;
  writeStdout?: (message: string) => void;
  writeStderr?: (message: string) => void;
}

function parseArguments(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): VerifyCliArguments {
  let source = '';
  let target = '';
  let report = '';
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      help = true;
    } else if (argument === '--source' || argument === '--target' || argument === '--report') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`);
      if (argument === '--source') source = value;
      if (argument === '--target') target = value;
      if (argument === '--report') report = value;
      index += 1;
    } else {
      throw new Error('Unknown verification option.');
    }
  }
  if (help) return { source, target, report, help };
  target = target.trim() || (env.DATABASE_MIGRATION_URL ?? '').trim();
  if (!source || !target || !report) throw new Error('Required verification options are missing.');
  return { source, target, report, help };
}

export async function runVerifyCli(dependencies: VerifyCliDependencies = {}): Promise<number> {
  const writeStdout = dependencies.writeStdout ?? console.log;
  const writeStderr = dependencies.writeStderr ?? console.error;
  let client: DatabaseClient | undefined;
  let reportPath = '';
  try {
    const parsed = parseArguments(
      dependencies.argv ?? process.argv.slice(2),
      dependencies.env ?? process.env,
    );
    if (parsed.help) {
      writeStdout(HELP);
      return 0;
    }
    reportPath = parsed.report;
    client = (dependencies.createClient ?? createDatabaseClient)({
      url: parsed.target,
      max: 1,
      prepare: false,
    });
    await assertTargetSchema(client);
    const report = await verifyDatabaseMigration({ sourcePath: parsed.source, client });
    writeJsonReportAtomic(reportPath, report);
    writeStdout('Database migration verification completed.');
    return 0;
  } catch (error) {
    if (reportPath && error instanceof MigrationVerificationError) {
      writeJsonReportAtomic(reportPath, error.report);
    }
    writeStderr('Database migration verification failed. No credentials or row data were logged.');
    return 1;
  } finally {
    if (client) await client.close().catch(() => undefined);
  }
}

const isDirectExecution = process.argv[1]?.endsWith('/scripts/verify-database-migration.mts') ?? false;
if (isDirectExecution) {
  void runVerifyCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      console.error('Database migration verification failed. No credentials or row data were logged.');
      process.exitCode = 1;
    });
}
