import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { getRequestSessionToken } from '../src/lib/request-session-token';

test('prefers a bearer token over the session cookie', () => {
  const request = new NextRequest('http://localhost/api/test', {
    headers: {
      authorization: 'Bearer bearer-token',
      cookie: 'session_token=cookie-token',
    },
  });
  assert.equal(getRequestSessionToken(request), 'bearer-token');
});

test('uses the HttpOnly session cookie when no bearer token is present', () => {
  const request = new NextRequest('http://localhost/api/test', {
    headers: { cookie: 'session_token=cookie-token' },
  });
  assert.equal(getRequestSessionToken(request), 'cookie-token');
});

test('rejects malformed or empty credentials', () => {
  assert.equal(
    getRequestSessionToken(
      new NextRequest('http://localhost/api/test', {
        headers: { authorization: 'Basic abc' },
      }),
    ),
    null,
  );
});
