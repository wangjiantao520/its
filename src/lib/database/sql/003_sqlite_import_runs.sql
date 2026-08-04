CREATE TABLE IF NOT EXISTS sqlite_import_runs (
  import_id text PRIMARY KEY,
  source_fingerprint text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('complete')),
  source_integrity text NOT NULL,
  backup_integrity text NOT NULL,
  backup_path text NOT NULL,
  target_migration_versions jsonb NOT NULL,
  imported_counts jsonb NOT NULL,
  report_json jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sqlite_import_runs_completed_at
  ON sqlite_import_runs(completed_at DESC);
