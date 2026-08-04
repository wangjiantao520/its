type TargetMoneyValue = bigint | number | string | boolean;

export function canonicalizeTargetMoney(value: TargetMoneyValue): bigint {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) throw new Error('PostgreSQL returned an invalid money value.');
  const fraction = match[3] ?? '';
  if (fraction.length > 2 && /[^0]/.test(fraction.slice(2))) {
    throw new Error('PostgreSQL returned an over-scale money value.');
  }
  const magnitude = BigInt(match[2]) * BigInt(100)
    + BigInt(fraction.slice(0, 2).padEnd(2, '0') || '0');
  return match[1] === '-' && magnitude !== BigInt(0) ? -magnitude : magnitude;
}
