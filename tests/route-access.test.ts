import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedPath, isPublicPath } from '../src/lib/route-access';

test('allows public share links and login but not similarly named paths', () => {
  assert.equal(isPublicPath('/login'), true);
  assert.equal(isPublicPath('/share/abc123'), true);
  assert.equal(isPublicPath('/share'), false);
  assert.equal(isPublicPath('/login-admin'), false);
});

test('allows nested detail routes under an explicitly allowed section', () => {
  assert.equal(isAllowedPath('/quotes/engineering%3A1', ['/quotes']), true);
  assert.equal(isAllowedPath('/admin/users/1', ['/admin/users']), true);
  assert.equal(isAllowedPath('/admin/agents', ['/admin']), true);
  assert.equal(isAllowedPath('/database', ['/data']), false);
});
