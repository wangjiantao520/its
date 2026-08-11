import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { hashAuthToken, saveSession } from '../src/lib/auth-session-store';
import { canAccessQuote } from '../src/lib/quote-access';
import { consumeQuoteShare } from '../src/lib/quote-share';
import { getQuoteSummaries, updateQuoteDetails, updateQuoteStatus } from '../src/lib/quote-summary';
import { normalizeQuoteVersionSnapshot } from '../src/lib/quote-version-snapshot';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';
import * as engineeringRoutes from '../src/app/api/engineering-quotes/route';
import * as engineeringDetailRoutes from '../src/app/api/engineering-quotes/[id]/route';
import * as maintenanceRoutes from '../src/app/api/maintenance-quotes/route';
import * as quotationRoutes from '../src/app/api/quotations/route';
import * as quotationDetailRoutes from '../src/app/api/quotations/[id]/route';
import * as statusRoutes from '../src/app/api/quotes/[id]/status/route';
import * as unifiedQuoteRoutes from '../src/app/api/quotes/[id]/route';
import * as shareRoutes from '../src/app/api/quotes/share/route';
import * as publicShareRoutes from '../src/app/api/share/[token]/route';
import * as versionRoutes from '../src/app/api/quotes/versions/route';
import * as versionDetailRoutes from '../src/app/api/quotes/versions/[id]/route';
import * as dashboardRoutes from '../src/app/api/dashboard/stats/route';
import { createPostgresTestHarness, POSTGRES_TEST_SKIP_REASON } from './helpers/postgres';

class OwnershipDatabase implements DatabaseClient {
  constructor(private readonly rows: Array<Record<string, unknown>>) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    if (!text.includes('UNION ALL')) throw new Error(`Unexpected SQL: ${text}`);
    const owner = params.find((value) => value === '11' || value === '22');
    const rows = owner ? this.rows.filter((row) => row.created_by === owner) : this.rows;
    return { rows: rows as Row[], rowCount: rows.length };
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return await work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

const businessRows = [
  {
    source: 'engineering', id: '101', quote_number: 'ENG-20260804-001', project_name: '成员甲工程',
    client_name: '客户甲', total: '100.10', status: 'draft', created_by: '11', created_by_name: '成员甲',
    created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z',
  },
  {
    source: 'maintenance', id: '202', quote_number: 'MAINT-20260804-001', project_name: '成员乙维保',
    client_name: '客户乙', total: '200.20', status: 'submitted', created_by: '22', created_by_name: '成员乙',
    created_at: '2026-08-04T02:00:00.000Z', updated_at: '2026-08-04T02:00:00.000Z',
  },
];

test('one admin and two members receive ownership-filtered quote lists and access decisions', async () => {
  const database = new OwnershipDatabase(businessRows);
  const memberA = { role: 'its_member', userId: 11, name: '成员甲' };
  const memberB = { role: 'its_member', userId: 22, name: '成员乙' };
  const admin = { role: 'admin', name: '管理员' };

  assert.deepEqual((await getQuoteSummaries(database, { createdBy: '11' })).map((quote) => quote.identity), ['engineering:101']);
  assert.deepEqual((await getQuoteSummaries(database, { createdBy: '22' })).map((quote) => quote.identity), ['maintenance:202']);
  assert.deepEqual((await getQuoteSummaries(database)).map((quote) => quote.identity), ['maintenance:202', 'engineering:101']);
  assert.equal(await canAccessQuote(database, memberA, 'engineering', 101), true);
  assert.equal(await canAccessQuote(database, memberA, 'maintenance', 202), false);
  assert.equal(await canAccessQuote(database, memberB, 'engineering', 101), false);
  assert.equal(await canAccessQuote(database, admin, 'maintenance', 202), true);
});

interface StoredQuote extends Record<string, unknown> {
  id: number; quote_number: string; project_name: string; client_name: string | null;
  total: string; status: string; created_by: string; created_by_name: string;
  created_at: string; updated_at: string;
}

class RouteDatabase implements DatabaseClient {
  readonly engineering: StoredQuote[] = [];
  readonly maintenance: StoredQuote[] = [];
  readonly audits: Array<Record<string, unknown>> = [];
  readonly shares: Array<Record<string, unknown>> = [];
  readonly quotations: Array<Record<string, unknown>> = [];
  readonly quotationDevices: Array<Record<string, unknown>> = [];
  readonly versions: Array<Record<string, unknown>> = [];
  transactionCount = 0;
  summaryBarrierTarget = 0;
  private summaryBarrierCount = 0;
  private summaryBarrierRelease: (() => void) | null = null;
  private summaryBarrierPromise: Promise<void> | null = null;
  private transactionTail: Promise<void> = Promise.resolve();

  private readonly sessions = new Map([
    [hashAuthToken('admin-token'), { role: 'admin', user_id: null, username: null, name: '管理员', expires_at: Date.now() + 60_000 }],
    [hashAuthToken('member-a-token'), { role: 'its_member', user_id: 11, username: 'member-a', name: '成员甲', expires_at: Date.now() + 60_000 }],
    [hashAuthToken('member-b-token'), { role: 'its_member', user_id: 22, username: 'member-b', name: '成员乙', expires_at: Date.now() + 60_000 }],
  ]);

