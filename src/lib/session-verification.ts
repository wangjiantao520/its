import { readApiResponse } from '@/lib/api-response';
import type { UserRole } from '@/lib/roles';

interface VerifiedSessionUser {
  role: UserRole;
  name?: string;
  username?: string;
}

export type SessionVerificationResult =
  | { status: 'valid'; user: VerifiedSessionUser }
  | { status: 'invalid' }
  | { status: 'unavailable'; error: unknown };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface VerifySessionOptions {
  fetcher?: Fetcher;
  timeoutMs?: number;
}

export async function verifySessionToken(
  token: string,
  { fetcher = fetch, timeoutMs = 10_000 }: VerifySessionOptions = {},
): Promise<SessionVerificationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher('/api/auth', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const result = await readApiResponse<VerifiedSessionUser>(response);

    if (response.status === 401 || response.status === 403) {
      return { status: 'invalid' };
    }
    if (!response.ok || !result.success || !result.data) {
      return { status: 'unavailable', error: result.error || '会话验证服务暂时不可用' };
    }

    return { status: 'valid', user: result.data };
  } catch (error) {
    return { status: 'unavailable', error };
  } finally {
    clearTimeout(timeoutId);
  }
}
