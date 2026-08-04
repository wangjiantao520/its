import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { validateBody, validateQuery } from '@/lib/api-validate';

function buildDeviceSignature(deviceName: string, useYears?: number): string {
  const normalized = deviceName.trim().toLowerCase();
  const ageBucket = !useYears ? 'unknown' : useYears <= 1 ? 'new' : useYears <= 3 ? 'mid' : 'old';
  return `${normalized}::${ageBucket}`;
}

const listSchema = z.object({
  clientId: z.string().regex(/^[1-9]\d*$/).optional(),
  clientName: z.string().max(200).optional(),
  deviceName: z.string().max(500).optional(),
  useYears: z.coerce.number().int().min(0).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(10),
});
const deviceConfigSchema = z.object({
  deviceName: z.string().trim().min(1).max(500),
  useYears: z.coerce.number().int().min(0).max(100).optional(),
}).passthrough();
const saveSchema = z.object({
  clientId: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive(), z.bigint().positive()]).optional(),
  clientName: z.string().trim().min(1).max(200),
  deviceName: z.string().trim().min(1).max(500).optional(),
  useYears: z.coerce.number().int().min(0).max(100).optional(),
  deviceConfig: z.record(z.string(), z.unknown()).optional(),
  deviceConfigs: z.array(deviceConfigSchema).min(1).max(500).optional(),
}).refine((value) => Boolean(value.deviceConfigs || (value.deviceName && value.deviceConfig)), {
  message: '缺少设备配置',
});

async function saveMemory(
  database: DatabaseClient,
  clientId: string | number | bigint | null,
  clientName: string,
  config: z.infer<typeof deviceConfigSchema>,
): Promise<'updated' | 'inserted'> {
  const signature = buildDeviceSignature(config.deviceName, config.useYears);
  const lockKey = `${clientId ?? 'null'}:${signature}`;
  await database.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  const existing = await database.query<{ id: string | number | bigint }>(`
    SELECT id FROM ai_learning_memory
    WHERE client_id IS NOT DISTINCT FROM $1 AND device_signature=$2
    ORDER BY id DESC LIMIT 1 FOR UPDATE
  `, [clientId, signature]);
  if (existing.rows[0]) {
    await database.query(`
      UPDATE ai_learning_memory
      SET usage_count=usage_count+1, last_used_at=now(), device_config=$1::jsonb,
          client_name=$2, device_name=$3, use_years=$4
      WHERE id=$5 RETURNING id
    `, [JSON.stringify(config), clientName, config.deviceName, config.useYears ?? null, existing.rows[0].id]);
    return 'updated';
  }
  await database.query(`
    INSERT INTO ai_learning_memory
      (client_id, client_name, device_signature, device_name, use_years, device_config)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING id
  `, [clientId, clientName, signature, config.deviceName, config.useYears ?? null, JSON.stringify(config)]);
  return 'inserted';
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = validateQuery(request, listSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (parsed.data.clientId) {
      values.push(parsed.data.clientId);
      conditions.push(`client_id=$${values.length}`);
    } else if (parsed.data.clientName) {
      values.push(parsed.data.clientName);
      conditions.push(`client_name=$${values.length}`);
    }
    if (parsed.data.deviceName) {
      values.push(buildDeviceSignature(parsed.data.deviceName, parsed.data.useYears));
      conditions.push(`device_signature=$${values.length}`);
    }
    values.push(parsed.data.limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getDatabase().query<Record<string, unknown>>(`
      SELECT * FROM ai_learning_memory ${where}
      ORDER BY last_used_at DESC, id DESC LIMIT $${values.length}
    `, values);
    return NextResponse.json({ success: true, data: result.rows.map(serializeAssistantRow) });
  } catch (error) {
    console.error('[AI Learning] 查询失败:', error);
    return NextResponse.json({ success: false, error: '查询学习记忆失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, saveSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const value = parsed.data;
    const configs = value.deviceConfigs ?? [{ deviceName: value.deviceName ?? '', useYears: value.useYears, ...value.deviceConfig }];
    const results = await getDatabase().transaction(async (database) => {
      const saved: Array<{ deviceName: string; action: 'updated' | 'inserted' }> = [];
      for (const config of configs) {
        saved.push({
          deviceName: config.deviceName,
          action: await saveMemory(database, value.clientId ?? null, value.clientName, config),
        });
      }
      return saved;
    });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[AI Learning] 保存失败:', error);
    return NextResponse.json({ success: false, error: '保存学习记忆失败' }, { status: 500 });
  }
}
