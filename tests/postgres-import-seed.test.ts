import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';
import { saveSession } from '../src/lib/auth-session-store';
import { parseDeviceRows } from '../src/app/api/import-file/import-devices';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';

type Row = Record<string, unknown>;

const scopedRoutes = [
  'src/app/api/import-excel/route.ts',
  'src/app/api/import-file/route.ts',
  'src/app/api/init-db/route.ts',
  'src/app/api/quotas-seed/route.ts',
  'src/app/api/seed-config/route.ts',
  'src/app/api/seed-maintenance-devices/route.ts',
] as const;

function result(rows: Row[] = [], rowCount = rows.length): QueryResult<Row> {
  return { rows, rowCount };
}

class ImportDatabase implements DatabaseClient {
  readonly queries: Array<{ text: string; params: readonly unknown[] }> = [];
  transactionCount = 0;
  rollbackCount = 0;
  role: 'admin' | 'its_member' = 'admin';
  failImport = false;
  existingDevices: Row[] = [];

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    this.queries.push({ text, params });
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) return result() as QueryResult<ResultRow>;
    if (text.includes('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      return result([{ role: this.role, user_id: null, username: null, name: null, expires_at: Date.now() + 60_000 }]) as QueryResult<ResultRow>;
    }
    if (text.includes('UPDATE auth_sessions SET last_seen_at')) return result([], 1) as QueryResult<ResultRow>;
    if (text.includes('FROM device_quotas') && text.includes('WITH extras')) {
      return result(this.existingDevices) as QueryResult<ResultRow>;
    }
    if (text.includes('UPDATE device_quotas') && text.includes('WITH extras')) return result() as QueryResult<ResultRow>;
    if (text.includes('INSERT INTO device_quotas')) {
      if (this.failImport) throw new Error('forced import failure');
      return result([{ inserted: '1' }], 1) as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT version FROM "schema_migrations"')) {
      return result([{ version: 1 }, { version: 2 }]) as QueryResult<ResultRow>;
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    try {
      return await work(this);
    } catch (error) {
      this.rollbackCount += 1;
      throw error;
    }
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

class SeedDatabase implements DatabaseClient {
  readonly ids = new Map<string, Set<string>>();
  transactionCount = 0;

  private tableIds(table: string): Set<string> {
    const ids = this.ids.get(table) ?? new Set<string>();
    this.ids.set(table, ids);
    return ids;
  }

  countAll(): number {
    return [...this.ids.values()].reduce((total, ids) => total + ids.size, 0);
  }

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) return result() as QueryResult<ResultRow>;
    if (text.includes('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      return result([{ role: 'admin', user_id: null, username: null, name: null, expires_at: Date.now() + 60_000 }]) as QueryResult<ResultRow>;
    }
    if (text.includes('UPDATE auth_sessions SET last_seen_at')) return result([], 1) as QueryResult<ResultRow>;
    if (text.includes('WITH extras') && text.includes('FROM device_quotas')) return result() as QueryResult<ResultRow>;
    if (text.includes('SELECT device_type FROM maintenance_rate_config')) return result() as QueryResult<ResultRow>;
    if (text.includes('SELECT level_name FROM sla_config')) return result() as QueryResult<ResultRow>;
    const countMatch = /SELECT COUNT\(\*\) AS count FROM (\w+)/i.exec(text);
    if (countMatch) {
      return result([{ count: String(this.tableIds(countMatch[1]).size) }]) as QueryResult<ResultRow>;
    }
    const insertMatch = /INSERT INTO (\w+)/i.exec(text);
    if (!insertMatch) throw new Error(`Unexpected SQL: ${text}`);
    const columnsByTable: Record<string, number> = {
      device_quotas: 48,
      self_construction_quotas: 9,
      intelligent_project_quotas: 12,
      maintenance_device_quotas: 13,
      maintenance_rate_config: 6,
      sla_config: 8,
    };
    const columnCount = columnsByTable[insertMatch[1]];
    assert.ok(columnCount, `unknown seed table ${insertMatch[1]}`);
    const ids = this.tableIds(insertMatch[1]);
    let inserted = 0;
    for (let offset = 0; offset < params.length; offset += columnCount) {
      const id = String(params[offset]);
      if (!ids.has(id)) {
        ids.add(id);
        inserted += 1;
      }
    }
    return result([], inserted) as QueryResult<ResultRow>;
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return await work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

class MigratedConfigDatabase extends SeedDatabase {
  override async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    if (text.includes('SELECT device_type FROM maintenance_rate_config')) {
      return result([{ device_type: '网络设备' }]) as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT level_name FROM sla_config')) {
      return result([{ level_name: '7*24小时特别保障' }]) as QueryResult<ResultRow>;
    }
    return await super.query<ResultRow>(text, params);
  }
}

type DatabaseGlobal = typeof globalThis & {
  __itsPostgresDatabaseClient__?: DatabaseClient;
};

function installDatabase(database: DatabaseClient): void {
  (globalThis as DatabaseGlobal).__itsPostgresDatabaseClient__ = database;
}

function request(path: string, method: string, body?: BodyInit, roleToken = 'admin-token'): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { authorization: `Bearer ${roleToken}` },
    ...(body === undefined ? {} : { body }),
  });
}

