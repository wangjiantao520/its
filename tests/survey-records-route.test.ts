import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';

type Row = Record<string, unknown>;

class SurveyRecordsDatabase implements DatabaseClient {
  role: 'admin' | 'its_member' = 'admin';
  userId = 21;
  readonly surveyQueries: Array<{ text: string; params: readonly unknown[] }> = [];

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) {
      return { rows: [], rowCount: 0 } as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      return {
        rows: [{
          role: this.role,
          user_id: this.role === 'admin' ? null : this.userId,
          username: this.role === 'admin' ? 'admin' : 'member_a',
          name: this.role === 'admin' ? '管理员' : '成员甲',
          expires_at: Date.now() + 60_000,
        }],
        rowCount: 1,
      } as unknown as QueryResult<ResultRow>;
    }
    if (text.includes('UPDATE auth_sessions SET last_seen_at')) {
      return { rows: [], rowCount: 1 } as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT is_active FROM users WHERE id = $1')) {
      return { rows: [{ is_active: true }], rowCount: 1 } as unknown as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT id, name FROM users WHERE username = $1')) {
      return { rows: [{ id: 1, name: '管理员' }], rowCount: 1 } as unknown as QueryResult<ResultRow>;
    }
    if (text.includes('FROM survey_records')) {
      this.surveyQueries.push({ text, params });
      if (text.includes('WHERE id = $1')) {
        const id = Number(params[0]);
        const allowed = this.role === 'admin' || Number(params[1]) === this.userId;
        const rows = id === 77 && allowed
          ? [{ id: 77, user_id: 21, survey_data: { basicInfo: { companyName: '客户甲' } }, quote_result: null, contract_years: 2, created_at: new Date('2026-08-04T00:00:00Z') }]
          : [];
        return { rows: rows as unknown as ResultRow[], rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 } as QueryResult<ResultRow>;
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

type DatabaseGlobal = typeof globalThis & {
  __itsPostgresDatabaseClient__?: DatabaseClient;
};

function request(pathname = '/api/survey-records'): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: { authorization: 'Bearer survey-record-test-token' },
  });
}

test('survey record reads are scoped to the member while administrators can read all records', async () => {
  const database = new SurveyRecordsDatabase();
  const global = globalThis as DatabaseGlobal;
  const previousDatabase = global.__itsPostgresDatabaseClient__;
  global.__itsPostgresDatabaseClient__ = database;
  try {
    const route = await import('../src/app/api/survey-records/route');

    database.role = 'its_member';
    const ownRecords = await route.GET(request());
    assert.equal(ownRecords.status, 200);
    assert.match(database.surveyQueries[0]?.text ?? '', /WHERE user_id = \$1/);
    assert.deepEqual(database.surveyQueries[0]?.params, [21]);

    database.role = 'admin';
    const allRecords = await route.GET(request());
    assert.equal(allRecords.status, 200);
    assert.doesNotMatch(database.surveyQueries[1]?.text ?? '', /WHERE user_id/);
    assert.deepEqual(database.surveyQueries[1]?.params, []);

    database.role = 'its_member';
    const ownSurvey = await route.GET(request('/api/survey-records?id=77'));
    assert.equal(ownSurvey.status, 200);
    assert.match(database.surveyQueries[2]?.text ?? '', /WHERE id = \$1 AND user_id = \$2/);
    assert.deepEqual(database.surveyQueries[2]?.params, ['77', 21]);
    const invalidId = await route.GET(request('/api/survey-records?id=0'));
    assert.equal(invalidId.status, 400);
  } finally {
    if (previousDatabase) global.__itsPostgresDatabaseClient__ = previousDatabase;
    else delete global.__itsPostgresDatabaseClient__;
  }
});
