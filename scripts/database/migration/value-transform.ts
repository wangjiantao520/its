import {
  BOOLEAN_COLUMNS,
  JSON_COLUMNS,
  MONEY_COLUMNS,
  NON_NULL_TEMPORAL_COLUMNS,
  NULLABLE_TEMPORAL_COLUMNS,
  TIMESTAMP_COLUMNS,
} from './manifest';

type SqlitePrimitive = bigint | number | string | null;

const NUMERIC_18_2_MAX_CENTS = BigInt('999999999999999999');

function decimalToNumeric18_2Cents(value: Exclude<SqlitePrimitive, null>): bigint {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('numeric(18,2) requires a finite numeric value.');
  }
  const text = String(value).trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('numeric(18,2) requires a valid decimal value.');

  const negative = match[1] === '-';
  const integerPart = match[2] ?? '0';
  const fractionPart = match[3] ?? match[4] ?? '';
  const exponentText = match[5] ?? '0';
  if (exponentText.length > 6) {
    throw new Error(exponentText.startsWith('-')
      ? 'numeric(18,2) source scale exceeds the supported limit.'
      : 'numeric(18,2) value is out of range.');
  }
  const exponent = Number.parseInt(exponentText, 10);
  let digits = `${integerPart}${fractionPart}`.replace(/^0+/, '') || '0';
  let scale = fractionPart.length - exponent;

  if (digits === '0') return BigInt(0);
  while (scale > 0 && digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }
  if (scale > 18) {
    throw new Error('numeric(18,2) source scale exceeds the supported limit.');
  }
  const wholeDigits = Math.max(0, digits.length - scale);
  if (wholeDigits > 16 || scale < -16) {
    throw new Error('numeric(18,2) value is out of range.');
  }
  if (scale < 0) {
    digits = `${digits}${'0'.repeat(-scale)}`;
    scale = 0;
  }

  const coefficient = BigInt(digits);
  let cents: bigint;
  if (scale <= 2) {
    cents = coefficient * (BigInt(10) ** BigInt(2 - scale));
  } else {
    const divisor = BigInt(10) ** BigInt(scale - 2);
    cents = coefficient / divisor;
    const remainder = coefficient % divisor;
    if (remainder * BigInt(2) >= divisor) cents += BigInt(1);
  }
  if (cents > NUMERIC_18_2_MAX_CENTS) {
    throw new Error('numeric(18,2) value is out of range.');
  }
  return negative ? -cents : cents;
}
function formatCents(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  return `${negative ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}

function formatNumeric18_2(value: Exclude<SqlitePrimitive, null>): string {
  return formatCents(decimalToNumeric18_2Cents(value));
}


export function transformSqliteValue(table: string, column: string, value: SqlitePrimitive): unknown {
  const key = `${table}.${column}`;
  if (key === 'intelligent_project_quotas.serial_number' && typeof value === 'string') {
    const legacySerial = /^IP-(\d+)$/i.exec(value.trim());
    if (legacySerial) return Number.parseInt(legacySerial[1], 10);
  }
  if (BOOLEAN_COLUMNS.has(key)) {
    if (value === 0 || value === BigInt(0) || value === '0') return false;
    if (value === 1 || value === BigInt(1) || value === '1') return true;
    throw new Error(`Invalid boolean value for ${key}.`);
  }
  if (value === '' && NULLABLE_TEMPORAL_COLUMNS.has(key)) return null;
  if ((value === '' || value === null) && NON_NULL_TEMPORAL_COLUMNS.has(key)) {
    throw new Error(`Invalid empty non-null timestamp for ${key}.`);
  }
  if (TIMESTAMP_COLUMNS.has(key) && value !== null) {
    if (typeof value !== 'string') throw new Error(`Invalid timestamp value for ${key}.`);
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
      ? `${value.replace(' ', 'T')}Z`
      : value;
    if (Number.isNaN(Date.parse(normalized))) throw new Error(`Invalid timestamp value for ${key}.`);
    return normalized;
  }
  if (MONEY_COLUMNS.has(key) && value !== null) return formatNumeric18_2(value);
  if (JSON_COLUMNS.has(key) && value !== null) {
    if (typeof value !== 'string') throw new Error(`Invalid JSON value for ${key}.`);
    JSON.parse(value);
    return value;
  }
  return value;
}
