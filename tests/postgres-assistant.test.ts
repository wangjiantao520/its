import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import * as agentRoutes from '../src/app/api/agents/route';
import * as agentDetailRoutes from '../src/app/api/agents/[id]/route';
import * as skillRoutes from '../src/app/api/agents/[id]/skills/route';
import * as chatRoutes from '../src/app/api/agents/[id]/chat/route';
import * as logRoutes from '../src/app/api/agent-logs/route';
import * as sessionRoutes from '../src/app/api/agent-sessions/route';
import * as sessionDetailRoutes from '../src/app/api/agent-sessions/[sessionId]/route';
import * as feedbackRoutes from '../src/app/api/ai-feedback/route';
import * as learningRoutes from '../src/app/api/ai-learning/route';
import * as recommendRoutes from '../src/app/api/ai-recommend/route';
import * as matchRoutes from '../src/app/api/ai-match-devices/route';
import { hashAuthToken, saveSession } from '../src/lib/auth-session-store';
import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';
import { createPostgresTestHarness, POSTGRES_TEST_SKIP_REASON } from './helpers/postgres';

const SCOPED_DIRECTORIES = [
  'src/app/api/agents',
  'src/app/api/agent-logs',
  'src/app/api/agent-sessions',
  'src/app/api/ai-feedback',
  'src/app/api/ai-learning',
  'src/app/api/ai-match-devices',
  'src/app/api/ai-recommend',
] as const;

function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(file);
    return entry.name.endsWith('.ts') ? [file] : [];
  });
}

