import type { NextRequest } from 'next/server';
import { authorizeRequest } from './api-auth';
import { verifySession } from './auth';

export function requireApiAuth(
  request: NextRequest,
  allowedRoles?: readonly string[],
) {
  return authorizeRequest(request, allowedRoles, verifySession);
}
