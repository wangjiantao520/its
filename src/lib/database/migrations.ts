import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export interface DatabaseMigrationResult {
  appliedVersions: number[];
  backupPath: string | null;
}

interface Migration {
  version: number;
  name: string;
  up: (database: Database.Database) => void;
}

interface TableColumn {
  name: string;
}

function tableExists(database: Database.Database, tableName: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function columnNames(database: Database.Database, tableName: string): Set<string> {
  if (!tableExists(database, tableName)) return new Set();
  return new Set(
    database
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => (column as TableColumn).name),
  );
}

function addColumnIfMissing(
  database: Database.Database,
  tableName: string,
  columns: Set<string>,
  columnName: string,
  definition: string,
): void {
  if (columns.has(columnName)) return;
  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  columns.add(columnName);
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'canonical-ai-model-configs',
    up(database) {
      if (!tableExists(database, 'ai_model_configs')) {
        database.exec(`
          CREATE TABLE ai_model_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            model_name TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            api_key TEXT NOT NULL,
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 4000,
            system_prompt TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        return;
      }

      const columns = columnNames(database, 'ai_model_configs');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'name', 'TEXT');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'api_endpoint', 'TEXT');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'description', 'TEXT');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'is_active', 'INTEGER DEFAULT 1');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'is_default', 'INTEGER DEFAULT 0');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'sort_order', 'INTEGER DEFAULT 0');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'system_prompt', 'TEXT');
      addColumnIfMissing(database, 'ai_model_configs', columns, 'created_by', 'TEXT');

      if (columns.has('display_name')) {
        database.exec("UPDATE ai_model_configs SET name = COALESCE(NULLIF(name, ''), display_name, model_name)");
      } else {
        database.exec("UPDATE ai_model_configs SET name = COALESCE(NULLIF(name, ''), model_name)");
      }
      if (columns.has('base_url')) {
        database.exec("UPDATE ai_model_configs SET api_endpoint = COALESCE(NULLIF(api_endpoint, ''), base_url, '')");
      }
      if (columns.has('enabled')) {
        database.exec('UPDATE ai_model_configs SET is_active = COALESCE(enabled, is_active, 1)');
      }
    },
  },
  {
    version: 2,
    name: 'persistent-auth-sessions-and-user-profile',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'its_member',
          is_active INTEGER DEFAULT 1,
          phone TEXT,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token_hash TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          user_id INTEGER,
          username TEXT,
          name TEXT,
          expires_at INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
          ON auth_sessions(expires_at);
      `);

      if (tableExists(database, 'users')) {
        const columns = columnNames(database, 'users');
        addColumnIfMissing(database, 'users', columns, 'phone', 'TEXT');
        addColumnIfMissing(database, 'users', columns, 'email', 'TEXT');
        addColumnIfMissing(database, 'users', columns, 'updated_at', 'DATETIME');
        database.exec('UPDATE users SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)');
      }
    },
  },
  {
    version: 3,
    name: 'canonical-assistant-storage',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS agent_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          system_prompt TEXT NOT NULL,
          model TEXT DEFAULT 'default',
          temperature REAL DEFAULT 0.7,
          enabled INTEGER DEFAULT 1,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS agent_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          user_id INTEGER,
          user_name TEXT,
          agent_id INTEGER,
          agent_name TEXT,
          title TEXT DEFAULT '新对话',
          last_message TEXT DEFAULT '',
          message_count INTEGER DEFAULT 0,
          last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS agent_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          agent_id INTEGER,
          session_id TEXT,
          user_message TEXT NOT NULL,
          agent_response TEXT NOT NULL,
          actions_executed TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const sessionColumns = columnNames(database, 'agent_sessions');
      addColumnIfMissing(database, 'agent_sessions', sessionColumns, 'user_name', 'TEXT');
      addColumnIfMissing(database, 'agent_sessions', sessionColumns, 'agent_name', 'TEXT');
      addColumnIfMissing(database, 'agent_sessions', sessionColumns, 'last_message', "TEXT DEFAULT ''");

      database.prepare(`
        INSERT OR IGNORE INTO agent_configs
          (id, name, description, system_prompt, model, temperature, enabled)
        VALUES
          (1, 'ITS智能助手', '协助查询定额、计算报价并介绍系统功能',
           '你是ITS报价系统智能助手，请提供准确、简洁、可执行的帮助。',
           'default', 0.3, 1)
      `).run();
    },
  },
  {
    version: 4,
    name: 'canonical-quote-workflow',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS engineering_quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_number TEXT UNIQUE NOT NULL,
          version INTEGER DEFAULT 1,
          project_name TEXT NOT NULL,
          client_name TEXT,
          contact_person TEXT,
          contact_phone TEXT,
          contact_email TEXT,
          project_address TEXT,
          construction_area REAL DEFAULT 0,
          quote_date DATE,
          validity_days INTEGER DEFAULT 30,
          engineer_name TEXT,
          subtotal REAL DEFAULT 0,
          management_rate REAL DEFAULT 0.08,
          management_fee REAL DEFAULT 0,
          profit_rate REAL DEFAULT 0.10,
          profit REAL DEFAULT 0,
          regulatory_rate REAL DEFAULT 0.01,
          regulatory_fee REAL DEFAULT 0,
          tax_rate REAL DEFAULT 0.13,
          tax REAL DEFAULT 0,
          total REAL DEFAULT 0,
          status TEXT DEFAULT 'draft',
          items TEXT,
          created_by TEXT,
          created_by_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS maintenance_quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_number TEXT UNIQUE NOT NULL,
          project_name TEXT NOT NULL,
          client_name TEXT,
          contact_person TEXT,
          contact_phone TEXT,
          contact_email TEXT,
          project_address TEXT,
          region TEXT DEFAULT '城区',
          service_years INTEGER DEFAULT 1,
          engineer_level TEXT DEFAULT '中级',
          sla_config TEXT,
          subtotal_before_discount REAL DEFAULT 0,
          sla_adjustment REAL DEFAULT 0,
          region_adjustment REAL DEFAULT 0,
          subtotal_after_coefficients REAL DEFAULT 0,
          years_discount REAL DEFAULT 1,
          bulk_discount REAL DEFAULT 1,
          years_discount_amount REAL DEFAULT 0,
          bulk_discount_amount REAL DEFAULT 0,
          subtotal REAL DEFAULT 0,
          tax REAL DEFAULT 0,
          total REAL DEFAULT 0,
          devices TEXT,
          status TEXT DEFAULT 'draft',
          created_by TEXT,
          created_by_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS quote_shares (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          quote_id INTEGER NOT NULL,
          quote_type TEXT NOT NULL,
          password TEXT,
          expires_at DATETIME,
          max_views INTEGER DEFAULT 0,
          view_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS quote_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_id INTEGER NOT NULL,
          quote_type TEXT NOT NULL,
          action TEXT NOT NULL,
          from_status TEXT,
          to_status TEXT,
          comment TEXT,
          operator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const engineeringColumns = columnNames(database, 'engineering_quotes');
      addColumnIfMissing(database, 'engineering_quotes', engineeringColumns, 'construction_area', 'REAL DEFAULT 0');
      addColumnIfMissing(database, 'engineering_quotes', engineeringColumns, 'created_by', 'TEXT');
      addColumnIfMissing(database, 'engineering_quotes', engineeringColumns, 'created_by_name', 'TEXT');

      const maintenanceColumns = columnNames(database, 'maintenance_quotes');
      addColumnIfMissing(database, 'maintenance_quotes', maintenanceColumns, 'region', "TEXT DEFAULT '城区'");
      addColumnIfMissing(database, 'maintenance_quotes', maintenanceColumns, 'service_years', 'INTEGER DEFAULT 1');
      addColumnIfMissing(database, 'maintenance_quotes', maintenanceColumns, 'sla_config', 'TEXT');
      addColumnIfMissing(database, 'maintenance_quotes', maintenanceColumns, 'created_by', 'TEXT');
      addColumnIfMissing(database, 'maintenance_quotes', maintenanceColumns, 'created_by_name', 'TEXT');

      const shareColumns = columnNames(database, 'quote_shares');
      addColumnIfMissing(database, 'quote_shares', shareColumns, 'token', 'TEXT');
      if (shareColumns.has('share_token')) {
        database.exec('UPDATE quote_shares SET token = COALESCE(token, share_token)');
      }
      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_shares_token ON quote_shares(token)');
    },
  },
  {
    version: 5,
    name: 'rebuild-legacy-quote-shares',
    up(database) {
      const columns = columnNames(database, 'quote_shares');
      if (!columns.has('share_token')) return;

      const legacyRows = database.prepare('SELECT * FROM quote_shares').all() as Array<Record<string, unknown>>;
      database.exec(`
        DROP INDEX IF EXISTS idx_quote_shares_token;
        ALTER TABLE quote_shares RENAME TO quote_shares_legacy;
        CREATE TABLE quote_shares (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          quote_id INTEGER NOT NULL,
          quote_type TEXT NOT NULL,
          password TEXT,
          expires_at DATETIME,
          max_views INTEGER DEFAULT 0,
          view_count INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const insert = database.prepare(`
        INSERT INTO quote_shares
          (id, token, quote_id, quote_type, password, expires_at, max_views,
           view_count, is_active, remark, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of legacyRows) {
        insert.run(
          row.id,
          row.token || row.share_token,
          row.quote_id,
          row.quote_type,
          row.password ?? null,
          row.expires_at ?? null,
          row.max_views ?? 0,
          row.view_count ?? 0,
          row.is_active ?? 1,
          row.remark ?? null,
          row.created_at ?? new Date().toISOString(),
          row.updated_at ?? row.created_at ?? new Date().toISOString(),
        );
      }
      database.exec(`
        DROP TABLE quote_shares_legacy;
        CREATE UNIQUE INDEX idx_quote_shares_token ON quote_shares(token);
      `);
    },
  },
  {
    version: 6,
    name: 'canonical-quotation-and-version-storage',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS quotation_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          client_name TEXT NOT NULL,
          client_region TEXT,
          project_name TEXT,
          quote_type TEXT DEFAULT 'full',
          total_amount REAL DEFAULT 0,
          device_count INTEGER DEFAULT 0,
          quote_data TEXT,
          status TEXT DEFAULT 'draft',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS quotation_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quotation_id INTEGER NOT NULL,
          device_name TEXT NOT NULL,
          brand TEXT,
          model TEXT,
          category TEXT,
          quantity INTEGER DEFAULT 1,
          unit_price REAL DEFAULT 0,
          total_price REAL DEFAULT 0,
          maintenance_rate REAL DEFAULT 0,
          maintenance_fee REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS quote_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_id INTEGER NOT NULL,
          quote_type TEXT NOT NULL,
          version INTEGER NOT NULL,
          data TEXT NOT NULL,
          change_summary TEXT,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_quote_versions_quote
          ON quote_versions(quote_type, quote_id, version);
      `);

      const maintenanceColumns = columnNames(database, 'maintenance_quotes');
      addColumnIfMissing(database, 'maintenance_quotes', maintenanceColumns, 'version', 'INTEGER DEFAULT 1');
    },
  },
  {
    version: 7,
    name: 'canonical-device-quota-fee-columns',
    up(database) {
      if (!tableExists(database, 'device_quotas')) return;
      const columns = columnNames(database, 'device_quotas');
      for (const [name, definition] of [
        ['visit_service_fee', 'REAL DEFAULT 0'],
        ['fault_handling_fee', 'REAL DEFAULT 0'],
        ['tool_amortization', 'REAL DEFAULT 0'],
        ['consumable_fee', 'REAL DEFAULT 0'],
        ['spare_part_reserve', 'REAL DEFAULT 0'],
        ['spare_part_fee', 'REAL DEFAULT 0'],
      ] as const) {
        addColumnIfMissing(database, 'device_quotas', columns, name, definition);
      }
    },
  },
  {
    version: 8,
    name: 'unique-quote-version-numbers',
    up(database) {
      if (!tableExists(database, 'quote_versions')) return;
      database.exec(`
        WITH ranked AS (
          SELECT
            id,
            quote_type,
            quote_id,
            version,
            ROW_NUMBER() OVER (
              PARTITION BY quote_type, quote_id, version
              ORDER BY id
            ) AS duplicate_rank,
            MAX(version) OVER (
              PARTITION BY quote_type, quote_id
            ) AS max_version
          FROM quote_versions
        ),
        extras AS (
          SELECT
            id,
            max_version + ROW_NUMBER() OVER (
              PARTITION BY quote_type, quote_id
              ORDER BY version, id
            ) AS new_version
          FROM ranked
          WHERE duplicate_rank > 1
        )
        UPDATE quote_versions
        SET version = (
          SELECT new_version FROM extras WHERE extras.id = quote_versions.id
        )
        WHERE id IN (SELECT id FROM extras);
        DROP INDEX IF EXISTS idx_quote_versions_quote;
        CREATE UNIQUE INDEX idx_quote_versions_quote
          ON quote_versions(quote_type, quote_id, version);
      `);
    },
  },
];

function getAppliedVersions(database: Database.Database): Set<number> {
  if (!tableExists(database, 'schema_migrations')) return new Set();
  return new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version),
  );
}

function createBackup(database: Database.Database, dbPath: string): string | null {
  if (dbPath === ':memory:' || !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
    return null;
  }

  const hasBusinessTables = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1")
    .get();
  if (!hasBusinessTables) return null;

  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = path.extname(dbPath) || '.db';
  const baseName = path.basename(dbPath, extension);
  const backupPath = path.join(backupDir, `${baseName}.backup-${timestamp}${extension}`);
  const escapedPath = backupPath.replaceAll("'", "''");

  database.exec(`VACUUM INTO '${escapedPath}'`);
  const backup = new Database(backupPath, {
    readonly: true,
  });
  try {
    const integrity = backup.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`数据库备份完整性检查失败: ${String(integrity)}`);
    }
  } finally {
    backup.close();
  }

  return backupPath;
}

function acquireMigrationLock(dbPath: string): () => void {
  if (dbPath === ':memory:') return () => undefined;

  const lockPath = `${dbPath}.migrate.lock`;
  const deadline = Date.now() + 30_000;
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

  while (Date.now() < deadline) {
    try {
      const descriptor = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(descriptor, `${process.pid}\n${new Date().toISOString()}\n`);
      return () => {
        fs.closeSync(descriptor);
        try {
          fs.unlinkSync(lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > 120_000) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw statError;
      }
      Atomics.wait(waitBuffer, 0, 0, 50);
    }
  }

  throw new Error('等待数据库迁移锁超时');
}

export function runDatabaseMigrations(
  database: Database.Database,
  dbPath: string,
): DatabaseMigrationResult {
  const releaseLock = acquireMigrationLock(dbPath);
  try {
    const applied = getAppliedVersions(database);
    const pending = migrations.filter((migration) => !applied.has(migration.version));
    if (pending.length === 0) {
      return { appliedVersions: [], backupPath: null };
    }

    const backupPath = createBackup(database, dbPath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const applyMigration = database.transaction((migration: Migration) => {
      const existing = database
        .prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
        .get(migration.version);
      if (existing) return false;
      migration.up(database);
      database
        .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name);
      return true;
    });

    const appliedVersions: number[] = [];
    for (const migration of pending) {
      if (applyMigration(migration)) appliedVersions.push(migration.version);
    }

    return { appliedVersions, backupPath };
  } finally {
    releaseLock();
  }
}
