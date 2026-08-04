import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { parsePositiveDatabaseId, serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateBody, validateQuery } from '@/lib/api-validate';

interface RouteContext { params: Promise<{ id: string }> }

const enabledSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);
const skillSchema = z.object({
  skill_name: z.string().trim().min(1).max(100),
  skill_type: z.string().trim().min(1).max(100),
  config_json: z.union([z.record(z.string(), z.unknown()), z.string()]).optional().default({}),
  enabled: enabledSchema.optional().default(true),
  priority: z.coerce.number().int().min(-10_000).max(10_000).optional().default(0),
});
const updateSkillSchema = skillSchema.extend({
  skill_id: z.union([z.string(), z.number(), z.bigint()]),
});
const deleteSkillSchema = z.object({ skill_id: z.string().regex(/^[1-9]\d*$/) });

function jsonValue(value: string | Record<string, unknown>): string {
  if (typeof value !== 'string') return JSON.stringify(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error('技能配置必须是 JSON 对象');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('技能配置必须是 JSON 对象');
  return JSON.stringify(parsed);
}

async function agentId(context: RouteContext): Promise<string | null> {
  return parsePositiveDatabaseId((await context.params).id);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await agentId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  try {
    const result = await getDatabase().query<Record<string, unknown>>(
      'SELECT * FROM agent_skills WHERE agent_id=$1 ORDER BY priority DESC, id ASC', [id],
    );
    return NextResponse.json({ success: true, data: result.rows.map(serializeAssistantRow) });
  } catch (error) {
    console.error('获取技能列表失败:', error);
    return NextResponse.json({ success: false, error: '获取技能列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await agentId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  const parsed = await validateBody(request, skillSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const agent = await getDatabase().query<{ id: string | number | bigint }>('SELECT id FROM agent_configs WHERE id=$1', [id]);
    if (!agent.rows[0]) return NextResponse.json({ success: false, error: '智能体不存在' }, { status: 404 });
    const value = parsed.data;
    const inserted = await getDatabase().query<Record<string, unknown>>(`
      INSERT INTO agent_skills (agent_id, skill_name, skill_type, config_json, enabled, priority)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      RETURNING *
    `, [id, value.skill_name, value.skill_type, jsonValue(value.config_json), value.enabled, value.priority]);
    return NextResponse.json({ success: true, data: serializeAssistantRow(inserted.rows[0]) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '添加技能失败';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('JSON') ? 400 : 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await agentId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  const parsed = await validateBody(request, updateSkillSchema);
  if (!parsed.ok) return parsed.response;
  const skillId = parsePositiveDatabaseId(parsed.data.skill_id);
  if (!skillId) return NextResponse.json({ success: false, error: '无效的技能ID' }, { status: 400 });
  try {
    const value = parsed.data;
    const updated = await getDatabase().query<Record<string, unknown>>(`
      UPDATE agent_skills
      SET skill_name=$1, skill_type=$2, config_json=$3::jsonb, enabled=$4, priority=$5
      WHERE id=$6 AND agent_id=$7
      RETURNING *
    `, [value.skill_name, value.skill_type, jsonValue(value.config_json), value.enabled, value.priority, skillId, id]);
    if (!updated.rows[0]) return NextResponse.json({ success: false, error: '技能不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: serializeAssistantRow(updated.rows[0]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新技能失败';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('JSON') ? 400 : 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const id = await agentId(context);
  if (!id) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  const parsed = validateQuery(request, deleteSkillSchema);
  if (!parsed.ok) return parsed.response;
  const deleted = await getDatabase().query<{ id: string | number | bigint }>(
    'DELETE FROM agent_skills WHERE id=$1 AND agent_id=$2 RETURNING id',
    [parsed.data.skill_id, id],
  );
  if (!deleted.rows[0]) return NextResponse.json({ success: false, error: '技能不存在' }, { status: 404 });
  return NextResponse.json({ success: true, data: { message: '技能删除成功' } });
}
