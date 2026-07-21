import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySessionToken } from '../src/lib/session-verification';

test('keeps the optimistic session when verification is temporarily unavailable', async () => {
  const result = await verifySessionToken('token', {
    fetcher: async () => {
      throw new TypeError('temporary network failure');
    },
  });

  assert.equal(result.status, 'unavailable');
});

test('invalidates the session only when the server explicitly rejects it', async () => {
  const result = await verifySessionToken('token', {
    fetcher: async () =>
      Response.json({ success: false, error: '会话已失效' }, { status: 401 }),
  });

  assert.equal(result.status, 'invalid');
});

test('returns the verified user for a valid session', async () => {
  const result = await verifySessionToken('token', {
    fetcher: async () =>
      Response.json({
        success: true,
        data: { role: 'admin', name: '系统管理员', username: 'admin' },
      }),
  });

  assert.deepEqual(result, {
    status: 'valid',
    user: { role: 'admin', name: '系统管理员', username: 'admin' },
  });
});
