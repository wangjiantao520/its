import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { serializeAssistantRow, serializeDatabaseId } from '@/lib/assistant-db';
import { getDatabase } from '@/lib/database/client';
import { validateBody, validateQuery } from '@/lib/api-validate';

const feedbackTypes = ['correct', 'wrong_match', 'missing_info', 'extra_info', 'wrong_quantity', 'other', 'partial'] as const;
const feedbackSchema = z.object({
  originalText: z.string().trim().min(1).max(100_000),
  aiResult: z.unknown().refine((value) => value !== null && value !== undefined, '缺少 AI 结果'),
  correctedResult: z.unknown().optional(),
  feedbackType: z.enum(feedbackTypes),
  feedbackComment: z.string().max(5_000).optional(),
  clientName: z.string().max(200).optional(),
  operator: z.string().max(200).optional(),
});
const listSchema = z.object({
  clientName: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, feedbackSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const value = parsed.data;
    const inserted = await getDatabase().query<{ id: string | number | bigint }>(`
      INSERT INTO ai_feedback
        (original_text, ai_result, corrected_result, feedback_type, feedback_comment, client_name, operator)
      VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7)
      RETURNING id
    `, [
      value.originalText,
      JSON.stringify(value.aiResult),
      value.correctedResult === undefined ? null : JSON.stringify(value.correctedResult),
      value.feedbackType,
      value.feedbackComment ?? null,
      value.clientName ?? null,
      value.operator ?? auth.session.name ?? auth.session.username ?? null,
    ]);
    return NextResponse.json({ success: true, id: serializeDatabaseId(inserted.rows[0]?.id) });
  } catch (error) {
    console.error('[AI Feedback] 保存失败:', error);
    return NextResponse.json({ success: false, error: '数据库暂时不可用，反馈已记录待重试' }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = validateQuery(request, listSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (parsed.data.clientName) {
      values.push(parsed.data.clientName);
      conditions.push(`client_name=$${values.length}`);
    }
    values.push(parsed.data.limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await getDatabase().query<Record<string, unknown>>(`
      SELECT * FROM ai_feedback ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${values.length}
    `, values);
    return NextResponse.json({ success: true, data: result.rows.map(serializeAssistantRow) });
  } catch (error) {
    console.error('[AI Feedback] 查询失败:', error);
    return NextResponse.json({ success: false, error: '查询反馈失败' }, { status: 500 });
  }
}
