import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { authorizeRequest, type ApiSession } from '../src/lib/api-auth';

const request = new NextRequest('http://localhost/api/protected');

test('returns 401 when no valid session exists', async () => {
  const result = authorizeRequest(request, undefined, () => null);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 401);
  assert.deepEqual(await result.response.json(), { success: false, error: '未登录' });
});

test('returns 403 when the session role is not allowed', async () => {
  const member: ApiSession = { role: 'its_member', userId: 2 };
  const result = authorizeRequest(request, ['admin'], () => member);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 403);
  assert.deepEqual(await result.response.json(), { success: false, error: '权限不足' });
});

test('returns the session when its role is allowed', () => {
  const admin: ApiSession = { role: 'admin' };
  const result = authorizeRequest(request, ['admin'], () => admin);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.session, admin);
});
