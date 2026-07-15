import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// POST /api/ai-models/[id]/default - 设置默认模型
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  
  try {
    // 先将所有模型的is_default设为0
    await pool.execute('UPDATE ai_model_configs SET is_default = 0');
    
    // 将指定模型设为默认
    await pool.execute('UPDATE ai_model_configs SET is_default = 1 WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true, data: { message: '已设为默认模型' } });
  } catch (error) {
    console.error('设置默认模型失败:', error);
    return NextResponse.json(
      { success: false, error: '设置默认模型失败' },
      { status: 500 }
    );
  }
}
