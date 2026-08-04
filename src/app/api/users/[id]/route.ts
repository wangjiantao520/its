import { NextRequest, NextResponse } from 'next/server';
import { updateUser, deleteUser } from '@/lib/auth';
import { requireApiAuth } from '@/lib/api-auth-server';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const userIdSchema = z.coerce.number().int().positive('无效的用户ID');
const updateUserSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(100).optional(),
  password: z.string().min(6, '密码至少6位').max(128).optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
}).strict();

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { success: false, error: error.issues[0]?.message || '请求参数无效' },
    { status: 400 },
  );
}

// PUT /api/users/[id] - 更新用户（仅管理员）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // 验证管理员权限
    const auth = await requireApiAuth(request, ['admin']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success) return validationError(parsedId.error);
    const parsedBody = updateUserSchema.safeParse(await request.json());
    if (!parsedBody.success) return validationError(parsedBody.error);

    const result = await updateUser(parsedId.data, parsedBody.data);

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
    const auth = await requireApiAuth(request, ['admin']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success) return validationError(parsedId.error);

    const result = await deleteUser(parsedId.data);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
  }
}