  private summaryRows(): Array<Record<string, unknown>> {
    return [
      ...this.engineering.map((row) => ({ source: 'engineering', ...row })),
      ...this.maintenance.map((row) => ({ source: 'maintenance', ...row })),
    ];
  }

  async query<Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []): Promise<QueryResult<Row>> {
    const sql = text.replace(/\s+/g, ' ').trim();
    const rows = (values: Array<Record<string, unknown>>, count = values.length) => ({ rows: values as Row[], rowCount: count });
    if (sql.startsWith('DELETE FROM auth_sessions WHERE expires_at')) return rows([]);
    if (sql.startsWith('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      const session = this.sessions.get(String(params[0])); return rows(session ? [session] : []);
    }
    if (sql.startsWith('UPDATE auth_sessions SET last_seen_at')) return rows([], 1);
    if (sql.startsWith('SELECT is_active FROM users')) return rows([{ is_active: true }]);
    if (sql.includes('INSERT INTO engineering_quotes')) {
      const id = this.engineering.length + 101;
      this.engineering.push({ id, quote_number: String(params[0]), project_name: String(params[1]), client_name: params[2] === null ? null : String(params[2]), total: Number(params[15] ?? 0).toFixed(2), status: 'draft', created_by: String(params[21]), created_by_name: String(params[22]), created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z', items: [] });
      return rows([{ id: String(id) }]);
    }
    if (sql.includes('INSERT INTO maintenance_quotes')) {
      const id = this.maintenance.length + 201;
      this.maintenance.push({ id, quote_number: String(params[0]), project_name: String(params[1]), client_name: params[2] === null ? null : String(params[2]), total: Number(params[18] ?? 0).toFixed(2), status: 'draft', created_by: String(params[20]), created_by_name: String(params[21]), created_at: '2026-08-04T02:00:00.000Z', updated_at: '2026-08-04T02:00:00.000Z', devices: [] });
      return rows([{ id: String(id) }]);
    }
    if (sql.startsWith('SELECT COUNT(*)::text AS total FROM engineering_quotes')) {
      const owner = sql.includes('created_by') ? String(params.at(-1)) : null;
      return rows([{ total: String(this.engineering.filter((row) => !owner || row.created_by === owner).length) }]);
    }
    if (sql.startsWith('SELECT COUNT(*)::text AS total FROM maintenance_quotes')) {
      const owner = sql.includes('created_by') ? String(params.at(-1)) : null;
      return rows([{ total: String(this.maintenance.filter((row) => !owner || row.created_by === owner).length) }]);
    }
    if (sql.startsWith('SELECT * FROM engineering_quotes')) {
      const id = sql.includes('WHERE id = $1') ? Number(params[0]) : null;
      const owner = sql.includes('created_by =') ? String(params[id ? 1 : 0]) : null;
      return rows(this.engineering.filter((row) => (!id || row.id === id) && (!owner || row.created_by === owner)));
    }
    if (sql.startsWith('SELECT * FROM maintenance_quotes')) {
      const owner = sql.includes('created_by =') ? String(params[0]) : null;
      return rows(this.maintenance.filter((row) => !owner || row.created_by === owner));
    }
    if (sql.startsWith('SELECT created_by FROM engineering_quotes')) {
      const quote = this.engineering.find((row) => row.id === Number(params[0]));
      return rows(quote ? [{ created_by: quote.created_by }] : []);
    }
    if (sql.includes('UNION ALL')) {
      const source = params[0] === null ? null : String(params[0]); const owner = params[1] === null ? null : String(params[1]);
      const snapshot = this.summaryRows().map((row) => ({ ...row })).filter((row) => (!source || row.source === source) && (!owner || row.created_by === owner));
      if (this.summaryBarrierTarget > 0 && source === 'engineering') {
        if (!this.summaryBarrierPromise) this.summaryBarrierPromise = new Promise<void>((resolve) => { this.summaryBarrierRelease = resolve; });
        this.summaryBarrierCount += 1;
        if (this.summaryBarrierCount >= this.summaryBarrierTarget) this.summaryBarrierRelease?.();
        await this.summaryBarrierPromise;
      }
      return rows(snapshot);
    }
    if (sql.startsWith('UPDATE engineering_quotes SET status')) {
      const quote = this.engineering.find((row) => row.id === Number(params[1]));
      if (!quote || (params[2] !== undefined && quote.status !== params[2])) return rows([]); quote.status = String(params[0]); quote.updated_at = '2026-08-04T03:00:00.000Z'; return rows([{ id: String(quote.id) }]);
    }
    if (sql.startsWith('SELECT id, quote_number AS quote_number, status FROM engineering_quotes')) {
      const quote = this.engineering.find((row) => row.id === Number(params[0]) && (params[1] === undefined || row.created_by === String(params[1])));
      return rows(quote ? [{ id: String(quote.id), quote_number: quote.quote_number, status: quote.status }] : []);
    }
    if (sql.includes('INSERT INTO quote_audit_logs')) {
      const id = this.audits.length + 1; this.audits.push({ id, quote_id: params[0], quote_type: params[1], action: params[2], from_status: params[3], to_status: params[4], operator: params[6] }); return rows([{ id: String(id) }]);
    }
    if (sql.includes('INSERT INTO quote_shares')) {
      const id = this.shares.length + 1; const share = { id: String(id), token: params[0], quote_id: params[1], quote_type: params[2], expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), max_views: params[4], view_count: 0, is_active: true }; this.shares.push(share); return rows([share]);
    }
    if (sql.includes('FROM quote_shares') && sql.includes('FOR UPDATE')) {
      const share = this.shares.find((item) => item.token === params[0]); return rows(share ? [share] : []);
    }
    if (sql.startsWith('UPDATE quote_shares SET view_count')) {
      const share = this.shares.find((item) => item.id === String(params[0]));
      if (!share) return rows([]); share.view_count = Number(share.view_count) + 1; return rows([{ view_count: share.view_count }]);
    }
    if (sql.startsWith('SELECT share.id, share.token')) {
      const limit = Number(params[1]); const offset = Number(params[2]);
      return rows(this.shares.slice(offset, offset + limit));
    }
    if (sql.startsWith('SELECT COUNT(*)::text AS total FROM quote_shares')) return rows([{ total: String(this.shares.length) }]);
    if (sql.includes('INSERT INTO quotation_records')) {
      const id = this.quotations.length + 301;
      const quotation = { id: String(id), user_id: String(params[0]), client_name: params[1], client_region: params[2], project_name: params[3], quote_type: params[4], total_amount: String(params[5]), device_count: params[6], quote_data: params[7] ? JSON.parse(String(params[7])) : null, status: 'draft', created_at: '2026-08-04T04:00:00.000Z', updated_at: '2026-08-04T04:00:00.000Z', name: String(params[0]) === '11' ? '成员甲' : '成员乙', username: String(params[0]) === '11' ? 'member-a' : 'member-b' };
      this.quotations.push(quotation); return rows([{ id: String(id) }]);
    }
    if (sql.includes('INSERT INTO quotation_devices')) {
      const id = this.quotationDevices.length + 1; this.quotationDevices.push({ id: String(id), quotation_id: String(params[0]), device_name: params[1] }); return rows([{ id: String(id) }]);
    }
    if (sql.startsWith('SELECT quotation.*, owner.name')) {
      const detail = sql.includes('WHERE quotation.id = $1');
      if (detail) return rows(this.quotations.filter((row) => Number(row.id) === Number(params[0])));
      const owner = sql.includes('quotation.user_id = $1') ? String(params[0]) : null;
      const limit = Number(params.at(-2)); const offset = Number(params.at(-1));
      return rows(this.quotations.filter((row) => !owner || String(row.user_id) === owner).slice(offset, offset + limit));
    }
    if (sql.startsWith('SELECT COUNT(*)::text AS total FROM quotation_records')) {
      const owner = sql.includes('user_id = $1') ? String(params[0]) : null; return rows([{ total: String(this.quotations.filter((row) => !owner || String(row.user_id) === owner).length) }]);
    }
    if (sql.startsWith('SELECT * FROM quotation_devices')) return rows(this.quotationDevices.filter((row) => Number(row.quotation_id) === Number(params[0])));
    if (sql.startsWith('SELECT id, user_id FROM quotation_records')) return rows(this.quotations.filter((row) => Number(row.id) === Number(params[0])).map((row) => ({ id: row.id, user_id: row.user_id })));
    if (sql.startsWith('DELETE FROM quotation_devices')) {
      const deleted = this.quotationDevices.filter((row) => Number(row.quotation_id) === Number(params[0])); return rows(deleted.map((row) => ({ id: row.id })), deleted.length);
    }
    if (sql.startsWith('DELETE FROM quotation_records')) {
      const index = this.quotations.findIndex((row) => Number(row.id) === Number(params[0])); if (index < 0) return rows([]); const [deleted] = this.quotations.splice(index, 1); return rows([{ id: deleted.id }]);
    }
    if (sql.startsWith('SELECT * FROM maintenance_quotes WHERE id=$1 FOR UPDATE')) return rows(this.maintenance.filter((row) => row.id === Number(params[0])));
    if (sql.startsWith('SELECT id, version, data FROM quote_versions')) {
      const matches = this.versions.filter((row) => Number(row.quote_id) === Number(params[0]) && row.quote_type === params[1]).sort((a, b) => Number(b.version) - Number(a.version)); return rows(matches.slice(0, 1));
    }
    if (sql.includes('INSERT INTO quote_versions')) {
      const id = this.versions.length + 1; const version = { id: String(id), quote_id: String(params[0]), quote_type: params[1], version: params[2], data: JSON.parse(String(params[3])), change_summary: params[4], created_by: params[5], created_at: '2026-08-04T05:00:00.000Z' }; this.versions.push(version); return rows([version]);
    }
    if (sql.startsWith('SELECT id, quote_id, quote_type, version, change_summary')) return rows(this.versions.filter((row) => Number(row.quote_id) === Number(params[0]) && row.quote_type === params[1]));
    if (sql.startsWith('SELECT id, quote_id, quote_type, version, data')) return rows(this.versions.filter((row) => Number(row.id) === Number(params[0])));
    if (sql.startsWith('SELECT id FROM maintenance_quotes WHERE id=$1')) return rows(this.maintenance.some((row) => row.id === Number(params[0]) && (params[1] === undefined || row.created_by === String(params[1]))) ? [{ id: String(params[0]) }] : []);
    if (sql.startsWith('SELECT id FROM engineering_quotes WHERE id=$1')) return rows(this.engineering.some((row) => row.id === Number(params[0]) && (params[1] === undefined || row.created_by === String(params[1]))) ? [{ id: String(params[0]) }] : []);
    if (sql.startsWith('SELECT COALESCE(MAX(version)')) return rows([{ max_version: Math.max(0, ...this.versions.filter((row) => Number(row.quote_id) === Number(params[0]) && row.quote_type === params[1]).map((row) => Number(row.version))) }]);
    if (sql.startsWith('UPDATE maintenance_quotes SET')) {
      const quote = this.maintenance.find((row) => row.id === Number(params.at(-1))); if (!quote) return rows([]);
      const assignments = / SET (.+) WHERE /.exec(sql)?.[1].split(', ') ?? [];
      for (const assignment of assignments) {
        const match = /^(\w+)=\$(\d+)(::jsonb)?$/.exec(assignment);
        if (!match) continue;
        const raw = params[Number(match[2]) - 1];
        quote[match[1]] = match[3] && typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      return rows([{ id: String(quote.id) }]);
    }
    if (sql.startsWith('UPDATE engineering_quotes SET')) {
      const quote = this.engineering.find((row) => row.id === Number(params.at(-1))); if (!quote) return rows([]);
      const assignments = / SET (.+) WHERE /.exec(sql)?.[1].split(', ') ?? [];
      for (const assignment of assignments) {
        const match = /^(\w+)=\$(\d+)(::jsonb)?$/.exec(assignment);
        if (!match) continue;
        const raw = params[Number(match[2]) - 1];
        quote[match[1]] = match[3] && typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      return rows([{ id: String(quote.id) }]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const previous = this.transactionTail;
    let release: (() => void) | undefined;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await work(this); } finally { release?.(); }
  }
  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

function request(pathname: string, token?: string, method = 'GET', body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, { method, headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : undefined, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function payload(response: Response): Promise<Record<string, unknown>> { return await response.json() as Record<string, unknown>; }

test('route business flow distinguishes auth, validation, ownership, admin, audit, share, and dashboard behavior', async () => {
  const database = new RouteDatabase();
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    assert.equal((await engineeringRoutes.GET(request('/api/engineering-quotes'))).status, 401);
    assert.equal((await engineeringRoutes.POST(request('/api/engineering-quotes', 'member-a-token', 'POST', { projectName: '' }))).status, 400);
    const engineeringCreated = await engineeringRoutes.POST(request('/api/engineering-quotes', 'member-a-token', 'POST', { quoteNumber: 'ENG-20260804-001', projectName: '成员甲工程', clientName: '客户甲', total: 100.1, items: [] }));
    const maintenanceCreated = await maintenanceRoutes.POST(request('/api/maintenance-quotes', 'member-b-token', 'POST', { quoteNumber: 'MAINT-20260804-001', projectName: '成员乙维保', clientName: '客户乙', total: 200.2, devices: [] }));
    assert.equal(engineeringCreated.status, 200); assert.equal(maintenanceCreated.status, 200);

    const memberAList = await payload(await engineeringRoutes.GET(request('/api/engineering-quotes', 'member-a-token')));
    const memberBList = await payload(await engineeringRoutes.GET(request('/api/engineering-quotes', 'member-b-token')));
    assert.equal((memberAList.data as unknown[]).length, 1); assert.equal((memberBList.data as unknown[]).length, 0);
    assert.equal((await engineeringDetailRoutes.GET(request('/api/engineering-quotes/101', 'member-b-token'), { params: Promise.resolve({ id: '101' }) })).status, 404);
    assert.equal((await engineeringDetailRoutes.GET(request('/api/engineering-quotes/101', 'admin-token'), { params: Promise.resolve({ id: '101' }) })).status, 200);
    assert.equal((await engineeringRoutes.PUT(request('/api/engineering-quotes', 'member-b-token', 'PUT', { id: 101, quoteNumber: 'ENG-20260804-001', projectName: '越权修改' }))).status, 403);
    assert.equal((await unifiedQuoteRoutes.DELETE(request('/api/quotes/engineering%3A101', 'member-b-token', 'DELETE'), { params: Promise.resolve({ id: 'engineering:101' }) })).status, 403);

    const transitioned = await statusRoutes.PUT(request('/api/quotes/engineering%3A101/status', 'member-a-token', 'PUT', { action: 'submit_review', comment: '请审核' }), { params: Promise.resolve({ id: 'engineering:101' }) });
    assert.equal(transitioned.status, 200); assert.equal(database.audits.length, 1); assert.equal(database.engineering[0]?.status, 'pending_review'); assert.ok(database.transactionCount >= 1);
    assert.equal((await statusRoutes.PUT(request('/api/quotes/engineering%3A101/status', 'member-b-token', 'PUT', { action: 'approve' }), { params: Promise.resolve({ id: 'engineering:101' }) })).status, 404);

    const shareResponse = await shareRoutes.POST(request('/api/quotes/share', 'member-a-token', 'POST', { quoteId: 'engineering:101', expiryDays: 7, maxViews: 2 }));
    const sharePayload = await payload(shareResponse); const shareData = sharePayload.data as Record<string, unknown>;
    assert.match(String(shareData.shareUrl), /^\/share\/[a-f0-9]{32}$/);
    assert.ok(new Date(String(shareData.expiresAt)).getTime() > Date.now());
    const token = String(shareData.token);
    const publicResponse = await publicShareRoutes.GET(request(`/api/share/${token}`), { params: Promise.resolve({ token }) });
    assert.equal(publicResponse.status, 200);

    const dashboard = await payload(await dashboardRoutes.GET(request('/api/dashboard/stats', 'member-a-token')));
    assert.equal((dashboard.data as { overview: { totalCount: number; totalAmount: number } }).overview.totalCount, 1);
    assert.equal((dashboard.data as { overview: { totalCount: number; totalAmount: number } }).overview.totalAmount, 100.1);
  } finally {
    delete globalDatabase.__itsPostgresDatabaseClient__;
  }
});

test('concurrent status transitions lock the current status and write exactly one audit record', async () => {
  const database = new RouteDatabase();
  database.engineering.push({ id: 101, quote_number: 'ENG-RACE', project_name: '并发工程', client_name: '客户甲', total: '100.00', status: 'draft', created_by: '11', created_by_name: '成员甲', created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z' });
  database.summaryBarrierTarget = 2;
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    const invoke = () => statusRoutes.PUT(request('/api/quotes/engineering%3A101/status', 'member-a-token', 'PUT', { action: 'submit_review' }), { params: Promise.resolve({ id: 'engineering:101' }) });
    const responses = await Promise.all([invoke(), invoke()]);
    const statuses = responses.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 200).length, 1);
    assert.ok(statuses.some((status) => status === 400 || status === 409));
    assert.equal(database.audits.length, 1);
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('version save/list/detail/restore preserves supplied maintenance DTO fields', async () => {
  const database = new RouteDatabase();
  database.maintenance.push({ id: 201, quote_number: 'MAINT-VERSION', project_name: '旧项目', client_name: '旧客户', total: '100.00', status: 'draft', created_by: '11', created_by_name: '成员甲', created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z' });
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    const quoteData = { versionName: '客户确认版', projectName: '新项目', clientName: '新客户', total: 345.67, devices: [{ name: '摄像机', quantity: 2 }] };
    const saved = await payload(await versionRoutes.POST(request('/api/quotes/versions', 'member-a-token', 'POST', { quoteId: 201, quoteType: 'maintenance', quoteData })));
    assert.equal((saved.data as Record<string, unknown>).version, 1);
    const listed = await payload(await versionRoutes.GET(request('/api/quotes/versions?quoteId=201&quoteType=maintenance', 'member-a-token')));
    assert.equal((listed.data as unknown[]).length, 1);
    const detail = await payload(await versionDetailRoutes.GET(request('/api/quotes/versions/1', 'member-a-token'), { params: Promise.resolve({ id: '1' }) }));
    assert.deepEqual((detail.data as Record<string, unknown>).data, { ...quoteData, total: '345.67' });
    const revised = { ...quoteData, versionName: '最终审定版', total: 456.78 };
    const second = await payload(await versionRoutes.POST(request('/api/quotes/versions', 'member-a-token', 'POST', { quoteId: 201, quoteType: 'maintenance', quoteData: revised })));
    assert.equal((second.data as Record<string, unknown>).version, 2);
    assert.match(String((second.data as Record<string, unknown>).changeSummary), /versionName/);
    assert.match(String((second.data as Record<string, unknown>).changeSummary), /total/);
    const restored = await versionDetailRoutes.POST(request('/api/quotes/versions/1', 'member-a-token', 'POST'), { params: Promise.resolve({ id: '1' }) });
    assert.equal(restored.status, 200);
    assert.equal(database.maintenance[0]?.project_name, '新项目');
    assert.equal(database.maintenance[0]?.client_name, '新客户');
    assert.equal(database.maintenance[0]?.total, '345.67');
    assert.deepEqual(database.maintenance[0]?.devices, [{ name: '摄像机', quantity: 2 }]);
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('version totals enforce numeric(18,2), persist canonical decimals, and restore the same value', async () => {
  const database = new RouteDatabase();
  database.maintenance.push({ id: 201, quote_number: 'MAINT-MONEY', project_name: '旧项目', client_name: '旧客户', total: '100.00', status: 'draft', created_by: '11', created_by_name: '成员甲', created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z' });
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    for (const total of [100.005, Number.POSITIVE_INFINITY, '10000000000000000.00']) {
      const response = await versionRoutes.POST(request('/api/quotes/versions', 'member-a-token', 'POST', {
        quoteId: 201, quoteType: 'maintenance', quoteData: { versionName: '非法金额', total, devices: [] },
      }));
      assert.equal(response.status, 400, `expected ${String(total)} to be rejected`);
    }
    assert.equal(database.versions.length, 0);

    const saved = await versionRoutes.POST(request('/api/quotes/versions', 'member-a-token', 'POST', {
      quoteId: 201, quoteType: 'maintenance', quoteData: { versionName: '规范金额', total: '000345.6', devices: [] },
    }));
    assert.equal(saved.status, 200);
    const storedSnapshot = database.versions[0]?.data as Record<string, unknown>;
    assert.equal(storedSnapshot.total, '345.60');

    const restored = await versionDetailRoutes.POST(request('/api/quotes/versions/1', 'member-a-token', 'POST'), { params: Promise.resolve({ id: '1' }) });
    assert.equal(restored.status, 200);
    assert.equal(database.maintenance[0]?.total, storedSnapshot.total);
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('version restore rejects a legacy snapshot outside numeric(18,2)', async () => {
  const database = new RouteDatabase();
  database.maintenance.push({ id: 201, quote_number: 'MAINT-LEGACY', project_name: '旧项目', client_name: '旧客户', total: '100.00', status: 'draft', created_by: '11', created_by_name: '成员甲', created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z' });
  database.versions.push({ id: '1', quote_id: '201', quote_type: 'maintenance', version: 1, data: { total: '100.005', devices: [] } });
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    const restored = await versionDetailRoutes.POST(request('/api/quotes/versions/1', 'member-a-token', 'POST'), { params: Promise.resolve({ id: '1' }) });
    assert.equal(restored.status, 400);
    assert.equal(database.maintenance[0]?.total, '100.00');
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('version snapshot normalization covers every restored numeric(18,2) alias', () => {
  const fields = [
    'total', 'totalAmount', 'total_amount',
    'tax', 'subtotal', 'managementFee', 'management_fee', 'profit', 'regulatoryFee', 'regulatory_fee',
    'subtotalBeforeDiscount', 'subtotal_before_discount', 'slaAdjustment', 'sla_adjustment',
    'regionAdjustment', 'region_adjustment', 'subtotalAfterCoefficients', 'subtotal_after_coefficients',
    'yearsDiscountAmount', 'years_discount_amount', 'bulkDiscountAmount', 'bulk_discount_amount',
  ];
  for (const field of fields) {
    assert.equal(normalizeQuoteVersionSnapshot({ [field]: '100.005' }), null, `${field} accepted more than two decimals`);
  }
  const normalized = normalizeQuoteVersionSnapshot(Object.fromEntries(fields.map((field) => [field, '000100.5'])));
  assert.ok(normalized);
  for (const field of fields) assert.equal(normalized[field], '100.50', `${field} was not canonicalized`);
});

test('engineering and maintenance restore every mapped monetary field from its canonical snapshot', async () => {
  const database = new RouteDatabase();
  database.engineering.push({ id: 101, quote_number: 'ENG-MONEY', project_name: '工程', client_name: '客户', total: '0.00', status: 'draft', created_by: '11', created_by_name: '成员甲', created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z' });
  database.maintenance.push({ id: 201, quote_number: 'MAINT-MONEY-ALL', project_name: '维保', client_name: '客户', total: '0.00', status: 'draft', created_by: '11', created_by_name: '成员甲', created_at: '2026-08-04T01:00:00.000Z', updated_at: '2026-08-04T01:00:00.000Z' });
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    const engineeringData = {
      tax: '001.1', subtotal: '002.2', managementFee: '003.3', profit: '004.4',
      regulatory_fee: '005.5', total: '006.6', items: [],
    };
    assert.equal((await versionRoutes.POST(request('/api/quotes/versions', 'member-a-token', 'POST', { quoteId: 101, quoteType: 'engineering', quoteData: engineeringData }))).status, 200);
    const engineeringSnapshot = database.versions[0]?.data as Record<string, unknown>;
    assert.equal((await versionDetailRoutes.POST(request('/api/quotes/versions/1', 'member-a-token', 'POST'), { params: Promise.resolve({ id: '1' }) })).status, 200);
    for (const [snapshotField, column] of [['tax', 'tax'], ['subtotal', 'subtotal'], ['managementFee', 'management_fee'], ['profit', 'profit'], ['regulatory_fee', 'regulatory_fee'], ['total', 'total']] as const) {
      assert.equal(database.engineering[0]?.[column], engineeringSnapshot[snapshotField], column);
    }

    const maintenanceData = {
      tax: '011.1', subtotalBeforeDiscount: '012.2', sla_adjustment: '013.3',
      regionAdjustment: '014.4', subtotal_after_coefficients: '015.5',
      yearsDiscountAmount: '016.6', bulk_discount_amount: '017.7', total: '018.8', devices: [],
    };
    assert.equal((await versionRoutes.POST(request('/api/quotes/versions', 'member-a-token', 'POST', { quoteId: 201, quoteType: 'maintenance', quoteData: maintenanceData }))).status, 200);
    const maintenanceSnapshot = database.versions[2]?.data as Record<string, unknown>;
    assert.equal((await versionDetailRoutes.POST(request('/api/quotes/versions/3', 'member-a-token', 'POST'), { params: Promise.resolve({ id: '3' }) })).status, 200);
    for (const [snapshotField, column] of [
      ['tax', 'tax'], ['subtotalBeforeDiscount', 'subtotal_before_discount'], ['sla_adjustment', 'sla_adjustment'],
      ['regionAdjustment', 'region_adjustment'], ['subtotal_after_coefficients', 'subtotal_after_coefficients'],
      ['yearsDiscountAmount', 'years_discount_amount'], ['bulk_discount_amount', 'bulk_discount_amount'], ['total', 'total'],
    ] as const) {
      assert.equal(database.maintenance[0]?.[column], maintenanceSnapshot[snapshotField], column);
    }
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('share list uses a visibility-matched count and public shares distinguish expiry', async () => {
  const database = new RouteDatabase();
  for (let index = 0; index < 3; index += 1) database.shares.push({ id: String(index + 1), token: `${index}`.padStart(32, 'a'), quote_id: 101, quote_type: 'engineering', expires_at: '2026-08-11T00:00:00.000Z', max_views: 0, view_count: 0, is_active: true, created_at: `2026-08-0${index + 1}T00:00:00.000Z` });
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    const secondPage = await payload(await shareRoutes.GET(request('/api/quotes/share?page=2&limit=2', 'admin-token')));
    assert.deepEqual(secondPage.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
    const expiredToken = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    database.shares.push({ id: '4', token: expiredToken, quote_id: 101, quote_type: 'engineering', expires_at: '2026-08-03T00:00:00.000Z', max_views: 0, view_count: 0, is_active: true });
    const expired = await publicShareRoutes.GET(request(`/api/share/${expiredToken}`), { params: Promise.resolve({ token: expiredToken }) });
    assert.equal(expired.status, 410);
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('quotation create/list/detail/delete remains isolated between two members', async () => {
  const database = new RouteDatabase();
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = database;
  try {
    assert.equal((await quotationRoutes.POST(request('/api/quotations', 'member-a-token', 'POST', { client_name: '客户甲', project_name: '甲项目', total_amount: 10, devices: [] }))).status, 201);
    assert.equal((await quotationRoutes.POST(request('/api/quotations', 'member-b-token', 'POST', { client_name: '客户乙', project_name: '乙项目', total_amount: 20, devices: [] }))).status, 201);
    const memberA = await payload(await quotationRoutes.GET(request('/api/quotations', 'member-a-token')));
    assert.equal(((memberA.data as Record<string, unknown>).records as unknown[]).length, 1);
    assert.equal((await quotationDetailRoutes.GET(request('/api/quotations/301', 'member-b-token'), { params: Promise.resolve({ id: '301' }) })).status, 403);
    assert.equal((await quotationDetailRoutes.DELETE(request('/api/quotations/301', 'member-b-token', 'DELETE'), { params: Promise.resolve({ id: '301' }) })).status, 403);
    assert.equal((await quotationDetailRoutes.DELETE(request('/api/quotations/301', 'member-a-token', 'DELETE'), { params: Promise.resolve({ id: '301' }) })).status, 200);
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

const scopedFiles = [
  'src/lib/quote-access.ts', 'src/lib/quote-share.ts', 'src/lib/quote-summary.ts',
  ...[
    'engineering-quotes/route.ts', 'engineering-quotes/[id]/route.ts',
    'engineering-quotes/stats/route.ts', 'engineering-quotes/batch-export/route.ts',
    'maintenance-quotes/route.ts', 'quotations/route.ts', 'quotations/[id]/route.ts',
    'quotes/route.ts', 'quotes/[id]/route.ts', 'quotes/[id]/status/route.ts',
    'quotes/[id]/audit-log/route.ts', 'quotes/compare/route.ts', 'quotes/share/route.ts',
    'quotes/versions/route.ts', 'quotes/versions/[id]/route.ts', 'share/[token]/route.ts',
    'audit-logs/route.ts', 'dashboard/stats/route.ts',
  ].map((file) => `src/app/api/${file}`),
];

test('all scoped quote workflow files use async PostgreSQL and no SQLite/MySQL APIs', () => {
  const root = path.resolve(import.meta.dirname, '..');
  for (const file of scopedFiles) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /@\/lib\/db|better[-]sqlite3|\bdb\.(prepare|exec)\b/, file);
    assert.doesNotMatch(source, /(?:=|\(|,)\s*\?(?:\s|,|\))/, `${file} contains a positional ? placeholder`);
    assert.match(source, /DatabaseClient|getDatabase|quote-summary|quote-access|quote-share/, `${file} has no PostgreSQL boundary`);
  }
});

test('live PostgreSQL quote business flow', {
  skip: process.env.TEST_DATABASE_URL ? false : POSTGRES_TEST_SKIP_REASON,
}, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  const engineering = await harness.client.query<{ id: string } & Record<string, unknown>>(`
    INSERT INTO engineering_quotes (quote_number, project_name, client_name, total, created_by, created_by_name)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id::text AS id
  `, ['ENG-LIVE-001', '集成工程', '客户甲', '100.10', '11', '成员甲']);
  const maintenance = await harness.client.query<{ id: string } & Record<string, unknown>>(`
    INSERT INTO maintenance_quotes (quote_number, project_name, client_name, total, created_by, created_by_name)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id::text AS id
  `, ['MAINT-LIVE-001', '集成维保', '客户乙', '200.20', '22', '成员乙']);
  const engineeringId = Number(engineering.rows[0]?.id); const maintenanceId = Number(maintenance.rows[0]?.id);
  assert.deepEqual((await getQuoteSummaries(harness.client, { createdBy: '11' })).map((quote) => quote.identity), [`engineering:${engineeringId}`]);
  assert.equal(await canAccessQuote(harness.client, { role: 'its_member', userId: 11 }, 'maintenance', maintenanceId), false);
  assert.equal(await updateQuoteDetails(harness.client, `engineering:${engineeringId}`, { projectName: '集成工程更新', clientName: '客户甲', total: 125.25 }), true);
  assert.equal(await updateQuoteStatus(harness.client, `engineering:${engineeringId}`, 'approved'), true);
  const token = 'abcdef0123456789abcdef0123456789';
  await harness.client.query(`
    INSERT INTO quote_shares (token, quote_id, quote_type, expires_at, max_views)
    VALUES ($1,$2,'engineering',CURRENT_TIMESTAMP + INTERVAL '1 day',1)
  `, [token, engineeringId]);
  assert.equal((await consumeQuoteShare(harness.client, token)).ok, true);
  assert.deepEqual(await consumeQuoteShare(harness.client, token), { ok: false, reason: 'view_limit' });

  const raceQuote = await harness.client.query<{ id: string } & Record<string, unknown>>(`
    INSERT INTO engineering_quotes (quote_number, project_name, total, status, created_by)
    VALUES ($1,$2,$3,'draft',$4) RETURNING id::text AS id
  `, ['ENG-LIVE-RACE', '并发状态集成', '10.00', '11']);
  const raceId = Number(raceQuote.rows[0]?.id);
  await saveSession(harness.client, 'live-admin-token', { role: 'admin', name: '集成管理员', expiresAt: Date.now() + 60_000 });
  const globalDatabase = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  globalDatabase.__itsPostgresDatabaseClient__ = harness.client;
  try {
    const invoke = () => statusRoutes.PUT(
      request(`/api/quotes/engineering%3A${raceId}/status`, 'live-admin-token', 'PUT', { action: 'submit_review' }),
      { params: Promise.resolve({ id: `engineering:${raceId}` }) },
    );
    const statuses = (await Promise.all([invoke(), invoke()])).map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 200).length, 1);
    assert.ok(statuses.some((status) => status === 400 || status === 409));
    const audits = await harness.client.query<{ count: string } & Record<string, unknown>>(
      "SELECT COUNT(*)::text AS count FROM quote_audit_logs WHERE quote_id=$1 AND quote_type='engineering'",
      [raceId],
    );
    assert.equal(audits.rows[0]?.count, '1');
  } finally { delete globalDatabase.__itsPostgresDatabaseClient__; }
});

test('live PostgreSQL concurrent share requests enforce max_views=1', {
  skip: process.env.TEST_DATABASE_URL ? false : POSTGRES_TEST_SKIP_REASON,
}, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  const quote = await harness.client.query<{ id: string } & Record<string, unknown>>(`
    INSERT INTO engineering_quotes (quote_number, project_name, total, created_by)
    VALUES ($1,$2,$3,$4) RETURNING id::text AS id
  `, ['ENG-LIVE-SHARE-RACE', '并发分享集成', '10.00', '11']);
  const quoteId = Number(quote.rows[0]?.id);
  const token = '1234567890abcdef1234567890abcdef';
  await harness.client.query(`
    INSERT INTO quote_shares (token, quote_id, quote_type, expires_at, max_views)
    VALUES ($1,$2,'engineering',CURRENT_TIMESTAMP + INTERVAL '1 day',1)
  `, [token, quoteId]);
  const secondClient = harness.createAdditionalClient();
  const results = await Promise.all([
    consumeQuoteShare(harness.client, token),
    consumeQuoteShare(secondClient, token),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.reason === 'view_limit').length, 1);
  const views = await harness.client.query<{ view_count: number } & Record<string, unknown>>('SELECT view_count FROM quote_shares WHERE token=$1', [token]);
  assert.equal(views.rows[0]?.view_count, 1);
});
