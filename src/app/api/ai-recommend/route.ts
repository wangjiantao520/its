import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateBody, validateQuery } from '@/lib/api-validate';

const listSchema = z.object({
  clientName: z.string().max(200).optional(),
  clientId: z.string().regex(/^[1-9]\d*$/).optional(),
  deviceName: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(5),
});
const deviceSchema = z.object({
  deviceName: z.string().optional(),
  name: z.string().optional(),
  useYears: z.coerce.number().int().min(0).max(100).optional(),
  useYear: z.coerce.number().int().min(0).max(100).optional(),
}).passthrough().refine((value) => Boolean(value.deviceName || value.name), { message: '设备名称不能为空' });
const saveSchema = z.object({
  quoteId: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive(), z.bigint().positive()]),
  quoteType: z.string().trim().min(1).max(50),
  clientId: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive(), z.bigint().positive()]).optional(),
  clientName: z.string().max(200).optional(),
  devices: z.array(deviceSchema).min(1).max(2_000),
  quoteTotal: z.coerce.number().finite().nonnegative().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
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
    } else if (parsed.data.deviceName) {
      values.push(`%${parsed.data.deviceName.toLowerCase()}%`);
      conditions.push(`device_signature LIKE $${values.length}`);
    }
    values.push(parsed.data.limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getDatabase().query<Record<string, unknown>>(`
      SELECT client_name, device_signature, device_data, quote_total, created_at, occurrence
      FROM (
        SELECT DISTINCT ON (device_signature)
               client_name, device_signature, device_data, quote_total, created_at,
               COUNT(*) OVER (PARTITION BY device_signature)::integer AS occurrence
        FROM quote_device_history
        ${where}
        ORDER BY device_signature, created_at DESC, id DESC
      ) ranked
      ORDER BY created_at DESC
      LIMIT $${values.length}
    `, values);
    return NextResponse.json({ success: true, data: result.rows.map(serializeAssistantRow) });
  } catch (error) {
    console.error('[AI Recommend] 查询失败:', error);
    return NextResponse.json({ success: false, error: '查询推荐失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, saveSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const value = parsed.data;
    await getDatabase().transaction(async (database) => {
      for (const device of value.devices) {
        const deviceName = device.deviceName || device.name || '其他';
        const useYears = device.useYears ?? device.useYear;
        const bucket = !useYears ? 'unknown' : useYears <= 1 ? 'new' : useYears <= 3 ? 'mid' : 'old';
        await database.query(`
          INSERT INTO quote_device_history
            (quote_id, quote_type, client_id, client_name, device_signature, device_data, quote_total)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
          RETURNING id
        `, [value.quoteId, value.quoteType, value.clientId ?? null, value.clientName ?? null, `${deviceName.toLowerCase()}::${bucket}`, JSON.stringify(device), value.quoteTotal ?? null]);
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI Recommend] 保存失败:', error);
    return NextResponse.json({ success: false, error: '保存推荐历史失败' }, { status: 500 });
  }
}
