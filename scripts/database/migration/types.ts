import type { RowVerificationReport } from './row-verifier';
import type { ProtectedPathOptions } from './safe-report';

export type SqlitePrimitive = bigint | number | string | null;
export type SqliteRow = Record<string, SqlitePrimitive>;

export interface PrimaryKeyRange {
  min: string | null;
  max: string | null;
}

export interface TableSummary {
  count: number;
  primaryKey: PrimaryKeyRange | null;
}

export interface QuoteAggregateSummary {
  count: number;
  subtotal: string;
  tax: string;
  total: string;
}

export interface VerificationUser {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  passwordHash?: string;
  passwordHashMatches?: boolean;
}

export interface MigrationSummary {
  tables: Record<string, TableSummary>;
  aggregates: {
    engineering_quotes: QuoteAggregateSummary;
    maintenance_quotes: QuoteAggregateSummary;
  };
  users: VerificationUser[];
  authTokenHashes?: string[];
  orphans: Record<string, number>;
  normalizations: Record<string, number>;
  ignoredSourceTables: string[];
}

export interface MigrationSnapshot {
  rows: Record<string, SqliteRow[]>;
  sourceColumns: Record<string, string[]>;
  ignoredSourceTables: string[];
  summary: MigrationSummary;
}

export interface PreparedSqliteSource {
  sourceIntegrity: 'ok';
  backupIntegrity: 'ok';
  backupPath: string;
  baseline: MigrationSummary;
}

export interface PrepareSqliteOptions extends ProtectedPathOptions {
  backupDirectory?: string;
  now?: Date;
}

export interface ImportResult {
  importedCounts: Record<string, number>;
  identities: Record<string, { reset: boolean }>;
}

export interface DatabaseImportReport {
  success: true;
  importId: string;
  sourceFingerprint: string;
  backupPath: string;
  sourceIntegrity: 'ok';
  backupIntegrity: 'ok';
  targetMigrationVersions: number[];
  baseline: {
    tableCounts: Record<string, number>;
    quoteCounts: Record<string, number>;
    normalizations: Record<string, number>;
    ignoredSourceTables: string[];
  };
  importedCounts: Record<string, number>;
  verification: MigrationVerificationReport;
  startTime: string;
  endTime: string;
}

export interface IdentityVerification {
  sequenceValue: string | null;
  maxId: string | null;
  safe: boolean;
}

export interface MigrationVerificationReport {
  success: boolean;
  tables: Record<string, {
    sourceCount: number;
    targetCount: number;
    countMatches: boolean;
    primaryKeyMatches: boolean;
  }>;
  aggregates: Record<string, {
    sourceCount: number;
    targetCount: number;
    matches: boolean;
  }>;
  users: Array<{
    identifier: string;
    usernameMatches: boolean;
    roleMatches: boolean;
    activeMatches: boolean;
    passwordHashMatches: boolean;
  }>;
  authSessionTokenHashesMatch: boolean;
  orphans: Record<string, { source: number; target: number; matches: boolean }>;
  identities: Record<string, { safe: boolean }>;
  rows: RowVerificationReport;
  ignoredSourceTables: string[];
}

export class MigrationVerificationError extends Error {
  readonly report: MigrationVerificationReport;

  constructor(report: MigrationVerificationReport) {
    super('Database migration verification failed.');
    this.name = 'MigrationVerificationError';
    this.report = report;
  }
}
