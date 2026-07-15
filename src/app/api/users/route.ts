import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser, deleteUser, getUsers, updateUser } from '@/lib/auth';
import { requireApiAuth } from '@/lib/api-auth-server';

const createUserSchema = z.object({
  username: z.string().trim().min(2, '用户名至少2位').max(50),
  password: z.string().min(6, '密码至少6位').max(128),
  name: z.string().trim().min(1, '姓名不能为空').max(100),
});

const updateUserSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(6, '密码至少6位').max(128).optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
});

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { success: false, error: error.issues[0]?.message || '请求参数无效' },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ success: true, data: await getUsers() });
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const result = await createUser(
    parsed.data.username,
    parsed.data.password,
    parsed.data.name,
    auth.session.username || 'admin',
  );
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { id: result.userId } }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const { id, ...changes } = parsed.data;
  const result = await updateUser(id, changes);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, error: '无效的用户ID' }, { status: 400 });
  }

  const result = await deleteUser(id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
