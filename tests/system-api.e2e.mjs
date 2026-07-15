import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const port = 5056;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = `/tmp/its-system-e2e-${process.pid}.db`;
let server;
let serverOutput = '';

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for server.\n${serverOutput}`);
}

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, json: text ? JSON.parse(text) : null };
}

async function login(body) {
  const result = await api('/api/auth', { method: 'POST', body });
  assert.equal(result.response.status, 200);
  assert.equal(result.json.success, true);
  return result.json.data.token;
}

async function chat(agentId, token, body) {
  const response = await fetch(`${baseUrl}/api/agents/${agentId}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { response, text: await response.text() };
}

test.before(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      DB_PATH: databasePath,
      ADMIN_PASSWORD: 'admin123',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await waitForServer();
});

test.after(async () => {
  if (server?.pid && server.exitCode === null) process.kill(-server.pid, 'SIGTERM');
  for (const suffix of ['', '-wal', '-shm', '.migrate.lock']) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
  rmSync('/tmp/backups', { recursive: true, force: true });
});

test('authentication, roles, ownership, sharing and validation work end to end', async () => {
  for (const path of ['/api/users', '/api/quotes', '/api/agent-sessions', '/api/dashboard/stats']) {
    const result = await api(path);
    assert.equal(result.response.status, 401, `${path} must reject anonymous access`);
    assert.equal(result.json.success, false);
  }

  const adminToken = await login({ role: 'admin', password: 'admin123' });
  const invalidUser = await api('/api/users', {
    token: adminToken,
    method: 'POST',
    body: { username: 'x', password: '123', name: '' },
  });
  assert.equal(invalidUser.response.status, 400);

  const userIds = new Map();
  for (const [username, name] of [['member_a', '成员A'], ['member_b', '成员B']]) {
    const created = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { username, password: 'member123', name },
    });
    assert.equal(created.response.status, 201);
    userIds.set(username, Number(created.json.data.id));
  }

  const memberAToken = await login({ username: 'member_a', password: 'member123' });
  const memberBToken = await login({ username: 'member_b', password: 'member123' });
  const forbiddenUsers = await api('/api/users', { token: memberAToken });
  assert.equal(forbiddenUsers.response.status, 403);

  for (const path of ['/api/dashboard', '/api/engineering-quotes/stats', '/api/agents']) {
    const result = await api(path, { token: adminToken });
    assert.equal(result.response.status, 200, `${path} should be SQLite-compatible`);
    assert.equal(result.json.success, true);
  }

  const invalidEngineering = await api('/api/engineering-quotes', {
    token: memberAToken,
    method: 'POST',
    body: { projectName: '' },
  });
  assert.equal(invalidEngineering.response.status, 400);
  const engineering = await api('/api/engineering-quotes', {
    token: memberAToken,
    method: 'POST',
    body: {
      quoteNumber: `E2E-${Date.now()}`,
      projectName: '工程权限测试',
      clientName: '测试客户',
      constructionArea: 10,
      managementRate: 0.08,
      profitRate: 0.1,
      regulatoryRate: 0.01,
      taxRate: 0.13,
      subtotal: 1000,
      managementFee: 80,
      profit: 100,
      regulatoryFee: 10,
      tax: 154.7,
      total: 1344.7,
      items: [],
    },
  });
  assert.equal(engineering.response.status, 200);
  const engineeringId = Number(engineering.json.data.id);
  const leakedEngineering = await api(`/api/engineering-quotes/${engineeringId}`, { token: memberBToken });
  assert.equal(leakedEngineering.response.status, 404);
  const leakedBatch = await api('/api/engineering-quotes/batch-export', {
    token: memberBToken,
    method: 'POST',
    body: { ids: [engineeringId] },
  });
  assert.equal(leakedBatch.response.status, 200);
  assert.deepEqual(leakedBatch.json.data, []);

  const createdQuote = await api('/api/quotations', {
    token: memberAToken,
    method: 'POST',
    body: {
      client_name: '集成测试客户',
      project_name: '权限回归项目',
      total_amount: 12345.67,
      device_count: 1,
      quote_data: { clientName: '集成测试客户', projectName: '权限回归项目', total: 12345.67 },
      devices: [{ name: '测试设备', quantity: 1, unit_price: 12345.67, total_price: 12345.67 }],
    },
  });
  assert.equal(createdQuote.response.status, 201);
  const quoteId = Number(createdQuote.json.data.id);
  assert.ok(quoteId > 0);

  const beforeInvalid = await api('/api/quotations', { token: memberAToken });
  const invalidQuotation = await api('/api/quotations', {
    token: memberAToken,
    method: 'POST',
    body: {
      client_name: '不应保存的客户',
      total_amount: 100,
      devices: [
        { name: '有效设备', quantity: 1, unit_price: 100 },
        { name: '', quantity: -1, unit_price: '无效金额' },
      ],
    },
  });
  assert.equal(invalidQuotation.response.status, 400);
  const afterInvalid = await api('/api/quotations', { token: memberAToken });
  assert.equal(afterInvalid.json.data.total, beforeInvalid.json.data.total);

  const ownDetail = await api(`/api/quotations/${quoteId}`, { token: memberAToken });
  assert.equal(ownDetail.response.status, 200);
  assert.equal(ownDetail.json.data.client_name, '集成测试客户');

  for (const method of ['GET', 'DELETE']) {
    const otherAccess = await api(`/api/quotations/${quoteId}`, { token: memberBToken, method });
    assert.equal(otherAccess.response.status, 403);
  }

  const otherVersions = await api(`/api/quotes/versions?quoteId=${quoteId}&quoteType=quotation`, { token: memberBToken });
  assert.equal(otherVersions.response.status, 404);
  const otherShare = await api('/api/quotes/share', {
    token: memberBToken,
    method: 'POST',
    body: { quoteId: `quotation:${quoteId}` },
  });
  assert.equal(otherShare.response.status, 404);

  const version = await api('/api/quotes/versions', {
    token: memberAToken,
    method: 'POST',
    body: {
      quoteId,
      quoteType: 'quotation',
      quoteData: { clientName: '集成测试客户', projectName: '权限回归项目', total: 12345.67 },
    },
  });
  assert.equal(version.response.status, 200);
  assert.ok(Number(version.json.data.versionId) > 0);

  const concurrentVersions = await Promise.all([
    api('/api/quotes/versions', {
      token: memberAToken,
      method: 'POST',
      body: { quoteId, quoteType: 'quotation', quoteData: { clientName: '并发版本A', total: 12346 } },
    }),
    api('/api/quotes/versions', {
      token: memberAToken,
      method: 'POST',
      body: { quoteId, quoteType: 'quotation', quoteData: { clientName: '并发版本B', total: 12347 } },
    }),
  ]);
  assert.deepEqual(concurrentVersions.map(result => result.response.status), [200, 200]);
  assert.equal(new Set(concurrentVersions.map(result => result.json.data.version)).size, 2);

  const share = await api('/api/quotes/share', {
    token: memberAToken,
    method: 'POST',
    body: { quoteId: `quotation:${quoteId}`, expiryDays: 1, maxViews: 1 },
  });
  assert.equal(share.response.status, 200);
  const publicShare = await api(`/api/share/${share.json.data.token}`);
  assert.equal(publicShare.response.status, 200);
  assert.equal(publicShare.json.success, true);
  const exhaustedShare = await api(`/api/share/${share.json.data.token}`);
  assert.equal(exhaustedShare.response.status, 410);
  assert.equal(exhaustedShare.json.success, false);

  const firstChat = await chat(1, memberAToken, { message: '系统功能介绍' });
  assert.equal(firstChat.response.status, 200);
  const startEvent = firstChat.text
    .split('\n')
    .find(line => line.startsWith('data: ') && line.includes('"type":"start"'));
  assert.ok(startEvent);
  const sessionId = JSON.parse(startEvent.slice(6)).session_id;
  const secondAgent = await api('/api/agents', {
    token: adminToken,
    method: 'POST',
    body: {
      name: `会话隔离智能体-${Date.now()}`,
      system_prompt: '仅用于验证会话归属。',
      enabled: 1,
    },
  });
  assert.equal(secondAgent.response.status, 201);
  const wrongAgentChat = await chat(secondAgent.json.data.id, memberAToken, {
    message: '继续上一个会话',
    session_id: sessionId,
  });
  assert.equal(wrongAgentChat.response.status, 409);
  assert.match(wrongAgentChat.text, /不属于当前智能体/);

  const disabledUser = await api('/api/users', {
    token: adminToken,
    method: 'PUT',
    body: { id: userIds.get('member_b'), is_active: 0 },
  });
  assert.equal(disabledUser.response.status, 200);
  assert.equal((await api('/api/quotes', { token: memberBToken })).response.status, 401);
  await api('/api/users', {
    token: adminToken,
    method: 'PUT',
    body: { id: userIds.get('member_b'), is_active: 1 },
  });
  const reactivatedBToken = await login({ username: 'member_b', password: 'member123' });
  const deletedUser = await api(`/api/users?id=${userIds.get('member_b')}`, {
    token: adminToken,
    method: 'DELETE',
  });
  assert.equal(deletedUser.response.status, 200);
  assert.equal((await api('/api/quotes', { token: reactivatedBToken })).response.status, 401);

  const logout = await api('/api/auth', { token: memberAToken, method: 'DELETE' });
  assert.equal(logout.response.status, 200);
  const revoked = await api('/api/quotes', { token: memberAToken });
  assert.equal(revoked.response.status, 401);
});
