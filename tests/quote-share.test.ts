import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { runDatabaseMigrations } from '../src/lib/database/migrations';
import { consumeQuoteShare } from '../src/lib/quote-share';

test('atomically enforces the maximum number of share views', () => {
  const database = new Database(':memory:');
  try {
    runDatabaseMigrations(database, ':memory:');
    database.prepare(`
      INSERT INTO quotation_records
        (user_id, client_name, project_name, total_amount)
      VALUES (1, '测试客户', '分享次数测试', 100)
    `).run();
    database.prepare(`
      INSERT INTO quote_shares
        (token, quote_id, quote_type, max_views, view_count)
      VALUES ('0123456789abcdef0123456789abcdef', 1, 'quotation', 1, 0)
    `).run();

    const first = consumeQuoteShare(
      database,
      '0123456789abcdef0123456789abcdef',
      Date.now(),
    );
    assert.equal(first.ok, true);
    if (first.ok) assert.equal(first.viewCount, 1);

    assert.deepEqual(
      consumeQuoteShare(database, '0123456789abcdef0123456789abcdef', Date.now()),
      { ok: false, reason: 'view_limit' },
    );
    assert.deepEqual(
      database.prepare('SELECT view_count FROM quote_shares WHERE id = 1').get(),
      { view_count: 1 },
    );
  } finally {
    database.close();
  }
});
