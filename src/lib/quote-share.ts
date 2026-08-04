import type { DatabaseClient } from './database/client';
import { asQuoteSource } from './quote-access';
import { getQuoteSummaries, type QuoteSummary } from './quote-summary';

interface ShareRow extends Record<string, unknown> {
  id: string | number | bigint;
  quote_id: string | number | bigint;
  quote_type: string;
  expires_at: Date | string | null;
  max_views: number;
  view_count: number;
  is_active: boolean;
}

interface ViewCountRow extends Record<string, unknown> {
  view_count: number;
}

export type QuoteShareConsumption =
  | { ok: true; quote: QuoteSummary; viewCount: number; expiresAt: string | null }
  | { ok: false; reason: 'missing' | 'inactive' | 'expired' | 'view_limit' | 'quote_missing' };

function serializedDate(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export async function consumeQuoteShare(
  database: DatabaseClient,
  token: string,
  now = Date.now(),
): Promise<QuoteShareConsumption> {
  return await database.transaction(async (client) => {
    const shareResult = await client.query<ShareRow>(`
      SELECT id, quote_id, quote_type, expires_at, max_views, view_count, is_active
      FROM quote_shares
      WHERE token = $1
      FOR UPDATE
    `, [token]);
    const share = shareResult.rows[0];
    if (!share) return { ok: false, reason: 'missing' };
    if (!share.is_active) return { ok: false, reason: 'inactive' };

    const expiresAt = serializedDate(share.expires_at);
    if (expiresAt && new Date(expiresAt).getTime() <= now) {
      return { ok: false, reason: 'expired' };
    }
    if (share.max_views > 0 && share.view_count >= share.max_views) {
      return { ok: false, reason: 'view_limit' };
    }

    const source = asQuoteSource(share.quote_type);
    if (!source) return { ok: false, reason: 'quote_missing' };
    const quoteId = Number(share.quote_id);
    if (!Number.isSafeInteger(quoteId) || quoteId <= 0) return { ok: false, reason: 'quote_missing' };
    const quote = (await getQuoteSummaries(client, { source })).find((item) => item.id === quoteId);
    if (!quote) return { ok: false, reason: 'quote_missing' };

    const updated = await client.query<ViewCountRow>(`
      UPDATE quote_shares
      SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > $2::timestamptz)
        AND (max_views <= 0 OR view_count < max_views)
      RETURNING view_count
    `, [share.id, new Date(now).toISOString()]);
    const view = updated.rows[0];
    if (!view) return { ok: false, reason: 'view_limit' };
    return { ok: true, quote, viewCount: view.view_count, expiresAt };
  });
}
