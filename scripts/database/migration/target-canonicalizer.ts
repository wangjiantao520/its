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

function canonicalizeTargetJsonNumber(token: string): string {
  const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!parts) throw new Error('PostgreSQL returned an invalid JSON number.');
  let coefficient = `${parts[2]}${parts[3] ?? ''}`.replace(/^0+/, '');
  if (coefficient === '') return 'number:0';
  let decimalPower = BigInt(parts[4] ?? '0') - BigInt((parts[3] ?? '').length);
  const trailingZeroes = /0+$/.exec(coefficient)?.[0].length ?? 0;
  if (trailingZeroes > 0) {
    coefficient = coefficient.slice(0, -trailingZeroes);
    decimalPower += BigInt(trailingZeroes);
  }
  return `number:${parts[1]}${coefficient}e${decimalPower}`;
}

export function canonicalizeTargetJson(value: string): string {
  const cursor = { offset: 0 };
  const whitespace = (): void => {
    const match = /^[ \t\r\n]+/.exec(value.slice(cursor.offset));
    cursor.offset += match?.[0].length ?? 0;
  };
  const stringValue = (): string => {
    if (value[cursor.offset] !== '"') throw new Error('PostgreSQL returned invalid JSON.');
    const start = cursor.offset;
    cursor.offset += 1;
    let escaped = false;
    while (cursor.offset < value.length) {
      const character = value[cursor.offset];
      cursor.offset += 1;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        const decoded = JSON.parse(value.slice(start, cursor.offset)) as unknown;
        if (typeof decoded !== 'string') throw new Error('PostgreSQL returned invalid JSON.');
        return decoded;
      }
    }
    throw new Error('PostgreSQL returned invalid JSON.');
  };
  const item = (): string => {
    whitespace();
    if (value[cursor.offset] === '"') return `string:${JSON.stringify(stringValue())}`;
    if (value[cursor.offset] === '[') {
      cursor.offset += 1;
      const children: string[] = [];
      whitespace();
      if (value[cursor.offset] === ']') {
        cursor.offset += 1;
        return 'array:[]';
      }
      for (;;) {
        children.push(item());
        whitespace();
        if (value[cursor.offset] === ']') {
          cursor.offset += 1;
          return `array:[${children.join(',')}]`;
        }
        if (value[cursor.offset] !== ',') throw new Error('PostgreSQL returned invalid JSON.');
        cursor.offset += 1;
      }
    }
    if (value[cursor.offset] === '{') {
      cursor.offset += 1;
      const properties: Record<string, string> = Object.create(null) as Record<string, string>;
      whitespace();
      if (value[cursor.offset] === '}') {
        cursor.offset += 1;
        return 'object:{}';
      }
      for (;;) {
        whitespace();
        const name = stringValue();
        whitespace();
        if (value[cursor.offset] !== ':') throw new Error('PostgreSQL returned invalid JSON.');
        cursor.offset += 1;
        properties[name] = item();
        whitespace();
        if (value[cursor.offset] === '}') {
          cursor.offset += 1;
          const names = Object.keys(properties).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
          return `object:{${names.map((key) => `${JSON.stringify(key)}:${properties[key]}`).join(',')}}`;
        }
        if (value[cursor.offset] !== ',') throw new Error('PostgreSQL returned invalid JSON.');
        cursor.offset += 1;
      }
    }
    const remainder = value.slice(cursor.offset);
    for (const [literal, canonical] of [
      ['true', 'boolean:true'],
      ['false', 'boolean:false'],
      ['null', 'null'],
    ] as const) {
      if (remainder.startsWith(literal)) {
        cursor.offset += literal.length;
        return canonical;
      }
    }
    const numericToken = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(remainder)?.[0];
    if (!numericToken) throw new Error('PostgreSQL returned invalid JSON.');
    cursor.offset += numericToken.length;
    return canonicalizeTargetJsonNumber(numericToken);
  };

  const canonical = item();
  whitespace();
  if (cursor.offset !== value.length) throw new Error('PostgreSQL returned invalid JSON.');
  return canonical;
}
