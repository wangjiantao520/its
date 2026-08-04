import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { parsePositiveDatabaseId, serializeAssistantRow } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateBody, validateQuery } from '@/lib/api-validate';

const listSchema = z.object({ agent_id: z.string().regex(/^[1-9]\d*$/).optional() });
const createSchema = z.object({
  agent_id: z.union([z.string(), z.number(), z.bigint()]).optional().default(1),
  title: z.string().trim().max(100).optional().default('新会话'),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const parsed = validateQuery(request, listSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const values: unknown[] = [];
    const conditions = ['is_deleted=false'];
    if (auth.session.role !== 'admin') {
      if (!auth.session.userId) return NextResponse.json({ success: true, data: { list: [] } });
      if (auth.session.userId > 0) {
        values.push(auth.session.userId);
        conditions.push(`user_id=$${values.length}`);
      } else {
        values.push(auth.session.username || auth.session.name || '');
        conditions.push(`user_id IS NULL AND user_name=$${values.length}`);
      }
    }
    if (parsed.data.agent_id) {
      values.push(parsed.data.agent_id);
      conditions.push(`agent_id=$${values.length}`);
    }
    const result = await getDatabase().query<Record<string, unknown>>(`
      SELECT session_id, title, last_message, agent_id, created_at, updated_at
      FROM agent_sessions
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC, id DESC
    `, values);
    return NextResponse.json({
      success: true,
      data: { list: result.rows.map((row) => serializeAssistantRow({ ...row, last_message: row.last_message ?? '' })) },
    });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json({ success: false, error: '获取会话列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, createSchema);
  if (!parsed.ok) return parsed.response;
  const agentId = parsePositiveDatabaseId(parsed.data.agent_id);
  if (!agentId) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  try {
    const database = getDatabase();
    const agent = await database.query<{ id: string | number | bigint }>(
      'SELECT id FROM agent_configs WHERE id=$1 AND enabled=true', [agentId],
    );
    if (!agent.rows[0]) return NextResponse.json({ success: false, error: '智能体不存在或未启用' }, { status: 404 });
    const sessionId = `sess_${crypto.randomUUID()}`;
    const title = parsed.data.title || '新会话';
    const databaseUserId = auth.session.userId && auth.session.userId > 0 ? auth.session.userId : null;
    const ownerName = databaseUserId === null
      ? auth.session.username || auth.session.name || ''
      : auth.session.name || auth.session.username || '';
    await database.query(`
      INSERT INTO agent_sessions
        (session_id, user_id, user_name, agent_id, title, is_deleted, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, false, now(), now())
      RETURNING session_id
    `, [sessionId, databaseUserId, ownerName, agentId, title]);
    return NextResponse.json({ success: true, data: { session_id: sessionId, title } }, { status: 201 });
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json({ success: false, error: '创建会话失败' }, { status: 500 });
  }
}
