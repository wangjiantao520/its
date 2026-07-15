import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import {
  deleteQuoteByIdentity,
  getQuoteSummaries,
  parseQuoteIdentity,
  updateQuoteDetails,
  updateQuoteStatus,
} from '../src/lib/quote-summary';

function createQuoteDatabase(): Database.Database {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE engineering_quotes (
      id INTEGER PRIMARY KEY, quote_number TEXT, project_name TEXT, client_name TEXT,
      total REAL, status TEXT, created_by TEXT, created_by_name TEXT,
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE maintenance_quotes (
      id INTEGER PRIMARY KEY, quote_number TEXT, project_name TEXT, client_name TEXT,
      total REAL, status TEXT, created_by TEXT, created_by_name TEXT,
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE quotation_records (
      id INTEGER PRIMARY KEY, user_id INTEGER, client_name TEXT, project_name TEXT,
      quote_type TEXT, total_amount REAL, quote_data TEXT, status TEXT,
      created_at TEXT, updated_at TEXT
    );

    INSERT INTO engineering_quotes VALUES
      (1, 'ENG-1', '机房工程', '甲方', 1000, 'approved', '7', '张工', '2026-01-01', '2026-01-02');
    INSERT INTO maintenance_quotes VALUES
      (2, 'MAINT-2', '年度维保', '乙方', 2000, 'draft', '8', '李工', '2026-02-01', '2026-02-02');
    INSERT INTO quotation_records VALUES
      (3, 9, '丙方', '综合报价', 'full', 3000, '{}', 'submitted', '2026-03-01', '2026-03-02');
    INSERT INTO quotation_records VALUES
      (4, 7, '甲方', '机房工程镜像', 'engineering', 1000,
       '{"source_type":"engineering","source_id":1}', 'approved', '2026-01-01', '2026-01-02');
  `);
  return database;
}

test('merges all quote sources using stable identities and removes linked mirrors', () => {
  const database = createQuoteDatabase();
  try {
    const summaries = getQuoteSummaries(database);
    assert.deepEqual(
      summaries.map((quote) => quote.identity),
      ['quotation:3', 'maintenance:2', 'engineering:1'],
    );
    assert.deepEqual(
      summaries.map((quote) => quote.total),
      [3000, 2000, 1000],
    );
    assert.equal(summaries[2]?.createdByName, '张工');
  } finally {
    database.close();
  }
});

test('filters quote summaries by source and creator without mixing identities', () => {
  const database = createQuoteDatabase();
  try {
    assert.deepEqual(
      getQuoteSummaries(database, { source: 'maintenance' }).map((quote) => quote.identity),
      ['maintenance:2'],
    );
    assert.deepEqual(
      getQuoteSummaries(database, { createdBy: '7' }).map((quote) => quote.identity),
      ['engineering:1'],
    );
  } finally {
    database.close();
  }
});

test('parses only explicit source-aware quote identities', () => {
  assert.deepEqual(parseQuoteIdentity('engineering:42'), { source: 'engineering', id: 42 });
  assert.deepEqual(parseQuoteIdentity('maintenance%3A7'), { source: 'maintenance', id: 7 });
  assert.equal(parseQuoteIdentity('42'), null);
  assert.equal(parseQuoteIdentity('unknown:1'), null);
  assert.equal(parseQuoteIdentity('engineering:-1'), null);
});

test('updates and deletes only the source identified by the stable identity', () => {
  const database = createQuoteDatabase();
  try {
    assert.equal(updateQuoteStatus(database, 'maintenance:2', 'approved'), true);
    assert.deepEqual(
      database.prepare('SELECT status FROM maintenance_quotes WHERE id = 2').get(),
      { status: 'approved' },
    );
    assert.deepEqual(
      database.prepare('SELECT status FROM engineering_quotes WHERE id = 1').get(),
      { status: 'approved' },
    );

    assert.equal(deleteQuoteByIdentity(database, 'quotation:3'), true);
    assert.deepEqual(
      database.prepare('SELECT COUNT(*) AS count FROM quotation_records WHERE id = 3').get(),
      { count: 0 },
    );
    assert.equal(deleteQuoteByIdentity(database, 'quotation:999'), false);
  } finally {
    database.close();
  }
});

test('updates editable quote fields in each source schema', () => {
  const database = createQuoteDatabase();
  try {
    assert.equal(updateQuoteDetails(database, 'engineering:1', {
      projectName: '新工程',
      clientName: '新客户',
      total: 1250,
    }), true);
    assert.deepEqual(
      database.prepare('SELECT project_name, client_name, total FROM engineering_quotes WHERE id = 1').get(),
      { project_name: '新工程', client_name: '新客户', total: 1250 },
    );
    assert.equal(updateQuoteDetails(database, 'quotation:3', {
      projectName: '新综合项目',
      clientName: '综合客户',
      total: 3300,
    }), true);
    assert.deepEqual(
      database.prepare('SELECT project_name, client_name, total_amount FROM quotation_records WHERE id = 3').get(),
      { project_name: '新综合项目', client_name: '综合客户', total_amount: 3300 },
    );
  } finally {
    database.close();
  }
});
