export type DatabaseIdentifier = string | number | bigint;

export function parsePositiveDatabaseId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return null;
  }
  const raw = String(value).trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  try {
    return BigInt(raw).toString();
  } catch {
    return null;
  }
}

export function serializeDatabaseId(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  const parsed = BigInt(String(value));
  if (parsed <= BigInt(Number.MAX_SAFE_INTEGER) && parsed >= BigInt(Number.MIN_SAFE_INTEGER)) {
    return Number(parsed);
  }
  return parsed.toString();
}

export function serializeTimestamp(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function serializeNumeric(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export function booleanFlag(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

export function serializeAssistantRow(row: Record<string, unknown>): Record<string, unknown> {
  const result = { ...row };
  for (const key of ['id', 'agent_id', 'user_id', 'client_id', 'quote_id']) {
    if (key in result) result[key] = serializeDatabaseId(result[key]);
  }
  for (const key of ['enabled', 'is_deleted']) {
    if (key in result) result[key] = booleanFlag(result[key]);
  }
  for (const key of ['created_at', 'updated_at', 'last_message_at', 'last_used_at']) {
    if (key in result) result[key] = serializeTimestamp(result[key]);
  }
  for (const key of ['config_json', 'actions_executed', 'ai_result', 'corrected_result', 'device_config', 'device_data', 'raw_data']) {
    if (key in result) result[key] = serializeJson(result[key]);
  }
  for (const key of ['temperature', 'quote_total', 'unit_price', 'city_price', 'year1_total_price', 'year2_total_price', 'year3_total_price']) {
    if (key in result) result[key] = serializeNumeric(result[key]);
  }
  return result;
}
