const NUMERIC_18_2_MAX_CENTS = BigInt('999999999999999999');
const TOTAL_FIELDS = ['total', 'totalAmount', 'total_amount'] as const;

function canonicalNumeric18_2(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (cents > NUMERIC_18_2_MAX_CENTS) return null;
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;
}

export function normalizeQuoteVersionSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> | null {
  const normalized = { ...snapshot };
  for (const field of TOTAL_FIELDS) {
    if (!(field in normalized)) continue;
    const canonical = canonicalNumeric18_2(normalized[field]);
    if (canonical === null) return null;
    normalized[field] = canonical;
  }
  return normalized;
}
