import type { DatabaseClient } from './database/client';

export type QuoteSource = 'engineering' | 'maintenance' | 'quotation';

export interface QuoteSummary {
  identity: `${QuoteSource}:${number}`;
  source: QuoteSource;
  id: number;
  quoteNumber: string;
  projectName: string;
  clientName: string;
  total: number;
  status: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteSummaryFilter {
  source?: QuoteSource;
  createdBy?: string;
}

interface QuoteSummaryRow extends Record<string, unknown> {
  source: string;
  id: string | number | bigint;
  quote_number: string | null;
  project_name: string | null;
  client_name: string | null;
  total: string | number | null;
  status: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface IdRow extends Record<string, unknown> {
  id: string | number | bigint;
}

const SOURCE_TABLES: Record<QuoteSource, 'engineering_quotes' | 'maintenance_quotes' | 'quotation_records'> = {
  engineering: 'engineering_quotes',
  maintenance: 'maintenance_quotes',
  quotation: 'quotation_records',
};
const exactQuoteTotals = new WeakMap<QuoteSummary, bigint>();

function toSafeId(value: string | number | bigint): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed <= BigInt(0) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Quote ID exceeds JavaScript safe integer range.');
  }
  return Number(parsed);
}

function toIsoString(value: Date | string | null): string {
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function quoteAmountToNumber(value: string | number | null): number {
  return quoteCentsToNumber(quoteAmountToCents(value));
}

export function quoteAmountToCents(value: string | number | null): bigint {
  const text = value === null ? '0' : String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new RangeError('PostgreSQL returned an invalid quote amount.');
  const cents = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  return cents;
}

export function quoteCentsToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Quote aggregate exceeds frontend safe numeric range.');
  }
  const numericCents = Number(value);
  const amount = numericCents / 100;
  if (Math.round(amount * 100) !== numericCents) {
    throw new RangeError('Quote aggregate exceeds frontend safe numeric range.');
  }
  return amount;
}

export function sumQuoteTotals(quotes: readonly Pick<QuoteSummary, 'total'>[]): number {
  return quoteCentsToNumber(sumQuoteTotalCents(quotes));
}

export function sumQuoteTotalCents(quotes: readonly Pick<QuoteSummary, 'total'>[]): bigint {
  return quotes.reduce(
    (sum, quote) => sum + (exactQuoteTotals.get(quote as QuoteSummary) ?? quoteAmountToCents(quote.total)),
    BigInt(0),
  );
}

export function quoteTotalToCents(quote: Pick<QuoteSummary, 'total'>): bigint {
  return exactQuoteTotals.get(quote as QuoteSummary) ?? quoteAmountToCents(quote.total);
}

export function parseQuoteIdentity(value: string): { source: QuoteSource; id: number } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const match = /^(engineering|maintenance|quotation):(\d+)$/.exec(decoded);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { source: match[1] as QuoteSource, id };
}

export async function updateQuoteStatus(
  database: DatabaseClient,
  identity: string,
  status: string,
): Promise<boolean> {
  const parsed = parseQuoteIdentity(identity);
  if (!parsed) return false;
  const result = await database.query<IdRow>(
    `UPDATE ${SOURCE_TABLES[parsed.source]}
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING id`,
    [status, parsed.id],
  );
  return result.rows.length > 0;
}

export async function deleteQuoteByIdentity(
  database: DatabaseClient,
  identity: string,
): Promise<boolean> {
  const parsed = parseQuoteIdentity(identity);
  if (!parsed) return false;
  const result = await database.query<IdRow>(
    `DELETE FROM ${SOURCE_TABLES[parsed.source]} WHERE id = $1 RETURNING id`,
    [parsed.id],
  );
  return result.rows.length > 0;
}

export async function updateQuoteDetails(
  database: DatabaseClient,
  identity: string,
  details: { projectName: string; clientName: string; total: number },
): Promise<boolean> {
  const parsed = parseQuoteIdentity(identity);
  if (!parsed) return false;
  const amountColumn = parsed.source === 'quotation' ? 'total_amount' : 'total';
  const result = await database.query<IdRow>(
    `UPDATE ${SOURCE_TABLES[parsed.source]}
     SET project_name = $1, client_name = $2, ${amountColumn} = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 RETURNING id`,
    [details.projectName, details.clientName, details.total.toFixed(2), parsed.id],
  );
  return result.rows.length > 0;
}

export async function getQuoteSummaries(
  database: DatabaseClient,
  filter: QuoteSummaryFilter = {},
): Promise<QuoteSummary[]> {
  const result = await database.query<QuoteSummaryRow>(`
    SELECT source, id, quote_number, project_name, client_name, total, status,
           created_by, created_by_name, created_at, updated_at
    FROM (
      SELECT 'engineering'::text AS source, id, quote_number, project_name, client_name,
             total::text AS total, status, COALESCE(created_by, '') AS created_by,
             COALESCE(created_by_name, created_by, '') AS created_by_name, created_at, updated_at
      FROM engineering_quotes
      UNION ALL
      SELECT 'maintenance'::text AS source, id, quote_number, project_name, client_name,
             total::text AS total, status, COALESCE(created_by, '') AS created_by,
             COALESCE(created_by_name, created_by, '') AS created_by_name, created_at, updated_at
      FROM maintenance_quotes
      UNION ALL
      SELECT 'quotation'::text AS source, quotation.id,
             'QUOTE-' || quotation.id::text AS quote_number, quotation.project_name,
             quotation.client_name, quotation.total_amount::text AS total, quotation.status,
             quotation.user_id::text AS created_by,
             COALESCE(owner.name, owner.username, quotation.user_id::text) AS created_by_name,
             quotation.created_at, quotation.updated_at
      FROM quotation_records quotation
      LEFT JOIN users owner ON owner.id = quotation.user_id
      WHERE NOT COALESCE(
        (
          (quotation.quote_data->>'source_type' = 'engineering' AND EXISTS (
            SELECT 1 FROM engineering_quotes linked WHERE linked.id::text = quotation.quote_data->>'source_id'
          ))
          OR
          (quotation.quote_data->>'source_type' = 'maintenance' AND EXISTS (
            SELECT 1 FROM maintenance_quotes linked WHERE linked.id::text = quotation.quote_data->>'source_id'
          ))
        ),
        false
      )
    ) AS quote_summaries
    WHERE ($1::text IS NULL OR source = $1)
      AND ($2::text IS NULL OR created_by = $2)
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `, [filter.source ?? null, filter.createdBy ?? null]);

  return result.rows.map((row) => {
    const source = row.source as QuoteSource;
    const id = toSafeId(row.id);
    const summary: QuoteSummary = {
      identity: `${source}:${id}` as QuoteSummary['identity'],
      source,
      id,
      quoteNumber: row.quote_number || `${source === 'engineering' ? 'ENG' : source === 'maintenance' ? 'MAINT' : 'QUOTE'}-${id}`,
      projectName: row.project_name || '未命名项目',
      clientName: row.client_name || '未填写客户',
      total: quoteAmountToNumber(row.total),
      status: row.status || 'draft',
      createdBy: row.created_by || '',
      createdByName: row.created_by_name || row.created_by || '',
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at ?? row.created_at),
    };
    exactQuoteTotals.set(summary, quoteAmountToCents(row.total));
    return summary;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}
