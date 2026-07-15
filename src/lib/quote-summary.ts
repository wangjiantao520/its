import type Database from 'better-sqlite3';

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
  if (!Number.isInteger(id) || id <= 0) return null;
  return { source: match[1] as QuoteSource, id };
}

function tableForSource(source: QuoteSource): string {
  if (source === 'engineering') return 'engineering_quotes';
  if (source === 'maintenance') return 'maintenance_quotes';
  return 'quotation_records';
}

export function updateQuoteStatus(
  database: Database.Database,
  identity: string,
  status: string,
): boolean {
  const parsed = parseQuoteIdentity(identity);
  if (!parsed) return false;
  const result = database
    .prepare(`UPDATE ${tableForSource(parsed.source)} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(status, parsed.id);
  return result.changes > 0;
}

export function deleteQuoteByIdentity(
  database: Database.Database,
  identity: string,
): boolean {
  const parsed = parseQuoteIdentity(identity);
  if (!parsed) return false;
  const result = database
    .prepare(`DELETE FROM ${tableForSource(parsed.source)} WHERE id = ?`)
    .run(parsed.id);
  return result.changes > 0;
}

export function updateQuoteDetails(
  database: Database.Database,
  identity: string,
  details: { projectName: string; clientName: string; total: number },
): boolean {
  const parsed = parseQuoteIdentity(identity);
  if (!parsed) return false;
  const amountColumn = parsed.source === 'quotation' ? 'total_amount' : 'total';
  const result = database.prepare(`
    UPDATE ${tableForSource(parsed.source)}
    SET project_name = ?, client_name = ?, ${amountColumn} = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(details.projectName, details.clientName, details.total, parsed.id);
  return result.changes > 0;
}

interface BusinessQuoteRow {
  id: number;
  quote_number: string | null;
  project_name: string | null;
  client_name: string | null;
  total: number | null;
  status: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface QuotationRow {
  id: number;
  user_id: number;
  client_name: string | null;
  project_name: string | null;
  quote_type: string | null;
  total_amount: number | null;
  quote_data: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function tableExists(database: Database.Database, name: string): boolean {
  return Boolean(
    database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name),
  );
}

function businessQuotes(
  database: Database.Database,
  table: 'engineering_quotes' | 'maintenance_quotes',
  source: 'engineering' | 'maintenance',
): QuoteSummary[] {
  if (!tableExists(database, table)) return [];
  const rows = database.prepare(`
    SELECT id, quote_number, project_name, client_name, total, status,
           created_by, created_by_name, created_at, updated_at
    FROM ${table}
  `).all() as BusinessQuoteRow[];

  return rows.map((row) => ({
    identity: `${source}:${row.id}`,
    source,
    id: row.id,
    quoteNumber: row.quote_number || `${source === 'engineering' ? 'ENG' : 'MAINT'}-${row.id}`,
    projectName: row.project_name || '未命名项目',
    clientName: row.client_name || '未填写客户',
    total: Number(row.total) || 0,
    status: row.status || 'draft',
    createdBy: row.created_by || '',
    createdByName: row.created_by_name || row.created_by || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }));
}

function linkedSource(value: string | null): { source: string; id: number } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const source = parsed.source_type;
    const id = Number(parsed.source_id);
    return typeof source === 'string' && Number.isInteger(id) ? { source, id } : null;
  } catch {
    return null;
  }
}

export function getQuoteSummaries(
  database: Database.Database,
  filter: QuoteSummaryFilter = {},
): QuoteSummary[] {
  const primary = [
    ...businessQuotes(database, 'engineering_quotes', 'engineering'),
    ...businessQuotes(database, 'maintenance_quotes', 'maintenance'),
  ];
  const primaryIds = new Set(primary.map((quote) => quote.identity));
  const quotations: QuoteSummary[] = [];

  if (tableExists(database, 'quotation_records')) {
    const rows = database.prepare(`
      SELECT id, user_id, client_name, project_name, quote_type, total_amount,
             quote_data, status, created_at, updated_at
      FROM quotation_records
    `).all() as QuotationRow[];

    for (const row of rows) {
      const linked = linkedSource(row.quote_data);
      if (
        linked &&
        (linked.source === 'engineering' || linked.source === 'maintenance') &&
        primaryIds.has(`${linked.source}:${linked.id}` as QuoteSummary['identity'])
      ) {
        continue;
      }
      quotations.push({
        identity: `quotation:${row.id}`,
        source: 'quotation',
        id: row.id,
        quoteNumber: `QUOTE-${row.id}`,
        projectName: row.project_name || '未命名项目',
        clientName: row.client_name || '未填写客户',
        total: Number(row.total_amount) || 0,
        status: row.status || 'draft',
        createdBy: String(row.user_id),
        createdByName: String(row.user_id),
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || row.created_at || '',
      });
    }
  }

  return [...primary, ...quotations]
    .filter((quote) => !filter.source || quote.source === filter.source)
    .filter((quote) => !filter.createdBy || quote.createdBy === filter.createdBy)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}
