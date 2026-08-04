import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { asQuoteSource, canAccessQuote } from '@/lib/quote-access';
import type { QuoteSource } from '@/lib/quote-summary';

interface VersionRow extends Record<string, unknown> { id: string | number | bigint; version: number; data?: unknown }
const TABLES: Record<QuoteSource, 'engineering_quotes' | 'maintenance_quotes' | 'quotation_records'> = {
  engineering: 'engineering_quotes', maintenance: 'maintenance_quotes', quotation: 'quotation_records',
};
function bodyRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function safeId(value: unknown): number | null { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }
function changeSummary(previous: unknown, current: Record<string, unknown>): string[] {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return ['初始版本'];
  const old = previous as Record<string, unknown>;
  const fields = ['project_name', 'client_name', 'contact_person', 'contact_phone', 'region', 'construction_area', 'subtotal', 'total', 'total_amount', 'status'];
  const changes = fields.filter((field) => JSON.stringify(old[field]) !== JSON.stringify(current[field])).map((field) => `修改 ${field}: ${String(old[field] ?? '')} → ${String(current[field] ?? '')}`);
  return changes.length ? changes : ['无变更'];
}

async function lockAndSnapshot(database: DatabaseClient, source: QuoteSource, quoteId: number): Promise<Record<string, unknown> | null> {
  const result = await database.query<Record<string, unknown>>(`SELECT * FROM ${TABLES[source]} WHERE id=$1 FOR UPDATE`, [quoteId]);
  return result.rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const body = bodyRecord(await request.json());
    const quoteId = safeId(body.quoteId); const quoteType = asQuoteSource(body.quoteType);
    if (!quoteId || !quoteType || !body.quoteData || typeof body.quoteData !== 'object' || Array.isArray(body.quoteData)) {
      return NextResponse.json({ success: false, error: '缺少必需参数: quoteId, quoteType, quoteData' }, { status: 400 });
    }
    const database = getDatabase();
    if (!await canAccessQuote(database, auth.session, quoteType, quoteId)) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    const saved = await database.transaction(async (client) => {
      const snapshot = await lockAndSnapshot(client, quoteType, quoteId);
      if (!snapshot || !await canAccessQuote(client, auth.session, quoteType, quoteId)) throw new Error('报价不存在或无权访问');
      const current = await client.query<VersionRow>(`
        SELECT id, version, data FROM quote_versions WHERE quote_id=$1 AND quote_type=$2
        ORDER BY version DESC LIMIT 1
      `, [quoteId, quoteType]);
      const previous = current.rows[0]; const version = (previous?.version ?? 0) + 1;
      const changes = changeSummary(previous?.data, snapshot);
      const inserted = await client.query<VersionRow>(`
        INSERT INTO quote_versions (quote_id, quote_type, version, data, change_summary, created_by)
        VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id, version
      `, [quoteId, quoteType, version, JSON.stringify(snapshot), changes.join('; '), auth.session.name || auth.session.username || auth.session.role]);
      return { versionId: String(inserted.rows[0]?.id), version, changeSummary: changes };
    });
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('保存报价版本失败:', error);
    return NextResponse.json({ success: false, error: '保存报价版本失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const quoteId = safeId(request.nextUrl.searchParams.get('quoteId'));
    const quoteType = asQuoteSource(request.nextUrl.searchParams.get('quoteType'));
    if (!quoteId || !quoteType) return NextResponse.json({ success: false, error: '缺少必需参数: quoteId, quoteType' }, { status: 400 });
    const database = getDatabase();
    if (!await canAccessQuote(database, auth.session, quoteType, quoteId)) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    const rows = await database.query<Record<string, unknown>>(`
      SELECT id, quote_id, quote_type, version, change_summary, created_by, created_at
      FROM quote_versions WHERE quote_id=$1 AND quote_type=$2 ORDER BY version DESC
    `, [quoteId, quoteType]);
    return NextResponse.json({ success: true, data: rows.rows.map((row) => ({ ...row, id: String(row.id), quote_id: String(row.quote_id) })) });
  } catch (error) {
    console.error('获取报价版本列表失败:', error);
    return NextResponse.json({ success: false, error: '获取报价版本列表失败' }, { status: 500 });
  }
}
