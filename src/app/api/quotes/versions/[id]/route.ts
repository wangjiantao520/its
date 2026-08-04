import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { asQuoteSource, canAccessQuote } from '@/lib/quote-access';
import type { QuoteSource } from '@/lib/quote-summary';

type Context = { params: Promise<{ id: string }> };
interface VersionRow extends Record<string, unknown> { id: string | number | bigint; quote_id: string | number | bigint; quote_type: string; version: number; data: unknown }
interface IdRow extends Record<string, unknown> { id: string | number | bigint }
const TABLES: Record<QuoteSource, 'engineering_quotes' | 'maintenance_quotes' | 'quotation_records'> = { engineering: 'engineering_quotes', maintenance: 'maintenance_quotes', quotation: 'quotation_records' };
function safeId(value: string): number | null { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }
function asRecord(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = safeId((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的版本ID' }, { status: 400 });
    const database = getDatabase();
    const version = (await database.query<VersionRow>('SELECT id, quote_id, quote_type, version, data, change_summary, created_by, created_at FROM quote_versions WHERE id=$1', [id])).rows[0];
    if (!version) return NextResponse.json({ success: false, error: '版本不存在' }, { status: 404 });
    const source = asQuoteSource(version.quote_type);
    if (!source || !await canAccessQuote(database, auth.session, source, Number(version.quote_id))) return NextResponse.json({ success: false, error: '版本不存在或无权访问' }, { status: 404 });
    return NextResponse.json({ success: true, data: { ...version, id: String(version.id), quote_id: String(version.quote_id) } });
  } catch (error) {
    console.error('获取版本详情失败:', error);
    return NextResponse.json({ success: false, error: '获取版本详情失败' }, { status: 500 });
  }
}

function restoreFields(source: QuoteSource, snapshot: Record<string, unknown>): Array<[string, unknown]> {
  const mappings: Array<[string, readonly string[]]> = [
    ['project_name', ['projectName', 'project_name']], ['client_name', ['clientName', 'client_name']],
    ['status', ['status']], ['contact_person', ['contactPerson', 'contact_person']],
    ['contact_phone', ['contactPhone', 'contact_phone']], ['tax', ['tax']],
  ];
  if (source === 'quotation') mappings.push(['total_amount', ['total', 'totalAmount', 'total_amount']], ['quote_data', ['quoteData', 'quote_data']]);
  if (source === 'engineering') mappings.push(
    ['construction_area', ['constructionArea', 'construction_area']], ['management_rate', ['managementRate', 'management_rate']],
    ['profit_rate', ['profitRate', 'profit_rate']], ['regulatory_rate', ['regulatoryRate', 'regulatory_rate']],
    ['tax_rate', ['taxRate', 'tax_rate']], ['subtotal', ['subtotal']], ['management_fee', ['managementFee', 'management_fee']],
    ['profit', ['profit']], ['regulatory_fee', ['regulatoryFee', 'regulatory_fee']], ['total', ['total']], ['items', ['items']],
  );
  if (source === 'maintenance') mappings.push(
    ['region', ['region']], ['service_years', ['serviceYears', 'service_years']], ['engineer_level', ['engineerLevel', 'engineer_level']],
    ['sla_config', ['slaConfig', 'sla_config']], ['subtotal_before_discount', ['subtotalBeforeDiscount', 'subtotal_before_discount']],
    ['sla_adjustment', ['slaAdjustment', 'sla_adjustment']], ['region_adjustment', ['regionAdjustment', 'region_adjustment']],
    ['subtotal_after_coefficients', ['subtotalAfterCoefficients', 'subtotal_after_coefficients']], ['years_discount', ['yearsDiscount', 'years_discount']],
    ['bulk_discount', ['bulkDiscount', 'bulk_discount']], ['years_discount_amount', ['yearsDiscountAmount', 'years_discount_amount']],
    ['bulk_discount_amount', ['bulkDiscountAmount', 'bulk_discount_amount']], ['total', ['total']], ['devices', ['devices']],
  );
  return mappings.flatMap(([column, keys]) => {
    const key = keys.find((candidate) => candidate in snapshot);
    if (!key) return [];
    return [[column, snapshot[key]]];
  });
}

async function updateFromSnapshot(database: DatabaseClient, source: QuoteSource, quoteId: number, version: number, snapshot: Record<string, unknown>): Promise<void> {
  const fields = restoreFields(source, snapshot);
  if (source === 'quotation' && !fields.some(([field]) => field === 'quote_data')) fields.push(['quote_data', snapshot]);
  const assignments = fields.map(([field], index) => `${field}=$${index + 1}${['items', 'devices', 'sla_config', 'quote_data'].includes(field) ? '::jsonb' : ''}`);
  const values = fields.map(([field, value]) => ['items', 'devices', 'sla_config', 'quote_data'].includes(field) && value !== null ? JSON.stringify(value) : value);
  if (source !== 'quotation') { assignments.push(`version=$${values.length + 1}`); values.push(version); }
  assignments.push('updated_at=CURRENT_TIMESTAMP'); values.push(quoteId);
  const updated = await database.query<IdRow>(`UPDATE ${TABLES[source]} SET ${assignments.join(', ')} WHERE id=$${values.length} RETURNING id`, values);
  if (!updated.rows[0]) throw new Error('报价不存在');
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const id = safeId((await params).id);
    if (!id) return NextResponse.json({ success: false, error: '无效的版本ID' }, { status: 400 });
    const database = getDatabase();
    const version = (await database.query<VersionRow>('SELECT id, quote_id, quote_type, version, data FROM quote_versions WHERE id=$1', [id])).rows[0];
    if (!version) return NextResponse.json({ success: false, error: '版本不存在' }, { status: 404 });
    const source = asQuoteSource(version.quote_type); const quoteId = Number(version.quote_id); const snapshot = asRecord(version.data);
    if (!source || !snapshot || !await canAccessQuote(database, auth.session, source, quoteId)) return NextResponse.json({ success: false, error: '版本不存在或无权访问' }, { status: 404 });
    const nextVersion = await database.transaction(async (client) => {
      await client.query<Record<string, unknown>>(`SELECT id FROM ${TABLES[source]} WHERE id=$1 FOR UPDATE`, [quoteId]);
      if (!await canAccessQuote(client, auth.session, source, quoteId)) throw new Error('报价不存在或无权访问');
      const maximum = await client.query<{ max_version: number } & Record<string, unknown>>('SELECT COALESCE(MAX(version),0)::integer AS max_version FROM quote_versions WHERE quote_id=$1 AND quote_type=$2', [quoteId, source]);
      const next = (maximum.rows[0]?.max_version ?? 0) + 1;
      await updateFromSnapshot(client, source, quoteId, next, snapshot);
      await client.query<IdRow>(`
        INSERT INTO quote_versions (quote_id, quote_type, version, data, change_summary, created_by)
        VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id
      `, [quoteId, source, next, JSON.stringify(snapshot), `从版本 ${version.version} 恢复到当前版本`, auth.session.name || auth.session.username || auth.session.role]);
      return next;
    });
    return NextResponse.json({ success: true, data: { newVersion: nextVersion, restoredFrom: version.version, message: `已成功从版本 ${version.version} 恢复到版本 ${nextVersion}` } });
  } catch (error) {
    console.error('恢复版本失败:', error);
    return NextResponse.json({ success: false, error: '恢复版本失败' }, { status: 500 });
  }
}
