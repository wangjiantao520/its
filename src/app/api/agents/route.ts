import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';
import { validateBody } from '@/lib/api-validate';
import { z } from 'zod';

const agentSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  description: z.string().max(500).optional().default(''),
  system_prompt: z.string().min(1, '系统提示词不能为空'),
  model: z.string().max(100).optional().default('doubao-seed-1-8-251228'),
  temperature: z.coerce.number().min(0).max(2).optional().default(0.7),
  enabled: z.coerce.number().int().min(0).max(1).optional().default(1),
});

// GET /api/agents - 获取智能体列表
export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM agent_configs ORDER BY created_at DESC'
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取智能体列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取智能体列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/agents - 创建智能体
export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const parsed = await validateBody(request, agentSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { name, description, system_prompt, model, temperature, enabled } = parsed.data;

    const [result] = await pool.execute(
      `INSERT INTO agent_configs (name, description, system_prompt, model, temperature, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, system_prompt, model, temperature, enabled]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: Number((result as { insertId?: number | bigint }).insertId),
        message: '智能体创建成功',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('创建智能体失败:', error);
    return NextResponse.json(
      { success: false, error: '创建智能体失败' },
      { status: 500 }
    );
  }
}

// PUT 和 DELETE 已迁移到 /api/agents/[id]/route.ts（RESTful 路径参数）
