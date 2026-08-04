import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateBody } from '@/lib/api-validate';

const enabledSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);
const agentSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(100),
  description: z.string().max(500).optional().default(''),
  system_prompt: z.string().trim().min(1, '系统提示词不能为空'),
  model: z.string().trim().max(100).optional().default('doubao-seed-1-8-251228'),
  temperature: z.coerce.number().min(0).max(2).optional().default(0.7),
  enabled: enabledSchema.optional().default(true),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const result = await getDatabase().query<Record<string, unknown>>(
      'SELECT * FROM agent_configs ORDER BY created_at DESC, id DESC',
    );
    return NextResponse.json({ success: true, data: result.rows.map(serializeAssistantRow) });
  } catch (error) {
    console.error('获取智能体列表失败:', error);
    return NextResponse.json({ success: false, error: '获取智能体列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, agentSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const { name, description, system_prompt, model, temperature, enabled } = parsed.data;
    const inserted = await getDatabase().query<Record<string, unknown>>(`
      INSERT INTO agent_configs (name, description, system_prompt, model, temperature, enabled)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, system_prompt, model, temperature, enabled]);
    return NextResponse.json({ success: true, data: serializeAssistantRow(inserted.rows[0]) }, { status: 201 });
  } catch (error) {
    console.error('创建智能体失败:', error);
    return NextResponse.json({ success: false, error: '创建智能体失败' }, { status: 500 });
  }
}
