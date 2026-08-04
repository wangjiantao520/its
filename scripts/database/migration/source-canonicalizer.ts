type SourceMoneyValue = bigint | number | string | boolean;

export function canonicalizeSourceMoney(value: SourceMoneyValue): bigint {
  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('SQLite source contains an invalid money value.');
  const negative = match[1] === '-';
  const integer = match[2];
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent)) throw new Error('SQLite source contains an invalid money exponent.');
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, '');
  const decimalPlaces = fraction.length - exponent;
  let cents: bigint;
  if (decimalPlaces <= 2) {
    cents = BigInt(digits || '0') * BigInt(10 ** (2 - decimalPlaces));
  } else {
    const keepLength = Math.max(0, digits.length - (decimalPlaces - 2));
    const kept = digits.slice(0, keepLength) || '0';
    const discarded = digits.slice(keepLength).padStart(decimalPlaces - 2, '0');
    cents = BigInt(kept);
    if ((discarded[0] ?? '0') >= '5') cents += BigInt(1);
  }
  return negative && cents !== BigInt(0) ? -cents : cents;
}
