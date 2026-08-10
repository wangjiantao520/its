import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { ensureSecondaryPassword, setSecondaryPassword, verifySecondaryPassword } from '@/lib/secondary-password';
import { validateBody } from '@/lib/api-validate';

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const database = getDatabase();
  await ensureSecondaryPassword(database);
  const rows = await database.query<{ key: string }>(
    "SELECT key FROM system_settings WHERE key = 'secondary_password'",
  );
  return NextResponse.json({
    success: true,
    data: { configured: rows.rows.length > 0, defaultUsed: false },
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;
  const parsed = await validateBody(request, passwordSchema);
  if (!parsed.ok) return parsed.response;

  const database = getDatabase();
  await ensureSecondaryPassword(database);
  const ok = await verifySecondaryPassword(database, parsed.data.currentPassword);
  if (!ok) {
    return NextResponse.json({ success: false, error: '当前二级密码不正确' }, { status: 403 });
  }
  await setSecondaryPassword(database, parsed.data.newPassword);
  return NextResponse.json({ success: true, message: '二级密码已更新' });
}
