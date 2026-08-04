import type { NextRequest } from 'next/server';
import { authorizeRequest } from './api-auth';
import { verifySession } from './auth';

export async function requireApiAuth(
  request: NextRequest,
  allowedRoles?: readonly string[],
) {
  return await authorizeRequest(request, allowedRoles, verifySession);
}