test('assistant routes use only the asynchronous PostgreSQL client contract', () => {
  const violations: string[] = [];
  for (const file of SCOPED_DIRECTORIES.flatMap(routeFiles)) {
    const source = fs.readFileSync(file, 'utf8');
    if (/from ['"]@\/lib\/db['"]/.test(source)) violations.push(`${file}: SQLite import`);
    if (/\.prepare\s*\(|\.getConnection\s*\(|pool\.execute\s*\(/.test(source)) {
      violations.push(`${file}: synchronous or compatibility database API`);
    }
    if (source.split('\n').some((line) => /(?:SELECT|INSERT|UPDATE|DELETE|VALUES).*\?/.test(line))) {
      violations.push(`${file}: question-mark SQL placeholder`);
    }
  }

  assert.deepEqual(violations, []);
});

test('assistant API keeps history, delete, recommendation and log UI contracts visible', () => {
  const assistant = fs.readFileSync('src/app/assistant/page.tsx', 'utf8');
  const adminAgents = fs.readFileSync('src/app/admin/agents/page.tsx', 'utf8');
  const aiHook = fs.readFileSync('src/hooks/use-ai-assistant.ts', 'utf8');

  assert.match(assistant, /data:\s*\{\s*list:\s*Session\[\]/);
  assert.match(assistant, /method:\s*["']DELETE["']/);
  assert.match(adminAgents, /\/api\/agent-logs\?agent_id=/);
  assert.match(aiHook, /\/api\/ai-recommend\?/);
  assert.match(aiHook, /\/api\/ai-feedback/);
});

class AssistantRouteDatabase implements DatabaseClient {
  readonly auth = new Map([
    [hashAuthToken('admin-token'), { role: 'admin', user_id: null, username: null, name: '管理员', expires_at: Date.now() + 60_000 }],
    [hashAuthToken('member-a-token'), { role: 'its_member', user_id: 11, username: 'member-a', name: '成员甲', expires_at: Date.now() + 60_000 }],
    [hashAuthToken('member-b-token'), { role: 'its_member', user_id: 22, username: 'member-b', name: '成员乙', expires_at: Date.now() + 60_000 }],
    [hashAuthToken('demo-token'), { role: 'its_member', user_id: null, username: 'demo', name: '演示用户', expires_at: Date.now() + 60_000 }],
  ]);
  readonly agents: Array<Record<string, unknown>> = [{ id: '1', name: 'ITS助手', description: '', system_prompt: '帮助用户', model: 'mock', temperature: 0.3, enabled: true, created_at: new Date() }];
  readonly skills: Array<Record<string, unknown>> = [];
  readonly sessions: Array<Record<string, unknown>> = [];
  readonly logs: Array<Record<string, unknown>> = [];
  readonly feedback: Array<Record<string, unknown>> = [];
  readonly learning: Array<Record<string, unknown>> = [];
  readonly history: Array<Record<string, unknown>> = [];
  transactionCount = 0;

  private result<Row extends Record<string, unknown>>(rows: Array<Record<string, unknown>> = [], rowCount = rows.length): QueryResult<Row> {
    return { rows: rows as Row[], rowCount };
  }

  async query<Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []): Promise<QueryResult<Row>> {
    const sql = text.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('DELETE FROM auth_sessions WHERE expires_at')) return this.result();
    if (sql.startsWith('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      const session = this.auth.get(String(params[0])); return this.result(session ? [session] : []);
    }
    if (sql.startsWith('UPDATE auth_sessions SET last_seen_at')) return this.result([], 1);
    if (sql.startsWith('SELECT is_active FROM users')) return this.result([{ is_active: true }]);
    if (sql.startsWith('SELECT id, name FROM users WHERE username')) {
      return this.result([{ id: '42', name: '演示用户' }]);
    }
    if (sql.startsWith('SELECT * FROM agent_configs ORDER BY')) return this.result([...this.agents].reverse());
    if (sql.startsWith('SELECT * FROM agent_configs WHERE id')) return this.result(this.agents.filter((agent) => String(agent.id) === String(params[0])));
    if (sql.startsWith('SELECT id FROM agent_configs WHERE id')) {
      return this.result(this.agents.filter((agent) => String(agent.id) === String(params[0]) && (!sql.includes('enabled=true') || agent.enabled === true)).map(({ id }) => ({ id })));
    }
    if (sql.startsWith('INSERT INTO agent_configs')) {
      const agent = { id: String(this.agents.length + 1), name: params[0], description: params[1], system_prompt: params[2], model: params[3], temperature: params[4], enabled: params[5], created_at: new Date() };
      this.agents.push(agent); return this.result([agent], 1);
    }
    if (sql.startsWith('UPDATE agent_configs')) {
      const agent = this.agents.find((row) => String(row.id) === String(params[6]));
      if (!agent) return this.result();
      Object.assign(agent, { name: params[0], description: params[1], system_prompt: params[2], model: params[3], temperature: params[4], enabled: params[5] });
      return this.result([agent], 1);
    }
    if (sql.startsWith('DELETE FROM agent_configs')) {
      const index = this.agents.findIndex((row) => String(row.id) === String(params[0]));
      if (index < 0) return this.result(); const [agent] = this.agents.splice(index, 1); return this.result([{ id: agent.id }], 1);
    }
    if (sql.startsWith('SELECT * FROM agent_skills')) return this.result(this.skills.filter((skill) => String(skill.agent_id) === String(params[0])));
    if (sql.startsWith('SELECT skill_name FROM agent_skills')) return this.result(this.skills.filter((skill) => String(skill.agent_id) === String(params[0]) && skill.enabled === true));
    if (sql.startsWith('INSERT INTO agent_skills')) {
      const skill = { id: String(this.skills.length + 1), agent_id: params[0], skill_name: params[1], skill_type: params[2], config_json: JSON.parse(String(params[3])), enabled: params[4], priority: params[5] };
      this.skills.push(skill); return this.result([skill], 1);
    }
    if (sql.startsWith('UPDATE agent_skills')) {
      const skill = this.skills.find((row) => String(row.id) === String(params[5]) && String(row.agent_id) === String(params[6]));
      if (!skill) return this.result(); Object.assign(skill, { skill_name: params[0], skill_type: params[1], config_json: JSON.parse(String(params[2])), enabled: params[3], priority: params[4] }); return this.result([skill], 1);
    }
    if (sql.startsWith('DELETE FROM agent_skills')) {
      const index = this.skills.findIndex((row) => String(row.id) === String(params[0]) && String(row.agent_id) === String(params[1]));
      if (index < 0) return this.result(); const [skill] = this.skills.splice(index, 1); return this.result([{ id: skill.id }], 1);
    }
    if (sql.startsWith('SELECT session_id, title, last_message, agent_id')) {
      const owner = sql.includes('user_id=$1') ? String(params[0]) : null;
      return this.result(this.sessions.filter((session) => session.is_deleted === false && (!owner || String(session.user_id) === owner)));
    }
    if (sql.startsWith('SELECT session_id, user_id, user_name, agent_id, title, created_at')) {
      return this.result(this.sessions.filter((session) => session.session_id === params[0] && session.is_deleted === false));
    }
    if (sql.startsWith('SELECT user_id, user_name, agent_id FROM agent_sessions')) {
      return this.result(this.sessions.filter((session) => session.session_id === params[0] && session.is_deleted === false).map(({ user_id, user_name, agent_id }) => ({ user_id, user_name, agent_id })));
    }
    if (sql.startsWith('INSERT INTO agent_sessions')) {
      const insertedUserId = sql.includes('last_message, message_count') ? params[2] : params[1];
      if (typeof insertedUserId === 'number' && insertedUserId < 0) {
        throw Object.assign(new Error('foreign key violation'), { code: '23503' });
      }
      const session = sql.includes('last_message, message_count')
        ? { session_id: params[0], agent_id: params[1], user_id: params[2], user_name: params[3], title: params[4], last_message: params[5], message_count: 1, is_deleted: false, created_at: new Date(), updated_at: new Date() }
        : { session_id: params[0], user_id: params[1], user_name: params[2], agent_id: params[3], title: params[4], last_message: '', message_count: 0, is_deleted: false, created_at: new Date(), updated_at: new Date() };
      this.sessions.push(session); return this.result([{ session_id: session.session_id }], 1);
    }
    if (sql.startsWith('UPDATE agent_sessions SET title')) {
      const session = this.sessions.find((row) => row.session_id === params[1]); if (!session) return this.result(); session.title = params[0]; return this.result([{ session_id: session.session_id }], 1);
    }
    if (sql.startsWith('UPDATE agent_sessions SET is_deleted')) {
      const session = this.sessions.find((row) => row.session_id === params[0]); if (!session) return this.result(); session.is_deleted = true; return this.result([{ session_id: session.session_id }], 1);
    }
    if (sql.startsWith('UPDATE agent_sessions SET last_message')) {
      const session = this.sessions.find((row) => row.session_id === params[1]); if (!session) return this.result(); session.last_message = params[0]; session.message_count = Number(session.message_count) + 1; return this.result([{ session_id: session.session_id }], 1);
    }
    if (sql.startsWith('INSERT INTO agent_logs')) {
      const log = { id: String(this.logs.length + 1), user_id: params[0], agent_id: params[1], session_id: params[2], user_message: params[3], agent_response: params[4], actions_executed: JSON.parse(String(params[5])), created_at: new Date() };
      this.logs.push(log); return this.result([{ id: log.id }], 1);
    }
    if (sql.startsWith('SELECT user_message, agent_response, actions_executed')) return this.result(this.logs.filter((log) => log.session_id === params[0] && String(log.user_id) === String(params[1])));
    if (sql.startsWith('SELECT l.id, l.session_id')) return this.result(this.logs.map((log) => ({ ...log, user_name: '成员甲' })));
    if (sql.startsWith('SELECT * FROM ai_model_configs')) return this.result([{ id: '1', name: 'mock', provider: 'mock', model_name: 'mock-model', api_endpoint: 'https://mock.invalid/chat', api_key: 'top-secret', temperature: 0.2, max_tokens: 100 }]);
    if (sql.startsWith('INSERT INTO ai_feedback')) {
      const row = { id: String(this.feedback.length + 1), original_text: params[0], ai_result: JSON.parse(String(params[1])), corrected_result: params[2] ? JSON.parse(String(params[2])) : null, feedback_type: params[3], created_at: new Date() };
      this.feedback.push(row); return this.result([{ id: row.id }], 1);
    }
    if (sql.startsWith('SELECT * FROM ai_feedback')) return this.result(this.feedback);
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return this.result();
    if (sql.startsWith('SELECT id FROM ai_learning_memory')) {
      return this.result(this.learning.filter((row) => String(row.client_id) === String(params[0]) && row.device_signature === params[1]).slice(0, 1).map(({ id }) => ({ id })));
    }
    if (sql.startsWith('INSERT INTO ai_learning_memory')) {
      const row = { id: String(this.learning.length + 1), client_id: params[0], client_name: params[1], device_signature: params[2], device_name: params[3], use_years: params[4], device_config: JSON.parse(String(params[5])), usage_count: 1, last_used_at: new Date() };
      this.learning.push(row); return this.result([{ id: row.id }], 1);
    }
    if (sql.startsWith('UPDATE ai_learning_memory')) {
      const row = this.learning.find((item) => item.id === params[4]); if (!row) return this.result(); row.usage_count = Number(row.usage_count) + 1; row.device_config = JSON.parse(String(params[0])); return this.result([{ id: row.id }], 1);
    }
    if (sql.startsWith('SELECT * FROM ai_learning_memory')) return this.result(this.learning);
    if (sql.startsWith('INSERT INTO quote_device_history')) {
      const row = { id: String(this.history.length + 1), quote_id: params[0], quote_type: params[1], client_id: params[2], client_name: params[3], device_signature: params[4], device_data: JSON.parse(String(params[5])), quote_total: String(params[6] ?? ''), created_at: new Date(), occurrence: 1 };
      this.history.push(row); return this.result([{ id: row.id }], 1);
    }
    if (sql.startsWith('SELECT client_name, device_signature')) return this.result(this.history);
    if (sql.includes('FROM device_quotas')) return this.result([{ id: '9007199254740993', name: '交换机', category: '网络设备', city_price: '1234.50', year1_total_price: '100.00', year2_total_price: '90.00', year3_total_price: '80.00', maintenance_rate: '0' }]);
    throw new Error(`Unexpected SQL: ${sql}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return await work(this);
  }
  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

function request(pathname: string, token?: string, method = 'GET', body?: unknown, signal?: AbortSignal): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Timed out waiting for asynchronous persistence.');
}

test('fake PostgreSQL covers assistant ownership, CRUD, terminal logs, feedback, learning, match and recommendations', async () => {
  const database = new AssistantRouteDatabase();
  const databaseGlobal = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  const originalFetch = globalThis.fetch;
  databaseGlobal.__itsPostgresDatabaseClient__ = database;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> };
    const recognition = body.messages?.some(({ content }) => content?.includes('设备识别助手'));
    const content = recognition
      ? JSON.stringify({ devices: [{ rawText: '交换机1台', deviceName: '交换机', quantity: 1, category: '网络设备', confidence: 0.99 }], suggestions: [] })
      : '模拟 AI 完整回复';
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  try {
    assert.equal((await sessionRoutes.GET(request('/api/agent-sessions'))).status, 401);
    assert.equal((await agentRoutes.GET(request('/api/agents', 'member-a-token'))).status, 403);
    assert.equal((await agentDetailRoutes.GET(request('/api/agents/not-an-id', 'admin-token'), { params: Promise.resolve({ id: 'not-an-id' }) })).status, 400);
    assert.equal((await agentDetailRoutes.GET(request('/api/agents/999', 'admin-token'), { params: Promise.resolve({ id: '999' }) })).status, 404);
    assert.equal((await agentRoutes.POST(request('/api/agents', 'admin-token', 'POST', { name: '', system_prompt: '' }))).status, 400);
    assert.equal((await feedbackRoutes.POST(request('/api/ai-feedback', 'member-a-token', 'POST', { originalText: '', feedbackType: 'invalid' }))).status, 400);
    assert.equal((await recommendRoutes.POST(request('/api/ai-recommend', 'member-a-token', 'POST', { devices: [] }))).status, 400);
    assert.equal((await matchRoutes.POST(request('/api/ai-match-devices', 'member-a-token', 'POST', { text: ' ' }))).status, 400);
    const demoCreated = await sessionRoutes.POST(request('/api/agent-sessions', 'demo-token', 'POST', { agent_id: 1, title: '演示会话' }));
    assert.equal(demoCreated.status, 201);
    const demoList = await json(await sessionRoutes.GET(request('/api/agent-sessions', 'demo-token')));
    assert.equal(((demoList.data as Record<string, unknown>).list as unknown[]).length, 1);
    const createdAgent = await agentRoutes.POST(request('/api/agents', 'admin-token', 'POST', { name: '新助手', system_prompt: '专业回复' }));
    assert.equal(createdAgent.status, 201);
    const createdAgentBody = await json(createdAgent);
    assert.equal((createdAgentBody.data as Record<string, unknown>).id, 2);
    assert.equal((await skillRoutes.POST(request('/api/agents/2/skills', 'admin-token', 'POST', { skill_name: 'system_guide', skill_type: 'guide' }), { params: Promise.resolve({ id: '2' }) })).status, 201);
    assert.equal((await agentDetailRoutes.PUT(request('/api/agents/2', 'admin-token', 'PUT', { name: '更新助手', system_prompt: '继续专业回复', enabled: 1 }), { params: Promise.resolve({ id: '2' }) })).status, 200);

    const chat = await chatRoutes.POST(request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '你好' }), { params: Promise.resolve({ id: '1' }) });
    const streamText = await chat.text();
    assert.match(streamText, /"type":"start"/);
    assert.match(streamText, /"type":"end"/);
    assert.match(streamText, /模拟 AI 完整回复/);
    assert.equal(streamText.includes('top-secret'), false);
    const sessionId = database.sessions.at(-1)?.session_id as string;
    assert.equal(database.logs[0].actions_executed instanceof Object, true);
    assert.equal((database.logs[0].actions_executed as Record<string, unknown>).status, 'completed');

    const continued = await chatRoutes.POST(request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '继续', session_id: sessionId }), { params: Promise.resolve({ id: '1' }) });
    assert.match(await continued.text(), /"type":"end"/);
    assert.equal(database.logs.length, 2);
    assert.equal(database.sessions.find((session) => session.session_id === sessionId)?.message_count, 2);
    assert.equal((await chatRoutes.POST(request('/api/agents/1/chat', 'member-b-token', 'POST', { message: '越权继续', session_id: sessionId }), { params: Promise.resolve({ id: '1' }) })).status, 403);

    globalThis.fetch = async () => new Response('provider secret', { status: 401 });
    const authFailure = await chatRoutes.POST(request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '鉴权失败' }), { params: Promise.resolve({ id: '1' }) });
    assert.match(await authFailure.text(), /API调用失败 \(401\)/);
    assert.equal((database.logs.at(-1)?.actions_executed as Record<string, unknown>).status, 'failed');
    assert.equal(database.logs.at(-1)?.agent_response, '');

    globalThis.fetch = async () => new Response('{"choices":[]}', { status: 200 });
    const malformed = await chatRoutes.POST(request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '格式错误' }), { params: Promise.resolve({ id: '1' }) });
    assert.match(await malformed.text(), /AI服务返回格式异常/);
    assert.equal((database.logs.at(-1)?.actions_executed as Record<string, unknown>).status, 'failed');

    globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError'); };
    const timeout = await chatRoutes.POST(request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '超时' }), { params: Promise.resolve({ id: '1' }) });
    assert.match(await timeout.text(), /AI服务调用超时/);
    assert.equal((database.logs.at(-1)?.actions_executed as Record<string, unknown>).status, 'failed');

    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const interrupted = await chatRoutes.POST(request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '中断' }), { params: Promise.resolve({ id: '1' }) });
    const interruptedReader = interrupted.body?.getReader();
    assert.ok(interruptedReader);
    await interruptedReader.read();
    await interruptedReader.cancel();
    await waitFor(() => (database.logs.at(-1)?.actions_executed as Record<string, unknown> | undefined)?.status === 'interrupted');
    assert.equal(database.logs.at(-1)?.agent_response, '');

    let requestAbortReachedProvider = false;
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) {
        requestAbortReachedProvider = true;
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const safetyTimer = setTimeout(() => reject(new Error('provider did not receive request abort')), 30);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(safetyTimer);
        requestAbortReachedProvider = true;
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    const requestAbort = new AbortController();
    const requestInterrupted = await chatRoutes.POST(
      request('/api/agents/1/chat', 'member-a-token', 'POST', { message: '请求中断' }, requestAbort.signal),
      { params: Promise.resolve({ id: '1' }) },
    );
    requestAbort.abort();
    await requestInterrupted.text();
    assert.equal(requestAbortReachedProvider, true);
    assert.equal((database.logs.at(-1)?.actions_executed as Record<string, unknown>).status, 'interrupted');

    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> };
      const recognition = body.messages?.some(({ content }) => content?.includes('设备识别助手'));
      const content = recognition
        ? JSON.stringify({ devices: [{ rawText: '交换机1台', deviceName: '交换机', quantity: 1, category: '网络设备', confidence: 0.99 }], suggestions: [] })
        : '模拟 AI 完整回复';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };

    const memberList = await json(await sessionRoutes.GET(request('/api/agent-sessions', 'member-a-token')));
    assert.equal(((memberList.data as Record<string, unknown>).list as unknown[]).length, 6);
    const otherMemberList = await json(await sessionRoutes.GET(request('/api/agent-sessions', 'member-b-token')));
    assert.equal(((otherMemberList.data as Record<string, unknown>).list as unknown[]).length, 0);
    assert.equal((await sessionDetailRoutes.GET(request(`/api/agent-sessions/${sessionId}`, 'member-b-token'), { params: Promise.resolve({ sessionId }) })).status, 403);
    assert.equal((await sessionDetailRoutes.PUT(request(`/api/agent-sessions/${sessionId}`, 'member-b-token', 'PUT', { title: '窃取' }), { params: Promise.resolve({ sessionId }) })).status, 403);
    assert.equal((await sessionDetailRoutes.DELETE(request(`/api/agent-sessions/${sessionId}`, 'member-b-token', 'DELETE'), { params: Promise.resolve({ sessionId }) })).status, 403);
    assert.equal((await sessionDetailRoutes.GET(request(`/api/agent-sessions/${sessionId}`, 'admin-token'), { params: Promise.resolve({ sessionId }) })).status, 200);
    assert.equal((await sessionDetailRoutes.PUT(request(`/api/agent-sessions/${sessionId}`, 'member-a-token', 'PUT', { title: '我的会话' }), { params: Promise.resolve({ sessionId }) })).status, 200);
    const detail = await json(await sessionDetailRoutes.GET(request(`/api/agent-sessions/${sessionId}`, 'member-a-token'), { params: Promise.resolve({ sessionId }) }));
    assert.equal(((detail.data as Record<string, unknown>).messages as unknown[]).length, 4);
    assert.equal(((detail.data as Record<string, unknown>).session as Record<string, unknown>).title, '我的会话');
    assert.equal((await logRoutes.GET(request('/api/agent-logs?agent_id=1', 'admin-token'))).status, 200);

    assert.equal((await feedbackRoutes.POST(request('/api/ai-feedback', 'member-a-token', 'POST', { originalText: '原始', aiResult: { ok: true }, feedbackType: 'correct' }))).status, 200);
    assert.equal(database.feedback.length, 1);
    assert.equal((await learningRoutes.POST(request('/api/ai-learning', 'admin-token', 'POST', { clientName: '客户甲', deviceConfigs: [{ deviceName: '交换机', useYears: 2 }] }))).status, 200);
    assert.equal(database.learning.length, 1);
    assert.equal((await recommendRoutes.POST(request('/api/ai-recommend', 'member-a-token', 'POST', { quoteId: 1, quoteType: 'maintenance', clientName: '客户甲', devices: [{ deviceName: '交换机', useYears: 2 }], quoteTotal: 1234.5 }))).status, 200);
    assert.equal((await recommendRoutes.GET(request('/api/ai-recommend?clientName=客户甲', 'member-a-token'))).status, 200);
    const matched = await json(await matchRoutes.POST(request('/api/ai-match-devices', 'member-a-token', 'POST', { text: '交换机1台' })));
    assert.equal(matched.success, true);
    assert.equal(((matched.devices as Array<Record<string, unknown>>)[0]).matchedDeviceId, '9007199254740993');

    const loggedErrors: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => { loggedErrors.push(args); };
    globalThis.fetch = async () => { throw new Error('internal provider secret detail'); };
    try {
      const failedMatch = await json(await matchRoutes.POST(request('/api/ai-match-devices', 'member-a-token', 'POST', { text: '交换机1台' })));
      assert.equal(failedMatch.error, 'AI服务暂时不可用');
      assert.equal(JSON.stringify(failedMatch).includes('internal provider secret detail'), false);
      assert.equal(loggedErrors.flat().some((value) => String(value).includes('internal provider secret detail')), true);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal((await sessionDetailRoutes.DELETE(request(`/api/agent-sessions/${sessionId}`, 'member-a-token', 'DELETE'), { params: Promise.resolve({ sessionId }) })).status, 200);
    assert.equal((await sessionDetailRoutes.GET(request(`/api/agent-sessions/${sessionId}`, 'member-a-token'), { params: Promise.resolve({ sessionId }) })).status, 404);
    assert.equal(database.transactionCount >= 5, true);
    assert.equal((await agentDetailRoutes.DELETE(request('/api/agents/2', 'admin-token', 'DELETE'), { params: Promise.resolve({ id: '2' }) })).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    delete databaseGlobal.__itsPostgresDatabaseClient__;
  }
});

test('assistant route maps an unexpected database failure to 500', async () => {
  const base = new AssistantRouteDatabase();
  const failing: DatabaseClient = {
    query: async <Row extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) => {
      if (/auth_sessions|SELECT is_active FROM users/.test(text)) return base.query<Row>(text, params);
      throw new Error('simulated database failure');
    },
    transaction: async <T>() => { throw new Error('simulated database failure'); },
    healthCheck: async () => {},
    close: async () => {},
  };
  const databaseGlobal = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  const originalConsoleError = console.error;
  databaseGlobal.__itsPostgresDatabaseClient__ = failing;
  console.error = () => {};
  try {
    const response = await agentRoutes.GET(request('/api/agents', 'admin-token'));
    assert.equal(response.status, 500);
    assert.equal((await json(response)).error, '获取智能体列表失败');
  } finally {
    console.error = originalConsoleError;
    delete databaseGlobal.__itsPostgresDatabaseClient__;
  }
});

test('live PostgreSQL assistant persistence', {
  skip: process.env.TEST_DATABASE_URL ? false : POSTGRES_TEST_SKIP_REASON,
}, async (t) => {
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  await harness.client.query(`INSERT INTO users (id, username, password_hash, name, role, is_active) VALUES ($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)`, [11, 'live-assistant-user', 'unused', '集成测试用户', 'its_member', true, 22, 'live-other-user', 'unused', '其他测试用户', 'its_member', true]);
  await harness.client.query(`INSERT INTO agent_configs (id, name, system_prompt, enabled) VALUES ($1,$2,$3,$4)`, [1, 'ITS助手', '帮助用户', true]);
  await harness.client.query(`INSERT INTO ai_model_configs (name, provider, model_name, api_endpoint, api_key, is_active, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7)`, ['live-mock', 'mock', 'mock-model', 'https://mock.invalid/chat', 'live-secret', true, true]);
  await saveSession(harness.client, 'live-member-token', { role: 'its_member', userId: 11, username: 'live-assistant-user', name: '集成测试用户', expiresAt: Date.now() + 60_000 });
  await saveSession(harness.client, 'live-other-token', { role: 'its_member', userId: 22, username: 'live-other-user', name: '其他测试用户', expiresAt: Date.now() + 60_000 });
  await saveSession(harness.client, 'live-admin-token', { role: 'admin', name: '管理员', expiresAt: Date.now() + 60_000 });
  const databaseGlobal = globalThis as typeof globalThis & { __itsPostgresDatabaseClient__?: DatabaseClient };
  const originalFetch = globalThis.fetch;
  databaseGlobal.__itsPostgresDatabaseClient__ = harness.client;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '真实 PG 终态回复' } }] }), { status: 200 });
  try {
    const created = await sessionRoutes.POST(request('/api/agent-sessions', 'live-member-token', 'POST', { agent_id: 1, title: '真实 PG 会话' }));
    assert.equal(created.status, 201);
    const listed = await json(await sessionRoutes.GET(request('/api/agent-sessions', 'live-member-token')));
    assert.equal(((listed.data as Record<string, unknown>).list as unknown[]).length, 1);

    const completed = await chatRoutes.POST(request('/api/agents/1/chat', 'live-member-token', 'POST', { message: '完成消息' }), { params: Promise.resolve({ id: '1' }) });
    assert.match(await completed.text(), /真实 PG 终态回复/);
    const completedLog = await harness.client.query<{ actions_executed: Record<string, unknown>; agent_response: string; session_id: string }>(`SELECT actions_executed, agent_response, session_id FROM agent_logs WHERE user_message=$1`, ['完成消息']);
    assert.equal(completedLog.rows[0].actions_executed.status, 'completed');
    assert.equal(completedLog.rows[0].agent_response, '真实 PG 终态回复');

    let liveProviderAborted = false;
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) {
        liveProviderAborted = true;
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      init?.signal?.addEventListener('abort', () => {
        liveProviderAborted = true;
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    const liveAbortController = new AbortController();
    const liveInterrupted = await chatRoutes.POST(request('/api/agents/1/chat', 'live-member-token', 'POST', { message: '中断消息' }, liveAbortController.signal), { params: Promise.resolve({ id: '1' }) });
    liveAbortController.abort();
    await liveInterrupted.text();
    assert.equal(liveProviderAborted, true);
    const interruptedLog = await harness.client.query<{ actions_executed: Record<string, unknown>; agent_response: string }>(`SELECT actions_executed, agent_response FROM agent_logs WHERE user_message=$1`, ['中断消息']);
    assert.equal(interruptedLog.rows[0].actions_executed.status, 'interrupted');
    assert.equal(interruptedLog.rows[0].agent_response, '');

    const beforeUnauthorized = await harness.client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM agent_logs');
    const unauthorized = await chatRoutes.POST(request('/api/agents/1/chat', 'live-other-token', 'POST', { message: '越权消息', session_id: completedLog.rows[0].session_id }), { params: Promise.resolve({ id: '1' }) });
    assert.equal(unauthorized.status, 403);
    const afterUnauthorized = await harness.client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM agent_logs');
    assert.equal(afterUnauthorized.rows[0].total, beforeUnauthorized.rows[0].total);

    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '触发回滚' } }] }), { status: 200 });
    await harness.client.query(`CREATE FUNCTION reject_assistant_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced log failure'; END $$`);
    await harness.client.query(`CREATE TRIGGER reject_assistant_log BEFORE INSERT ON agent_logs FOR EACH ROW EXECUTE FUNCTION reject_assistant_log()`);
    const beforeRollback = await harness.client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM agent_sessions');
    const rollbackResponse = await chatRoutes.POST(request('/api/agents/1/chat', 'live-member-token', 'POST', { message: '回滚消息' }), { params: Promise.resolve({ id: '1' }) });
    assert.match(await rollbackResponse.text(), /"type":"error"/);
    await harness.client.query('DROP TRIGGER reject_assistant_log ON agent_logs');
    await harness.client.query('DROP FUNCTION reject_assistant_log()');
    const afterRollback = await harness.client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM agent_sessions');
    assert.equal(afterRollback.rows[0].total, beforeRollback.rows[0].total);

    const learningBody = { clientName: '并发客户', deviceConfigs: [{ deviceName: '并发交换机', useYears: 2 }] };
    const learningResponses = await Promise.all([
      learningRoutes.POST(request('/api/ai-learning', 'live-admin-token', 'POST', learningBody)),
      learningRoutes.POST(request('/api/ai-learning', 'live-admin-token', 'POST', learningBody)),
    ]);
    assert.deepEqual(learningResponses.map(({ status }) => status), [200, 200]);
    const memories = await harness.client.query<{ usage_count: number; device_config: Record<string, unknown> }>(`SELECT usage_count, device_config FROM ai_learning_memory WHERE device_signature=$1`, ['并发交换机::mid']);
    assert.equal(memories.rows.length, 1);
    assert.equal(memories.rows[0].usage_count, 2);
    assert.equal(memories.rows[0].device_config.deviceName, '并发交换机');
  } finally {
    globalThis.fetch = originalFetch;
    delete databaseGlobal.__itsPostgresDatabaseClient__;
  }
});
