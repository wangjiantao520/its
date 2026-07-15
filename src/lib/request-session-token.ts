import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'session_token';

export function getRequestSessionToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}
