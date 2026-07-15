import { NextRequest, NextResponse } from 'next/server';
import { updateUser, deleteUser } from '@/lib/auth';
import { requireApiAuth } from '@/lib/api-auth-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/users/[id] - 更新用户（仅管理员）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const auth = requireApiAuth(request, ['admin']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: '无效的用户ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, password, is_active } = body;

    if (password && password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少6位' }, { status: 400 });
    }

    const result = await updateUser(userId, { name, password, is_active });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - 删除用户（仅管理员）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const auth = requireApiAuth(request, ['admin']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: '无效的用户ID' }, { status: 400 });
    }

    const result = await deleteUser(userId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
  }
}
