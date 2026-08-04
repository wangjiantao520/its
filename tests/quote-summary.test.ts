import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import {
  deleteQuoteByIdentity,
  getQuoteSummaries,
  parseQuoteIdentity,
  updateQuoteDetails,
  updateQuoteStatus,
} from '../src/lib/quote-summary';

type QueryHandler = (
  text: string,
  params: readonly unknown[],
) => QueryResult<Record<string, unknown>> | Promise<QueryResult<Record<string, unknown>>>;

class FakeDatabase implements DatabaseClient {
  readonly queries: Array<{ text: string; params: readonly unknown[] }> = [];

  constructor(private readonly handler: QueryHandler) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text, params });
    return await this.handler(text, params) as QueryResult<Row>;
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return await work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

function result(rows: Array<Record<string, unknown>> = [], rowCount = rows.length) {
  return { rows, rowCount };
}

const quoteRows = [
  {
    source: 'engineering', id: '1', quote_number: 'ENG-1', project_name: '机房工程',
    client_name: '甲方', total: '1000.10', status: 'approved', created_by: '7',
    created_by_name: '张工', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  },
  {
    source: 'maintenance', id: '2', quote_number: 'MAINT-2', project_name: '年度维保',
    client_name: '乙方', total: '2000.20', status: 'draft', created_by: '8',
    created_by_name: '李工', created_at: '2026-02-01T00:00:00.000Z', updated_at: '2026-02-02T00:00:00.000Z',
  },
  {
    source: 'quotation', id: '3', quote_number: 'QUOTE-3', project_name: '综合报价',
    client_name: '丙方', total: '3000.30', status: 'submitted', created_by: '9',
    created_by_name: '王工', created_at: '2026-03-01T00:00:00.000Z', updated_at: '2026-03-02T00:00:00.000Z',
  },
];

function summaryDatabase(): FakeDatabase {
  return new FakeDatabase((text, params) => {
    if (text.includes('UNION ALL')) {
      const createdBy = params.find((value) => typeof value === 'string' && /^\d+$/.test(value));
      return result(quoteRows.filter((row) => !createdBy || row.created_by === createdBy));
    }
    if (/^(UPDATE|DELETE)/.test(text.trim())) {
      return result([{ id: params.at(-1) ?? '1' }], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
}

test('merges PostgreSQL quote sources using stable identities and frontend-safe numeric DTOs', async () => {
  const database = summaryDatabase();
  const summaries = await getQuoteSummaries(database);
  assert.deepEqual(
    summaries.map((quote) => quote.identity),
    ['quotation:3', 'maintenance:2', 'engineering:1'],
  );
  assert.deepEqual(summaries.map((quote) => quote.total), [3000.3, 2000.2, 1000.1]);
  assert.equal(summaries[2]?.createdByName, '张工');
  assert.ok(database.queries[0]?.text.includes('$1'));
  assert.ok(!database.queries[0]?.text.includes('?'));
});

test('filters quote summaries by creator in SQL without loading another member records', async () => {
  const database = summaryDatabase();
  const summaries = await getQuoteSummaries(database, { createdBy: '7' });
  assert.deepEqual(summaries.map((quote) => quote.identity), ['engineering:1']);
  assert.ok(database.queries[0]?.params.includes('7'));
});

test('parses only explicit source-aware quote identities', () => {
  assert.deepEqual(parseQuoteIdentity('engineering:42'), { source: 'engineering', id: 42 });
  assert.deepEqual(parseQuoteIdentity('maintenance%3A7'), { source: 'maintenance', id: 7 });
  assert.equal(parseQuoteIdentity('42'), null);
  assert.equal(parseQuoteIdentity('unknown:1'), null);
  assert.equal(parseQuoteIdentity('engineering:-1'), null);
  assert.equal(parseQuoteIdentity('engineering:9007199254740992'), null);
});

test('updates and deletes only allowlisted source tables with RETURNING and PostgreSQL placeholders', async () => {
  const database = summaryDatabase();
  assert.equal(await updateQuoteStatus(database, 'maintenance:2', 'approved'), true);
  assert.equal(await deleteQuoteByIdentity(database, 'quotation:3'), true);
  assert.equal(await updateQuoteDetails(database, 'engineering:1', {
    projectName: '新工程', clientName: '新客户', total: 1250.25,
  }), true);

  assert.ok(database.queries.every(({ text }) => !text.includes('?')));
  assert.ok(database.queries.every(({ text }) => /RETURNING id/i.test(text)));
  assert.match(database.queries[0]?.text ?? '', /UPDATE maintenance_quotes/);
  assert.match(database.queries[1]?.text ?? '', /DELETE FROM quotation_records/);
  assert.match(database.queries[2]?.text ?? '', /UPDATE engineering_quotes/);
});
