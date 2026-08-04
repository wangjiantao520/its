import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { parsePositiveDatabaseId, serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateBody } from '@/lib/api-validate';

interface RouteContext { params: Promise<{ id: string }> }

const agentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  system_prompt: z.string().trim().min(1),
  model: z.string().trim().max(100).optional().default('doubao-seed-1-8-251228'),
  temperature: z.coerce.number().min(0).max(2).optional().default(0.7),
  enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean).optional().default(true),
});

async function routeId(context: RouteContext): Promise<string | null> {
  return parsePositiveDatabaseId((await context.params).id);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await routeId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  try {
    const result = await getDatabase().query<Record<string, unknown>>(
      'SELECT * FROM agent_configs WHERE id = $1', [id],
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: '智能体不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: serializeAssistantRow(result.rows[0]) });
  } catch (error) {
    console.error('获取智能体失败:', error);
    return NextResponse.json({ success: false, error: '获取智能体失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await routeId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  const parsed = await validateBody(request, agentSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const value = parsed.data;
    const result = await getDatabase().query<Record<string, unknown>>(`
      UPDATE agent_configs
      SET name=$1, description=$2, system_prompt=$3, model=$4, temperature=$5,
          enabled=$6, updated_at=now()
      WHERE id=$7
      RETURNING *
    `, [value.name, value.description, value.system_prompt, value.model, value.temperature, value.enabled, id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: '智能体不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: serializeAssistantRow(result.rows[0]) });
  } catch (error) {
    console.error('更新智能体失败:', error);
    return NextResponse.json({ success: false, error: '更新智能体失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await routeId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  try {
    const deleted = await getDatabase().transaction(async (database) => {
      const result = await database.query<{ id: DatabaseIdentifier }>(
        'DELETE FROM agent_configs WHERE id=$1 RETURNING id', [id],
      );
      return result.rows[0];
    });
    if (!deleted) return NextResponse.json({ success: false, error: '智能体不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: { message: '智能体删除成功' } });
  } catch (error) {
    console.error('删除智能体失败:', error);
    return NextResponse.json({ success: false, error: '删除智能体失败' }, { status: 500 });
  }
}

type DatabaseIdentifier = string | number | bigint;