function workbookFile(rows: unknown[][], name = 'devices.xlsx'): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'devices');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function uploadRequest(file?: File): NextRequest {
  const form = new FormData();
  if (file) form.set('file', file);
  return request('/api/import-file', 'POST', form);
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test('scoped import and seed routes use only async PostgreSQL APIs and preserve administrator checks', async () => {
  for (const file of scopedRoutes) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from ['"]@\/lib\/db['"]/, `${file} imports the SQLite runtime`);
    assert.doesNotMatch(source, /\.prepare\s*\(|\.execute\s*\(/, `${file} uses a synchronous or MySQL-style API`);
    assert.doesNotMatch(source, /\bas any\b/, `${file} contains an explicit any cast`);
    assert.match(source, /getDatabase\(|DatabaseClient/, `${file} does not use DatabaseClient`);
    assert.match(source, /await requireApiAuth\(request, \['admin'\]\)/, `${file} is not administrator-only`);
  }

  for (const file of scopedRoutes.filter((file) => file.includes('seed') || file.includes('quotas-seed'))) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /ON CONFLICT/i, `${file} does not use an idempotent PostgreSQL seed`);
    assert.match(source, /\$\$\{|\$\d+/, `${file} does not generate PostgreSQL placeholders`);
  }

  const initSource = await readFile(new URL('../src/app/api/init-db/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(initSource, /initDatabase|runPostgresMigrations|CREATE TABLE/i);
  assert.match(initSource, /healthCheck\(\)/);
  assert.match(initSource, /schema_migrations/);
});

test('file imports reject missing, unsupported, and empty workbooks with explicit 400 responses', async () => {
  const database = new ImportDatabase();
  installDatabase(database);
  const route = await import('../src/app/api/import-file/route');

  assert.equal((await route.POST(uploadRequest())).status, 400);
  assert.equal((await route.POST(uploadRequest(new File(['bad'], 'devices.txt')))).status, 400);
  assert.equal((await route.POST(uploadRequest(workbookFile([['category', 'name']])))).status, 400);
  assert.equal(database.transactionCount, 0);
});

test('a valid workbook import uses one transaction and keeps the existing frontend response shape', async () => {
  const database = new ImportDatabase();
  installDatabase(database);
  const route = await import('../src/app/api/import-file/route');
  const response = await route.POST(uploadRequest(workbookFile([
    ['category', 'name', 'brand', 'model', 'level', 'engineer_level', 'annual_failure_count'],
    ['网络设备', '测试交换机', 'H3C', 'S1', 'A', '高级', 1],
  ])));
  const payload = await json(response);

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.imported, 1);
  assert.equal(payload.updated, 0);
  assert.match(String(payload.message), /新增 1 条，更新 0 条/);
  assert.equal(database.transactionCount, 1);
  assert.ok(database.queries.some(({ text }) => /INSERT INTO device_quotas/i.test(text) && /\$\d+/.test(text)));
});

test('device parsing preserves different models that share a category and name', () => {
  const devices = parseDeviceRows([
    ['category', 'name', 'brand', 'model'],
    ['网络设备', '测试交换机', 'H3C', 'S1'],
    ['网络设备', '测试交换机', 'H3C', 'S2'],
  ]);

  assert.deepEqual(devices.map(({ model }) => model), ['S1', 'S2']);
});

test('device import updates the matching model when category and name are shared', async () => {
  const database = new ImportDatabase();
  database.existingDevices = [
    { id: '22', category: '网络设备', name: '测试交换机', model: 'S2' },
    { id: '11', category: '网络设备', name: '测试交换机', model: 'S1' },
  ];
  installDatabase(database);
  const route = await import('../src/app/api/import-file/route');
  const response = await route.POST(uploadRequest(workbookFile([
    ['category', 'name', 'brand', 'model'],
    ['网络设备', '测试交换机', 'H3C', 'S2'],
  ])));
  const update = database.queries.find(({ text }) => text.includes('UPDATE device_quotas'));

  assert.equal(response.status, 200);
  assert.equal(update?.params[0], '22');
});

test('a database failure rolls back the whole uploaded workbook transaction', async () => {
  const database = new ImportDatabase();
  database.failImport = true;
  installDatabase(database);
  const route = await import('../src/app/api/import-file/route');
  const originalError = console.error;
  console.error = () => {};
  let response: Response;
  try {
    response = await route.POST(uploadRequest(workbookFile([
      ['category', 'name', 'brand'],
      ['网络设备', '回滚交换机', 'H3C'],
    ])));
  } finally {
    console.error = originalError;
  }

  assert.equal(response.status, 500);
  assert.equal(database.transactionCount, 1);
  assert.equal(database.rollbackCount, 1);
});

test('all mutation and status endpoints reject a non-administrator', async () => {
  const database = new ImportDatabase();
  database.role = 'its_member';
  installDatabase(database);
  const [importFile, importExcel, initDb, quotas, config, maintenance] = await Promise.all([
    import('../src/app/api/import-file/route'),
    import('../src/app/api/import-excel/route'),
    import('../src/app/api/init-db/route'),
    import('../src/app/api/quotas-seed/route'),
    import('../src/app/api/seed-config/route'),
    import('../src/app/api/seed-maintenance-devices/route'),
  ]);

  const responses = await Promise.all([
    importFile.POST(uploadRequest()),
    importExcel.POST(request('/api/import-excel', 'POST', JSON.stringify({ url: 'https://example.com/a.xlsx' }))),
    initDb.GET(request('/api/init-db', 'GET')),
    quotas.POST(request('/api/quotas-seed', 'POST')),
    config.GET(request('/api/seed-config', 'GET')),
    maintenance.GET(request('/api/seed-maintenance-devices', 'GET')),
  ]);
  assert.deepEqual(responses.map(({ status }) => status), [403, 403, 403, 403, 403, 403]);
});

test('init-db reports health and migration status without mutating schema', async () => {
  const database = new ImportDatabase();
  installDatabase(database);
  const route = await import('../src/app/api/init-db/route');
  const response = await route.GET(request('/api/init-db', 'GET'));
  const payload = await json(response);

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, {
    healthy: true,
    appliedVersions: [1, 2],
  });
  assert.ok(database.queries.every(({ text }) => !/CREATE|INSERT|UPDATE schema_migrations/i.test(text)));
});

test('fake PostgreSQL keeps every seed endpoint idempotent across repeated calls', async () => {
  const database = new SeedDatabase();
  installDatabase(database);
  const [quotas, config, maintenance] = await Promise.all([
    import('../src/app/api/quotas-seed/route'),
    import('../src/app/api/seed-config/route'),
    import('../src/app/api/seed-maintenance-devices/route'),
  ]);
  const calls = [
    () => quotas.POST(request('/api/quotas-seed', 'POST')),
    () => config.GET(request('/api/seed-config', 'GET')),
    () => maintenance.GET(request('/api/seed-maintenance-devices', 'GET')),
  ];
  for (const call of calls) {
    assert.equal((await call()).status, 200);
    const afterFirst = database.countAll();
    assert.equal((await call()).status, 200);
    assert.equal(database.countAll(), afterFirst);
  }
  assert.ok(database.countAll() > 0);
  assert.equal(database.transactionCount, calls.length * 2);
});

test('config seed does not duplicate defaults already migrated under positive IDs', async () => {
  const database = new MigratedConfigDatabase();
  installDatabase(database);
  const route = await import('../src/app/api/seed-config/route');
  const response = await route.GET(request('/api/seed-config', 'GET'));
  const payload = await json(response);
  assert.equal(response.status, 200);
  assert.deepEqual(payload.data, { rateImported: 6, slaImported: 2 });
});

test('live PostgreSQL import and repeated seeds are idempotent', {
  skip: process.env.TEST_DATABASE_URL?.trim() ? false : POSTGRES_TEST_SKIP_REASON,
}, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  const token = 'postgres-import-seed-admin';
  await saveSession(harness.client, token, { role: 'admin', expiresAt: Date.now() + 60_000 });
  installDatabase(harness.client);
  const [importFile, quotas, config, maintenance] = await Promise.all([
    import('../src/app/api/import-file/route'),
    import('../src/app/api/quotas-seed/route'),
    import('../src/app/api/seed-config/route'),
    import('../src/app/api/seed-maintenance-devices/route'),
  ]);

  const form = new FormData();
  form.set('file', workbookFile([
    ['category', 'name', 'brand'],
    ['集成测试', 'PostgreSQL设备', 'H3C'],
  ]));
  const importResponse = await importFile.POST(request('/api/import-file', 'POST', form, token));
  assert.equal(importResponse.status, 200);

  const seedCalls = [
    () => quotas.POST(request('/api/quotas-seed', 'POST', undefined, token)),
    () => config.GET(request('/api/seed-config', 'GET', undefined, token)),
    () => maintenance.GET(request('/api/seed-maintenance-devices', 'GET', undefined, token)),
  ];
  for (const call of seedCalls) {
    assert.equal((await call()).status, 200);
    const before = await harness.client.query<{ total: string }>(
      `SELECT (
        (SELECT COUNT(*) FROM device_quotas) +
        (SELECT COUNT(*) FROM self_construction_quotas) +
        (SELECT COUNT(*) FROM intelligent_project_quotas) +
        (SELECT COUNT(*) FROM maintenance_device_quotas) +
        (SELECT COUNT(*) FROM maintenance_rate_config) +
        (SELECT COUNT(*) FROM sla_config)
      )::text AS total`,
    );
    assert.equal((await call()).status, 200);
    const after = await harness.client.query<{ total: string }>(
      `SELECT (
        (SELECT COUNT(*) FROM device_quotas) +
        (SELECT COUNT(*) FROM self_construction_quotas) +
        (SELECT COUNT(*) FROM intelligent_project_quotas) +
        (SELECT COUNT(*) FROM maintenance_device_quotas) +
        (SELECT COUNT(*) FROM maintenance_rate_config) +
        (SELECT COUNT(*) FROM sla_config)
      )::text AS total`,
    );
    assert.equal(after.rows[0]?.total, before.rows[0]?.total);
  }
});
