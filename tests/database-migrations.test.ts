import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import { runDatabaseMigrations } from '../src/lib/database/migrations';

function createLegacyDatabase(): { database: Database.Database; dbPath: string; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'its-migrations-'));
  const dbPath = path.join(root, 'quotation.db');
  const database = new Database(dbPath);

  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'its',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );
    CREATE TABLE ai_model_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_name TEXT NOT NULL,
      display_name TEXT,
      provider TEXT,
      api_key TEXT,
      base_url TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4000,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO ai_model_configs
      (model_name, display_name, provider, api_key, base_url, enabled)
    VALUES
      ('legacy-model', '旧模型', 'custom', 'secret', 'https://example.test/v1', 1);
  `);

  return { database, dbPath, root };
}

test('migrates legacy schemas and preserves AI model data', () => {
  const { database, dbPath, root } = createLegacyDatabase();

  try {
    const result = runDatabaseMigrations(database, dbPath);
    const aiColumns = database
      .prepare('PRAGMA table_info(ai_model_configs)')
      .all()
      .map((column) => (column as { name: string }).name);

    for (const column of [
      'name',
      'api_endpoint',
      'description',
      'is_active',
      'is_default',
      'sort_order',
      'system_prompt',
      'created_by',
    ]) {
      assert.ok(aiColumns.includes(column), `missing ai_model_configs.${column}`);
    }

    const authSessionTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_sessions'")
      .get();
    assert.ok(authSessionTable);

    const model = database
      .prepare('SELECT name, api_endpoint, is_active FROM ai_model_configs WHERE model_name = ?')
      .get('legacy-model') as { name: string; api_endpoint: string; is_active: number };
    assert.deepEqual(model, {
      name: '旧模型',
      api_endpoint: 'https://example.test/v1',
      is_active: 1,
    });

    assert.equal(result.appliedVersions.length > 0, true);
    assert.ok(result.backupPath);
    assert.equal(fs.existsSync(result.backupPath), true);

    const backup = new Database(result.backupPath, { readonly: true });
    try {
      assert.equal(backup.pragma('integrity_check', { simple: true }), 'ok');
      const legacyColumns = backup
        .prepare('PRAGMA table_info(ai_model_configs)')
        .all()
        .map((column) => (column as { name: string }).name);
      assert.equal(legacyColumns.includes('is_active'), false);
    } finally {
      backup.close();
    }
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('database migrations are idempotent and do not create another backup when current', () => {
  const { database, dbPath, root } = createLegacyDatabase();

  try {
    const first = runDatabaseMigrations(database, dbPath);
    const second = runDatabaseMigrations(database, dbPath);

    assert.equal(first.appliedVersions.length > 0, true);
    assert.deepEqual(second.appliedVersions, []);
    assert.equal(second.backupPath, null);
    assert.deepEqual(
      database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get(),
      { count: first.appliedVersions.length },
    );
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('creates the canonical user schema for a fresh database', () => {
  const database = new Database(':memory:');
  try {
    runDatabaseMigrations(database, ':memory:');
    const columns = database
      .prepare('PRAGMA table_info(users)')
      .all()
      .map((column) => (column as { name: string }).name);

    for (const column of [
      'username',
      'password_hash',
      'name',
      'role',
      'is_active',
      'phone',
      'email',
      'created_at',
      'updated_at',
      'created_by',
    ]) {
      assert.ok(columns.includes(column), `missing users.${column}`);
    }
  } finally {
    database.close();
  }
});

test('creates canonical assistant tables and a usable default agent', () => {
  const database = new Database(':memory:');
  try {
    runDatabaseMigrations(database, ':memory:');
    const sessionColumns = database
      .prepare('PRAGMA table_info(agent_sessions)')
      .all()
      .map((column) => (column as { name: string }).name);
    for (const column of ['session_id', 'user_id', 'agent_id', 'title', 'last_message', 'message_count']) {
      assert.ok(sessionColumns.includes(column), `missing agent_sessions.${column}`);
    }

    const logColumns = database
      .prepare('PRAGMA table_info(agent_logs)')
      .all()
      .map((column) => (column as { name: string }).name);
    for (const column of ['session_id', 'user_message', 'agent_response', 'actions_executed']) {
      assert.ok(logColumns.includes(column), `missing agent_logs.${column}`);
    }

    const agent = database
      .prepare('SELECT id, name, enabled FROM agent_configs WHERE id = 1')
      .get();
    assert.deepEqual(agent, { id: 1, name: 'ITS智能助手', enabled: 1 });
  } finally {
    database.close();
  }
});

test('creates quote workflow columns used by save and sharing APIs', () => {
  const database = new Database(':memory:');
  try {
    runDatabaseMigrations(database, ':memory:');
    const columnsFor = (table: string) => database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => (column as { name: string }).name);

    for (const column of ['construction_area', 'created_by', 'created_by_name']) {
      assert.ok(columnsFor('engineering_quotes').includes(column), `missing engineering_quotes.${column}`);
    }
    for (const column of ['region', 'service_years', 'sla_config', 'created_by', 'created_by_name']) {
      assert.ok(columnsFor('maintenance_quotes').includes(column), `missing maintenance_quotes.${column}`);
    }
    for (const column of ['token', 'quote_id', 'quote_type', 'expires_at', 'view_count', 'is_active']) {
      assert.ok(columnsFor('quote_shares').includes(column), `missing quote_shares.${column}`);
    }
  } finally {
    database.close();
  }
});

test('creates quotation history and version storage used by reuse workflows', () => {
  const database = new Database(':memory:');
  try {
    runDatabaseMigrations(database, ':memory:');
    for (const table of ['quotation_records', 'quotation_devices', 'quote_versions']) {
      assert.equal(
        Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)),
        true,
      );
    }
    const maintenanceColumns = database.prepare('PRAGMA table_info(maintenance_quotes)').all() as Array<{ name: string }>;
    assert.equal(maintenanceColumns.some((column) => column.name === 'version'), true);
    database.prepare(`
      INSERT INTO quote_versions (quote_id, quote_type, version, data)
      VALUES (1, 'quotation', 1, '{}')
    `).run();
    assert.throws(() => database.prepare(`
      INSERT INTO quote_versions (quote_id, quote_type, version, data)
      VALUES (1, 'quotation', 1, '{}')
    `).run(), /UNIQUE/);
  } finally {
    database.close();
  }
});

test('migration 8 preserves every legacy snapshot while renumbering duplicates', () => {
  const database = new Database(':memory:');
  try {
    runDatabaseMigrations(database, ':memory:');
    database.exec(`
      DROP INDEX idx_quote_versions_quote;
      DELETE FROM schema_migrations WHERE version = 8;
      INSERT INTO quote_versions (quote_id, quote_type, version, data)
      VALUES
        (7, 'engineering', 1, '{"snapshot":"first"}'),
        (7, 'engineering', 1, '{"snapshot":"duplicate"}'),
        (7, 'engineering', 3, '{"snapshot":"third"}');
    `);

    runDatabaseMigrations(database, ':memory:');
    const rows = database.prepare(`
      SELECT version, data
      FROM quote_versions
      WHERE quote_id = 7 AND quote_type = 'engineering'
      ORDER BY version
    `).all();
    assert.deepEqual(rows, [
      { version: 1, data: '{"snapshot":"first"}' },
      { version: 3, data: '{"snapshot":"third"}' },
      { version: 4, data: '{"snapshot":"duplicate"}' },
    ]);
    const count = database.prepare(`
        SELECT COUNT(*) AS count FROM quote_versions
        WHERE quote_id = 7 AND quote_type = 'engineering'
      `).get() as { count: number };
    assert.equal(count.count, 3);
  } finally {
    database.close();
  }
});

test('moves legacy device fee columns into the serialized migration path', () => {
  const database = new Database(':memory:');
  try {
    database.exec('CREATE TABLE device_quotas (id INTEGER PRIMARY KEY, name TEXT)');
    runDatabaseMigrations(database, ':memory:');
    const columns = database.prepare('PRAGMA table_info(device_quotas)').all() as Array<{ name: string }>;
    for (const name of [
      'visit_service_fee', 'fault_handling_fee', 'tool_amortization',
      'consumable_fee', 'spare_part_reserve', 'spare_part_fee',
    ]) {
      assert.equal(columns.some((column) => column.name === name), true, `${name} should be migrated`);
    }
  } finally {
    database.close();
  }
});

test('rebuilds the legacy quote share table so canonical inserts do not require share_token', () => {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE quote_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      quote_type TEXT NOT NULL,
      expires_at DATETIME,
      view_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO quote_shares (quote_id, share_token, quote_type)
    VALUES (1, 'legacy-token', 'engineering');
  `);
  try {
    runDatabaseMigrations(database, ':memory:');
    database.prepare(`
      INSERT INTO quote_shares (token, quote_id, quote_type)
      VALUES ('canonical-token', 2, 'maintenance')
    `).run();
    assert.deepEqual(
      database.prepare('SELECT token FROM quote_shares ORDER BY id').all(),
      [{ token: 'legacy-token' }, { token: 'canonical-token' }],
    );
    assert.equal(
      database.prepare('PRAGMA table_info(quote_shares)').all()
        .some((column) => (column as { name: string }).name === 'share_token'),
      false,
    );
  } finally {
    database.close();
  }
});
