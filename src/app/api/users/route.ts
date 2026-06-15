import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUsers, createUser } from '@/lib/auth';

// GET /api/users - 获取用户列表（仅管理员）
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = verifySession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const users = await getUsers();

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

// POST /api/users - 创建用户（仅管理员）
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = verifySession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, name } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: '用户名和密码不能为空' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少6位' }, { status: 400 });
    }

    const result = await createUser(username, password, name || username, session.username || 'admin');

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: result.userId } });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
  }
}
