import type Database from 'better-sqlite3';
import type { ApiSession } from './api-auth';
import { getQuoteSummaries, type QuoteSource } from './quote-summary';

export function asQuoteSource(value: unknown): QuoteSource | null {
  return value === 'engineering' || value === 'maintenance' || value === 'quotation'
    ? value
    : null;
}

export function canAccessQuote(
  database: Database.Database,
  session: ApiSession,
  source: QuoteSource,
  quoteId: number,
): boolean {
  if (session.role === 'admin') return true;
  if (session.userId === undefined) return false;
  return getQuoteSummaries(database, {
    source,
    createdBy: String(session.userId),
  }).some((quote) => quote.id === quoteId);
}
