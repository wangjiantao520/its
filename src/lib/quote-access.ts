import type { ApiSession } from './api-auth';
import type { DatabaseClient } from './database/client';
import { getQuoteSummaries, type QuoteSource } from './quote-summary';

export function asQuoteSource(value: unknown): QuoteSource | null {
  return value === 'engineering' || value === 'maintenance' || value === 'quotation'
    ? value
    : null;
}

export async function canAccessQuote(
  database: DatabaseClient,
  session: ApiSession,
  source: QuoteSource,
  quoteId: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(quoteId) || quoteId <= 0) return false;
  if (session.role === 'admin') {
    return (await getQuoteSummaries(database, { source })).some((quote) => quote.id === quoteId);
  }
  if (session.userId === undefined) return false;
  return (await getQuoteSummaries(database, {
    source,
    createdBy: String(session.userId),
  })).some((quote) => quote.id === quoteId);
}
