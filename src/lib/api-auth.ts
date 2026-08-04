import { NextRequest, NextResponse } from 'next/server';

export interface ApiSession {
  role: string;
  userId?: number;
  username?: string;
  name?: string;
}

export type SessionResolver = (request: NextRequest) => Promise<ApiSession | null>;

export type AuthorizationResult =
  | { ok: true; session: ApiSession }
  | { ok: false; response: NextResponse };

export async function authorizeRequest(
  request: NextRequest,
  allowedRoles: readonly string[] | undefined,
  resolveSession: SessionResolver,
): Promise<AuthorizationResult> {
  const session = await resolveSession(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: '未登录' }, { status: 401 }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: '权限不足' }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
