import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { consumeQuoteShare } from '../src/lib/quote-share';

class ShareDatabase implements DatabaseClient {
  viewCount = 0;
  transactionCount = 0;
  readonly queries: string[] = [];

  async query<Row extends Record<string, unknown>>(
    text: string,
  ): Promise<QueryResult<Row>> {
    this.queries.push(text);
    if (text.includes('FROM quote_shares') && text.includes('FOR UPDATE')) {
      return { rows: [{
        id: '1', quote_id: '3', quote_type: 'quotation', expires_at: '2026-08-05T00:00:00.000Z',
        max_views: 1, view_count: this.viewCount, is_active: true,
      }] as unknown as Row[], rowCount: 1 };
    }
    if (text.includes('UNION ALL')) {
      return { rows: [{
        source: 'quotation', id: '3', quote_number: 'QUOTE-3', project_name: '分享次数测试',
        client_name: '测试客户', total: '100.00', status: 'draft', created_by: '7',
        created_by_name: '成员甲', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
      }] as unknown as Row[], rowCount: 1 };
    }
    if (text.includes('UPDATE quote_shares')) {
      if (this.viewCount >= 1) return { rows: [], rowCount: 0 };
      this.viewCount += 1;
      return { rows: [{ view_count: this.viewCount }] as unknown as Row[], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return await work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('atomically enforces maximum share views using a locked PostgreSQL transaction', async () => {
  const database = new ShareDatabase();
  const now = Date.parse('2026-08-04T00:00:00.000Z');

  const first = await consumeQuoteShare(database, '0123456789abcdef0123456789abcdef', now);
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.viewCount, 1);

  assert.deepEqual(
    await consumeQuoteShare(database, '0123456789abcdef0123456789abcdef', now),
    { ok: false, reason: 'view_limit' },
  );
  assert.equal(database.viewCount, 1);
  assert.equal(database.transactionCount, 2);
  assert.ok(database.queries.some((sql) => sql.includes('FOR UPDATE')));
  assert.ok(database.queries.every((sql) => !sql.includes('?')));
});

test('distinguishes expired and revoked share tokens before reading quote data', async () => {
  for (const [isActive, expiresAt, reason] of [
    [false, '2026-08-05T00:00:00.000Z', 'inactive'],
    [true, '2026-08-03T00:00:00.000Z', 'expired'],
  ] as const) {
    const database = new ShareDatabase();
    database.query = async <Row extends Record<string, unknown>>(text: string) => {
      database.queries.push(text);
      return { rows: [{
        id: '1', quote_id: '3', quote_type: 'quotation', expires_at: expiresAt,
        max_views: 0, view_count: 0, is_active: isActive,
      }] as unknown as Row[], rowCount: 1 };
    };
    assert.deepEqual(
      await consumeQuoteShare(database, '0123456789abcdef0123456789abcdef', Date.parse('2026-08-04T00:00:00.000Z')),
      { ok: false, reason },
    );
    assert.equal(database.queries.length, 1);
  }
});
