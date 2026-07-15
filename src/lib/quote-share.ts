import type Database from 'better-sqlite3';
import { getQuoteSummaries, type QuoteSource, type QuoteSummary } from './quote-summary';

interface ShareRow {
  id: number;
  quote_id: number;
  quote_type: QuoteSource;
  expires_at: string | null;
  max_views: number;
  view_count: number;
  is_active: number;
}

export type QuoteShareConsumption =
  | {
      ok: true;
      quote: QuoteSummary;
      viewCount: number;
      expiresAt: string | null;
    }
  | {
      ok: false;
      reason: 'missing' | 'inactive' | 'expired' | 'view_limit' | 'quote_missing';
    };

export function consumeQuoteShare(
  database: Database.Database,
  token: string,
  now = Date.now(),
): QuoteShareConsumption {
  const consume = database.transaction((): QuoteShareConsumption => {
    const share = database.prepare(`
      SELECT id, quote_id, quote_type, expires_at, max_views, view_count, is_active
      FROM quote_shares
      WHERE token = ?
    `).get(token) as ShareRow | undefined;

    if (!share) return { ok: false, reason: 'missing' };
    if (!share.is_active) return { ok: false, reason: 'inactive' };
    if (share.expires_at && new Date(share.expires_at).getTime() <= now) {
      return { ok: false, reason: 'expired' };
    }

    const quote = getQuoteSummaries(database, { source: share.quote_type })
      .find((item) => item.id === share.quote_id);
    if (!quote) return { ok: false, reason: 'quote_missing' };

    const updated = database.prepare(`
      UPDATE quote_shares
      SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND is_active = 1
        AND (max_views <= 0 OR view_count < max_views)
    `).run(share.id);
    if (updated.changes !== 1) return { ok: false, reason: 'view_limit' };

    return {
      ok: true,
      quote,
      viewCount: share.view_count + 1,
      expiresAt: share.expires_at,
    };
  });

  return consume();
}
