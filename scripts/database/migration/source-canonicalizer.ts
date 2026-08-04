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

function canonicalizeSourceJsonNumber(token: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) throw new Error('SQLite source contains an invalid JSON number.');
  let digits = `${match[2]}${match[3] ?? ''}`.replace(/^0+/, '');
  if (digits === '') return 'number:0';
  let power = BigInt(match[4] ?? '0') - BigInt((match[3] ?? '').length);
  while (digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    power += BigInt(1);
  }
  return `number:${match[1]}${digits}e${power}`;
}

export function canonicalizeSourceJson(value: string): string {
  let index = 0;
  const skipWhitespace = (): void => {
    while (/[ \t\r\n]/.test(value[index] ?? '')) index += 1;
  };
  const parseString = (): string => {
    if (value[index] !== '"') throw new Error('SQLite source contains invalid JSON.');
    const start = index;
    index += 1;
    while (index < value.length) {
      const character = value[index];
      index += 1;
      if (character === '\\') {
        index += 1;
      } else if (character === '"') {
        const parsed = JSON.parse(value.slice(start, index)) as unknown;
        if (typeof parsed !== 'string') throw new Error('SQLite source contains invalid JSON.');
        return parsed;
      }
    }
    throw new Error('SQLite source contains invalid JSON.');
  };
  const parseValue = (): string => {
    skipWhitespace();
    const character = value[index];
    if (character === '"') return `string:${JSON.stringify(parseString())}`;
    if (character === '[') {
      index += 1;
      const items: string[] = [];
      skipWhitespace();
      if (value[index] === ']') {
        index += 1;
        return 'array:[]';
      }
      while (true) {
        items.push(parseValue());
        skipWhitespace();
        if (value[index] === ']') {
          index += 1;
          return `array:[${items.join(',')}]`;
        }
        if (value[index] !== ',') throw new Error('SQLite source contains invalid JSON.');
        index += 1;
      }
    }
    if (character === '{') {
      index += 1;
      const entries = new Map<string, string>();
      skipWhitespace();
      if (value[index] === '}') {
        index += 1;
        return 'object:{}';
      }
      while (true) {
        skipWhitespace();
        const key = parseString();
        skipWhitespace();
        if (value[index] !== ':') throw new Error('SQLite source contains invalid JSON.');
        index += 1;
        entries.set(key, parseValue());
        skipWhitespace();
        if (value[index] === '}') {
          index += 1;
          const ordered = [...entries].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
          return `object:{${ordered.map(([name, item]) => `${JSON.stringify(name)}:${item}`).join(',')}}`;
        }
        if (value[index] !== ',') throw new Error('SQLite source contains invalid JSON.');
        index += 1;
      }
    }
    for (const [literal, canonical] of [
      ['true', 'boolean:true'],
      ['false', 'boolean:false'],
      ['null', 'null'],
    ] as const) {
      if (value.startsWith(literal, index)) {
        index += literal.length;
        return canonical;
      }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(value.slice(index))?.[0];
    if (!number) throw new Error('SQLite source contains invalid JSON.');
    index += number.length;
    return canonicalizeSourceJsonNumber(number);
  };

  const canonical = parseValue();
  skipWhitespace();
  if (index !== value.length) throw new Error('SQLite source contains invalid JSON.');
  return canonical;
}
