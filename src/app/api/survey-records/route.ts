import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface SurveyRow extends Record<string, unknown> {
  id: string | number | bigint;
  user_id: string | number | bigint | null;
  survey_data: unknown;
  quote_result: unknown;
  contract_years: string | number;
  created_at: Date | string;
}

const surveyRecordSchema = z.object({
  survey_data: z.record(z.string(), z.unknown()),
  quote_result: z.record(z.string(), z.unknown()).optional().nullable(),
  contract_years: z.coerce.number().int().min(1).max(3).default(1),
});

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serialize(row: SurveyRow) {
  return {
    id: String(row.id),
    survey_data: typeof row.survey_data === 'string' ? JSON.parse(row.survey_data) : row.survey_data,
    quote_result: typeof row.quote_result === 'string' ? JSON.parse(row.quote_result) : row.quote_result,
    contract_years: Number(row.contract_years),
    created_at: toIso(row.created_at),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是有效的 JSON' }, { status: 400 });
  }
  const parsed = surveyRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: '数据格式无效' }, { status: 400 });
  }

  try {
    const database = getDatabase();
    const inserted = await database.query<{ id: string | number | bigint }>(`
      INSERT INTO survey_records (user_id, survey_data, quote_result, contract_years)
      VALUES ($1, $2::jsonb, $3::jsonb, $4) RETURNING id
    `, [
      auth.session.userId ?? null,
      JSON.stringify(parsed.data.survey_data),
      parsed.data.quote_result ? JSON.stringify(parsed.data.quote_result) : null,
      parsed.data.contract_years,
    ]);
    return NextResponse.json({
      success: true,
      message: '查勘记录已保存',
      data: { id: String(inserted.rows[0].id) },
    });
  } catch (error) {
    console.error('保存查勘记录失败:', error);
    return NextResponse.json({ success: false, error: '保存查勘记录失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await getDatabase().query<SurveyRow>(
      'SELECT * FROM survey_records ORDER BY created_at DESC, id DESC',
    );
    return NextResponse.json({ success: true, data: result.rows.map(serialize) });
  } catch (error) {
    console.error('获取查勘记录失败:', error);
    return NextResponse.json({ success: false, error: '获取查勘记录失败' }, { status: 500 });
  }
}
