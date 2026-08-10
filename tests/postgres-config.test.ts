import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { NextRequest } from 'next/server';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { runPostgresMigrations } from '../src/lib/database/postgres-migrations';
import { saveSession } from '../src/lib/auth-session-store';
import {
  createPostgresTestHarness,
  POSTGRES_TEST_SKIP_REASON,
} from './helpers/postgres';

type Row = Record<string, unknown>;
type QueryHandler = (
  text: string,
  params: readonly unknown[],
) => QueryResult<Row> | Promise<QueryResult<Row>>;

const scopedFiles = [
  'src/lib/ai-config.ts',
  'src/lib/agent-skills.ts',
  'src/app/api/ai-models/route.ts',
  'src/app/api/ai-models/active/route.ts',
  'src/app/api/ai-models/list-models/route.ts',
  'src/app/api/ai-models/test/route.ts',
  'src/app/api/ai-models/[id]/default/route.ts',
  'src/app/api/device-params/route.ts',
  'src/app/api/device-params/[id]/route.ts',
  'src/app/api/intelligent-project-quotas/route.ts',
  'src/app/api/labor-price-config/route.ts',
  'src/app/api/self-construction-quotas/route.ts',
] as const;

const expectedAdminChecks = new Map<string, number>([
  ['src/app/api/ai-models/route.ts', 4],
  ['src/app/api/ai-models/active/route.ts', 1],
  ['src/app/api/ai-models/list-models/route.ts', 1],
  ['src/app/api/ai-models/test/route.ts', 1],
  ['src/app/api/ai-models/[id]/default/route.ts', 1],
  ['src/app/api/device-params/route.ts', 1],
  ['src/app/api/device-params/[id]/route.ts', 2],
  ['src/app/api/intelligent-project-quotas/route.ts', 3],
  ['src/app/api/labor-price-config/route.ts', 3],
  ['src/app/api/self-construction-quotas/route.ts', 3],
]);

class FakeConfigDatabase implements DatabaseClient {
  readonly queries: Array<{ text: string; params: readonly unknown[] }> = [];
  transactionCount = 0;

  constructor(
    readonly role: 'admin' | 'its_member' = 'admin',
    private readonly handler: QueryHandler = () => result(),
  ) {}

  async query<ResultRow extends Row>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    this.queries.push({ text, params });

    if (text.includes('DELETE FROM auth_sessions WHERE expires_at')) {
      return result() as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT role, user_id, username, name, expires_at FROM auth_sessions')) {
      return result([{
        role: this.role,
        user_id: null,
        username: this.role === 'its_member' ? 'demo' : null,
        name: this.role === 'its_member' ? '演示用户' : null,
        expires_at: Date.now() + 60_000,
      }]) as QueryResult<ResultRow>;
    }
    if (text.includes('UPDATE auth_sessions SET last_seen_at')) {
      return result([], 1) as QueryResult<ResultRow>;
    }
    if (text.includes('SELECT id, name FROM users WHERE username')) {
      return result([{ id: '42', name: '演示用户' }]) as QueryResult<ResultRow>;
    }

    return await this.handler(text, params) as QueryResult<ResultRow>;
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

function result(rows: Row[] = [], rowCount = rows.length): QueryResult<Row> {
  return { rows, rowCount };
}

type DatabaseGlobal = typeof globalThis & {
  __itsPostgresDatabaseClient__?: DatabaseClient;
};

function installDatabase(database: DatabaseClient): void {
  (globalThis as DatabaseGlobal).__itsPostgresDatabaseClient__ = database;
}

function apiRequest(
  path: string,
  method: string,
  body?: unknown,
  authenticated = true,
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      ...(authenticated ? { authorization: 'Bearer config-test-token' } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function assertScopedFilesUsePostgres(): Promise<void> {
  for (const file of scopedFiles) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from ['"]@\/lib\/db['"]/, `${file} still imports the SQLite adapter`);
    assert.doesNotMatch(source, /\.prepare\s*\(|\.execute\s*\(/, `${file} still uses synchronous/MySQL SQL APIs`);
    assert.doesNotMatch(source, /\bany\b/, `${file} contains an explicit any`);
    if (!file.endsWith('list-models/route.ts')) {
      assert.match(source, /getDatabase|DatabaseClient/, `${file} does not use DatabaseClient`);
    }
    const expectedChecks = expectedAdminChecks.get(file);
    if (expectedChecks !== undefined) {
      assert.equal(
        source.match(/await requireApiAuth\(request, \['admin'\]\)/g)?.length ?? 0,
        expectedChecks,
        `${file} does not await administrator authorization for every mutation`,
      );
    }
  }
}

async function loadRoutes() {
  await assertScopedFilesUsePostgres();
  const [aiModels, aiActive, aiDefault, deviceParams, deviceParamById, intelligent, labor, self] = await Promise.all([
    import('../src/app/api/ai-models/route'),
    import('../src/app/api/ai-models/active/route'),
    import('../src/app/api/ai-models/[id]/default/route'),
    import('../src/app/api/device-params/route'),
    import('../src/app/api/device-params/[id]/route'),
    import('../src/app/api/intelligent-project-quotas/route'),
    import('../src/app/api/labor-price-config/route'),
    import('../src/app/api/self-construction-quotas/route'),
  ]);
  return { aiModels, aiActive, aiDefault, deviceParams, deviceParamById, intelligent, labor, self };
}

test('scoped configuration modules no longer use SQLite or MySQL query syntax', async () => {
  await assertScopedFilesUsePostgres();
});

test('AI config and agent skill repositories await DatabaseClient queries', async () => {
  await assertScopedFilesUsePostgres();
  const { getActiveAIModelConfig } = await import('../src/lib/ai-config');
  const aiDatabase = new FakeConfigDatabase('admin', (text, params) => {
    assert.match(text, /is_active = true/);
    assert.deepEqual(params, []);
    return result([{
      id: '12', name: '运行模型', provider: 'deepseek', model_name: 'deepseek-chat',
      api_endpoint: 'https://api.deepseek.com/v1/chat/completions', api_key: 'secret',
      temperature: 0.2, max_tokens: 1000, system_prompt: null,
    }]);
  });
  assert.equal((await getActiveAIModelConfig(aiDatabase))?.id, 12);

  const skillDatabase = new FakeConfigDatabase('admin', (text, params) => {
    assert.match(text, /ILIKE \$1/);
    assert.deepEqual(params, ['%交换机%']);
    return result([{
      name: '核心交换机', category: '网络', model: 'S1', original_price: '1000.00', maintenance_rate: 0.05,
    }]);
  });
  installDatabase(skillDatabase);
  const { skillExecutors } = await import('../src/lib/agent-skills');
  const output = await skillExecutors.quota_query({ keyword: '交换机' });
  assert.match(output, /核心交换机/);
  assert.ok(skillDatabase.queries.every(({ text }) => !text.includes('?')));
});

test('agent skill executors cover recognition, formula, report and diagnosis', async () => {
  const { skillExecutors } = await import('../src/lib/agent-skills');
  const { detectIntent } = await import('../src/lib/agent-intent');

  // 新意图触发词
  assert.equal(detectIntent('帮我识别一下设备清单')?.skill, 'device_recognition');
  assert.equal(detectIntent('生成报价报告')?.skill, 'report_generation');
  assert.equal(detectIntent('报价是怎么算的')?.skill, 'formula_explanation');
  assert.equal(detectIntent('系统登录不了怎么办')?.skill, 'problem_diagnosis');
  // 原有意图仍工作
  assert.equal(detectIntent('帮我查交换机的定额')?.skill, 'quota_query');
  assert.equal(detectIntent('计算一台服务器的维保报价')?.skill, 'quote_calculation');
  assert.equal(detectIntent('如何用这个系统')?.skill, 'system_guide');

  // 设备清单识别（规则提取，无需数据库）
  const recognition = await skillExecutors.device_recognition({ text: '2台服务器、5台台式电脑、1台打印机' });
  assert.match(recognition, /服务器/);
  assert.match(recognition, /台式电脑/);
  assert.match(recognition, /打印机/);
  const emptyRecognition = await skillExecutors.device_recognition({ text: '没有任何设备描述' });
  assert.match(emptyRecognition, /未能从描述中识别出设备/);

  // 公式解释（纯静态）
  const formula = await skillExecutors.formula_explanation({});
  assert.match(formula, /维保成本/);
  assert.match(formula, /65%/);
  assert.match(formula, /35%/);

  // 问题诊断（纯静态）
  const diagnosis = await skillExecutors.problem_diagnosis({});
  assert.match(diagnosis, /无法登录/);
  assert.match(diagnosis, /加载中/);

  // 报告生成（走数据库，mock 报价记录）
  const reportDatabase = new FakeConfigDatabase('admin', (text, params) => {
    assert.match(text, /FROM quotation_records/);
    return result([
      { id: '1', client_name: '测试客户', project_name: '测试项目', total_amount: '1000.00', status: 'draft', created_at: '2026-08-01T00:00:00.000Z' },
      { id: '2', client_name: '测试客户', project_name: '测试项目2', total_amount: '2000.00', status: 'approved', created_at: '2026-08-02T00:00:00.000Z' },
    ]);
  });
  installDatabase(reportDatabase);
  const report = await skillExecutors.report_generation({ keyword: '测试客户' });
  assert.match(report, /报价汇总报告/);
  assert.match(report, /2/);
  assert.match(report, /3,000/);
});

test('configuration reads require a session while every mutation requires an administrator', async () => {
  const routes = await loadRoutes();
  const mutations = [
    () => routes.aiModels.POST(apiRequest('/api/ai-models', 'POST', {})),
    () => routes.deviceParams.POST(apiRequest('/api/device-params', 'POST', {})),
    () => routes.intelligent.POST(apiRequest('/api/intelligent-project-quotas', 'POST', {})),
    () => routes.labor.POST(apiRequest('/api/labor-price-config', 'POST', {})),
    () => routes.self.POST(apiRequest('/api/self-construction-quotas', 'POST', {})),
  ];

  for (const mutate of mutations) {
    installDatabase(new FakeConfigDatabase('its_member'));
    assert.equal((await mutate()).status, 403);
  }

  installDatabase(new FakeConfigDatabase('its_member', (text) => {
    if (text.includes('SELECT * FROM self_construction_quotas')) return result();
    if (text.includes('COUNT(*)')) return result([{ total: '0' }]);
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  assert.equal((await routes.self.GET(apiRequest('/api/self-construction-quotas', 'GET'))).status, 200);

  assert.equal(
    (await routes.self.GET(apiRequest('/api/self-construction-quotas', 'GET', undefined, false))).status,
    401,
  );

  installDatabase(new FakeConfigDatabase('its_member'));
  assert.equal((await routes.aiModels.GET(apiRequest('/api/ai-models', 'GET'))).status, 403);

  installDatabase(new FakeConfigDatabase('admin', (text) => {
    if (text.includes('SELECT * FROM ai_model_configs')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  assert.equal((await routes.aiModels.GET(apiRequest('/api/ai-models', 'GET'))).status, 200);
});

test('AI model routes preserve masking, safe bigint IDs, validation, atomic defaults, and not-found behavior', async () => {
  const { aiModels, aiActive, aiDefault } = await loadRoutes();
  const listedDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('SELECT * FROM ai_model_configs')) {
      return result([{
        id: '9007199254740993', name: '主模型', provider: 'deepseek', model_name: 'deepseek-chat',
        api_endpoint: 'https://api.deepseek.com/v1/chat/completions', api_key: 'secret-value',
        temperature: 0.3, max_tokens: 3000, system_prompt: null, description: null,
        is_active: true, is_default: true, sort_order: 0,
      }]);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(listedDatabase);
  const listResponse = await aiModels.GET(apiRequest('/api/ai-models', 'GET'));
  const listPayload = await json(listResponse);
  const listed = (listPayload.data as Row[])[0];
  assert.equal(listResponse.status, 200);
  assert.equal(listed.id, '9007199254740993');
  assert.equal(listed.api_key, undefined);
  assert.equal(listed.api_key_masked, 'secr...alue');
  assert.equal(listed.is_active, 1);
  assert.equal(listed.is_default, 1);
  assert.ok(listPayload.presets);

  installDatabase(new FakeConfigDatabase());
  const invalid = await aiModels.POST(apiRequest('/api/ai-models', 'POST', {
    name: '无效模型', provider: 'deepseek', model_name: 'deepseek-chat',
    api_endpoint: 'not-a-url', api_key: 'secret', temperature: 3,
  }));
  assert.equal(invalid.status, 400);

  const createdDatabase = new FakeConfigDatabase('admin', (text, params) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.startsWith('UPDATE ai_model_configs SET is_default = false')) return result([], 1);
    if (text.startsWith('UPDATE ai_model_configs SET is_active = false')) return result([], 1);
    if (text.startsWith('INSERT INTO ai_model_configs')) {
      assert.equal(params[9], true);
      assert.equal(params[10], true);
      return result([{ id: '9007199254740993' }], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(createdDatabase);
  const created = await aiModels.POST(apiRequest('/api/ai-models', 'POST', {
    name: '新模型', provider: 'deepseek', model_name: 'deepseek-chat',
    api_endpoint: 'https://api.deepseek.com/v1/chat/completions', api_key: 'secret-value',
    is_default: true, is_active: '1',
  }));
  assert.equal(created.status, 200);
  assert.equal(((await json(created)).data as Row).id, '9007199254740993');
  assert.equal(createdDatabase.transactionCount, 1);

  const missingUpdateDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('UPDATE ai_model_configs')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(missingUpdateDatabase);
  const missingUpdate = await aiModels.PUT(apiRequest('/api/ai-models?id=404', 'PUT', { name: '不存在' }));
  assert.equal(missingUpdate.status, 404);

  const updateDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('UPDATE ai_model_configs')) return result([{ id: '7' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(updateDatabase);
  assert.equal((await aiModels.PUT(
    apiRequest('/api/ai-models?id=7', 'PUT', { name: '已更新模型' }),
  )).status, 200);

  const defaultDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT id FROM ai_model_configs')) return result([{ id: '7' }]);
    if (text.startsWith('UPDATE ai_model_configs SET is_default = false')) return result([], 2);
    if (text.startsWith('UPDATE ai_model_configs SET is_default = true')) return result([{ id: '7' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(defaultDatabase);
  const setDefault = await aiDefault.POST(
    apiRequest('/api/ai-models/7/default', 'POST'),
    { params: Promise.resolve({ id: '7' }) },
  );
  assert.equal(setDefault.status, 200);
  assert.equal(defaultDatabase.transactionCount, 1);
  assert.equal(defaultDatabase.queries.filter(({ text }) => text.includes('is_default')).length, 2);

  let clearedDefaultsForMissingModel = false;
  const missingDefaultDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT id FROM ai_model_configs')) return result();
    if (text.startsWith('UPDATE ai_model_configs SET is_default = false')) {
      clearedDefaultsForMissingModel = true;
      return result([], 1);
    }
    if (text.startsWith('UPDATE ai_model_configs')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(missingDefaultDatabase);
  const missingDefaultUpdate = await aiModels.PUT(
    apiRequest('/api/ai-models?id=404', 'PUT', { is_default: true }),
  );
  assert.equal(missingDefaultUpdate.status, 404);
  assert.equal(clearedDefaultsForMissingModel, false);

  const activeDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT id FROM ai_model_configs')) return result([{ id: '8' }]);
    if (text.startsWith('UPDATE ai_model_configs SET is_active = false')) return result([], 1);
    if (text.includes('SET is_active = true')) return result([{ id: '8' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(activeDatabase);
  const activated = await aiActive.POST(apiRequest('/api/ai-models/active?id=8', 'POST'));
  assert.equal(activated.status, 200);
  assert.equal(((await json(activated)).data as Row).activeId, '8');

  const missingDeleteDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT is_active, is_default')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(missingDeleteDatabase);
  assert.equal((await aiModels.DELETE(apiRequest('/api/ai-models?id=404', 'DELETE'))).status, 404);

  const deleteDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT is_active, is_default')) {
      return result([{ is_active: false, is_default: false }]);
    }
    if (text.startsWith('DELETE FROM ai_model_configs')) return result([{ id: '9' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(deleteDatabase);
  assert.equal((await aiModels.DELETE(apiRequest('/api/ai-models?id=9', 'DELETE'))).status, 200);
  assert.equal(deleteDatabase.transactionCount, 1);
  const deleteStatements = deleteDatabase.queries.map(({ text }) => text);
  assert.ok(deleteStatements.findIndex((text) => text.includes('pg_advisory_xact_lock'))
    < deleteStatements.findIndex((text) => text.includes('SELECT is_active, is_default')));
  assert.match(
    deleteStatements.find((text) => text.includes('SELECT is_active, is_default')) ?? '',
    /FOR UPDATE/,
  );

  const activeDeleteDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT is_active, is_default')) {
      return result([{ is_active: true, is_default: false }]);
    }
    throw new Error(`Active model delete unexpectedly continued: ${text}`);
  });
  installDatabase(activeDeleteDatabase);
  assert.equal((await aiModels.DELETE(apiRequest('/api/ai-models?id=9', 'DELETE'))).status, 400);
  assert.equal(activeDeleteDatabase.transactionCount, 1);
  assert.equal(
    activeDeleteDatabase.queries.some(({ text }) => text.startsWith('DELETE FROM ai_model_configs')),
    false,
  );
});

test('AI model state mutations share one lock and create/update persist active state', async () => {
  const { aiModels, aiActive, aiDefault } = await loadRoutes();
  const advisoryStatements = new Set<string>();
  const rememberLock = (text: string): QueryResult<Row> | null => {
    if (!text.includes('pg_advisory_xact_lock')) return null;
    advisoryStatements.add(text);
    return result([{ locked: null }]);
  };

  const createDatabase = new FakeConfigDatabase('admin', (text, params) => {
    const locked = rememberLock(text);
    if (locked) return locked;
    if (text.startsWith('UPDATE ai_model_configs SET is_active = false')) return result([], 1);
    if (text.startsWith('INSERT INTO ai_model_configs')) {
      assert.match(text, /is_active/);
      assert.equal(params[10], true);
      return result([{ id: '10' }], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(createDatabase);
  const create = await aiModels.POST(apiRequest('/api/ai-models', 'POST', {
    name: '激活模型', provider: 'deepseek', model_name: 'deepseek-chat',
    api_endpoint: 'https://api.deepseek.com/v1/chat/completions', api_key: 'secret',
    is_active: 1,
  }));
  assert.equal(create.status, 200);
  assert.equal(((await json(create)).data as Row).id, '10');

  const disableDatabase = new FakeConfigDatabase('admin', (text, params) => {
    const locked = rememberLock(text);
    if (locked) return locked;
    if (text.includes('SELECT id FROM ai_model_configs')) return result([{ id: '10' }]);
    if (text.startsWith('UPDATE ai_model_configs')) {
      assert.match(text, /is_active = \$1/);
      assert.equal(params[0], false);
      return result([{ id: '10' }], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(disableDatabase);
  assert.equal((await aiModels.PUT(
    apiRequest('/api/ai-models?id=10', 'PUT', { is_active: '0' }),
  )).status, 200);

  const endpointDatabase = new FakeConfigDatabase('admin', (text) => {
    const locked = rememberLock(text);
    if (locked) return locked;
    if (text.includes('SELECT id FROM ai_model_configs')) return result([{ id: '10' }]);
    if (text.startsWith('UPDATE ai_model_configs SET is_active = false')) return result([], 1);
    if (text.includes('SET is_active = true')) return result([{ id: '10' }], 1);
    if (text.startsWith('UPDATE ai_model_configs SET is_default = false')) return result([], 1);
    if (text.startsWith('UPDATE ai_model_configs SET is_default = true')) return result([{ id: '10' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(endpointDatabase);
  assert.equal((await aiActive.POST(apiRequest('/api/ai-models/active?id=10', 'POST'))).status, 200);
  assert.equal((await aiDefault.POST(
    apiRequest('/api/ai-models/10/default', 'POST'),
    { params: Promise.resolve({ id: '10' }) },
  )).status, 200);
  assert.equal(advisoryStatements.size, 1);
});

test('self-construction quota routes list, create, update, delete, validate, and report duplicates', async () => {
  const { self } = await loadRoutes();

  const listDatabase = new FakeConfigDatabase('its_member', (text) => {
    if (text.includes('COUNT(*)')) return result([{ total: '1' }]);
    if (text.includes('SELECT * FROM self_construction_quotas')) {
      return result([{ id: 'SC-1', category: '布线', name: '敷设', unit: '米', quantity: 1, price: '12.50', remark: '', sort_order: 0 }]);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(listDatabase);
  const listed = await self.GET(apiRequest('/api/self-construction-quotas?keyword=敷设&page=1&limit=20', 'GET'));
  const listedPayload = await json(listed);
  assert.equal(((listedPayload.pagination as Row).total), 1);
  assert.equal(((listedPayload.data as Row[])[0].price), 12.5);
  assert.equal(typeof ((listedPayload.data as Row[])[0].price), 'number');
  assert.equal(typeof ((listedPayload.data as Row[])[0].quantity), 'number');
  assert.ok(listDatabase.queries.every(({ text }) => !text.includes('?')));

  installDatabase(new FakeConfigDatabase());
  assert.equal((await self.POST(apiRequest('/api/self-construction-quotas', 'POST', {
    id: 'SC-X', category: '布线', name: '无效', unit: '米', price: 'NaN',
  }))).status, 400);

  const duplicateDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('INSERT INTO self_construction_quotas')) {
      throw Object.assign(new Error('duplicate'), { code: '23505' });
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(duplicateDatabase);
  const duplicate = await self.POST(apiRequest('/api/self-construction-quotas', 'POST', {
    id: 'SC-1', category: '布线', name: '敷设', unit: '米', price: 12.5,
  }));
  assert.equal(duplicate.status, 400);
  assert.equal((await json(duplicate)).error, '定额编号已存在');

  const crudDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('INSERT INTO self_construction_quotas')) return result([{ id: 'SC-2' }], 1);
    if (text.startsWith('UPDATE self_construction_quotas')) return result([{ id: 'SC-2' }], 1);
    if (text.startsWith('DELETE FROM self_construction_quotas')) return result([{ id: 'SC-2' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(crudDatabase);
  const quotaBody = { id: 'SC-2', category: '布线', name: '安装', unit: '项', quantity: 1, price: 20, remark: '', sortOrder: 0 };
  assert.equal((await self.POST(apiRequest('/api/self-construction-quotas', 'POST', quotaBody))).status, 200);
  assert.equal((await self.PUT(apiRequest('/api/self-construction-quotas', 'PUT', quotaBody))).status, 200);
  assert.equal((await self.DELETE(apiRequest('/api/self-construction-quotas', 'DELETE', { id: 'SC-2' }))).status, 200);

  installDatabase(new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('DELETE FROM self_construction_quotas')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  assert.equal((await self.DELETE(apiRequest('/api/self-construction-quotas', 'DELETE', { id: 'missing' }))).status, 404);
});

test('intelligent-project quota routes preserve pagination and CRUD/not-found contracts', async () => {
  const { intelligent } = await loadRoutes();
  const database = new FakeConfigDatabase('admin', (text, params) => {
    if (text.includes('COUNT(*)')) return result([{ total: '1' }]);
    if (text.includes('SELECT * FROM intelligent_project_quotas')) {
      return result([{ id: 'IP-1', item_id: 'IP-1', category: '网络', name: '交换机', unit: '台', price: '100.00' }]);
    }
    if (text.startsWith('INSERT INTO intelligent_project_quotas')) {
      assert.equal(params[1], 'IP-2');
      return result([{ id: 'IP-2' }], 1);
    }
    if (text.startsWith('UPDATE intelligent_project_quotas')) return result([{ id: 'IP-2' }], 1);
    if (text.startsWith('DELETE FROM intelligent_project_quotas')) return result([{ id: 'IP-2' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(database);
  const listResponse = await intelligent.GET(apiRequest('/api/intelligent-project-quotas', 'GET'));
  assert.equal(listResponse.status, 200);
  const listed = ((await json(listResponse)).data as Row[])[0];
  assert.equal(listed.price, 100);
  assert.equal(typeof listed.price, 'number');
  const body = {
    id: 'IP-2', serialNumber: 2, category: '网络', name: '交换机', brandModel: '',
    description: '', deductibleTaxRate: 0, unit: '台', price: 100, remark: '', sortOrder: 0,
  };
  assert.equal((await intelligent.POST(apiRequest('/api/intelligent-project-quotas', 'POST', body))).status, 200);
  assert.equal((await intelligent.PUT(apiRequest('/api/intelligent-project-quotas', 'PUT', body))).status, 200);
  assert.equal((await intelligent.DELETE(apiRequest('/api/intelligent-project-quotas', 'DELETE', { id: 'IP-2' }))).status, 200);

  installDatabase(new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('UPDATE intelligent_project_quotas')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  assert.equal((await intelligent.PUT(apiRequest('/api/intelligent-project-quotas', 'PUT', body))).status, 404);
});

test('labor price routes use booleans, preserve camelCase payloads, and cover duplicate/CRUD behavior', async () => {
  const { labor } = await loadRoutes();
  const listDatabase = new FakeConfigDatabase('its_member', (text) => {
    if (text.includes('SELECT * FROM labor_price_config')) {
      return result([{
        id: '9007199254740993', level: '高级', unit_price: '880.50', unit: '人天',
        description: '', sort_order: 0, is_active: true,
        created_at: '2026-08-04T00:00:00.000Z', updated_at: '2026-08-04T00:00:00.000Z',
      }]);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(listDatabase);
  const listPayload = await json(await labor.GET(apiRequest('/api/labor-price-config?active_only=true', 'GET')));
  assert.deepEqual((listPayload.data as Row[])[0], {
    id: '9007199254740993', level: '高级', unitPrice: 880.5, unit: '人天', description: '',
    sortOrder: 0, isActive: true, createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z',
  });
  assert.equal(listDatabase.queries.some(({ params }) => params.includes(true)), true);

  const duplicateDatabase = new FakeConfigDatabase('admin', (text) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT id FROM labor_price_config')) return result([{ id: '1' }]);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(duplicateDatabase);
  const duplicate = await labor.POST(apiRequest('/api/labor-price-config', 'POST', { level: '高级', unitPrice: 880 }));
  assert.equal(duplicate.status, 400);

  const crudDatabase = new FakeConfigDatabase('admin', (text, params) => {
    if (text.includes('pg_advisory_xact_lock')) return result([{ locked: null }]);
    if (text.includes('SELECT id FROM labor_price_config')) return result();
    if (text.startsWith('INSERT INTO labor_price_config')) {
      assert.equal(params[5], true);
      return result([{ id: '9007199254740993' }], 1);
    }
    if (text.startsWith('UPDATE labor_price_config')) return result([{ id: '9007199254740993' }], 1);
    if (text.startsWith('DELETE FROM labor_price_config')) return result([{ id: '9007199254740993' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(crudDatabase);
  const create = await labor.POST(apiRequest('/api/labor-price-config', 'POST', { level: '专家', unitPrice: 1200 }));
  assert.equal(((await json(create)).data as Row).id, '9007199254740993');
  assert.equal((await labor.PUT(apiRequest('/api/labor-price-config', 'PUT', {
    id: '9007199254740993', level: '专家', unitPrice: 1250, unit: '人天', description: '', sortOrder: 0, isActive: false,
  }))).status, 200);
  assert.equal((await labor.DELETE(apiRequest('/api/labor-price-config', 'DELETE', { id: '9007199254740993' }))).status, 200);

  installDatabase(new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('DELETE FROM labor_price_config')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  assert.equal((await labor.DELETE(apiRequest('/api/labor-price-config', 'DELETE', { id: '404' }))).status, 404);
});

test('device parameter aggregate route uses PostgreSQL for list/create/update/delete with legacy payloads', async () => {
  const { deviceParams, deviceParamById } = await loadRoutes();
  installDatabase(new FakeConfigDatabase('admin', (text) => {
    if (text.includes('SELECT * FROM self_construction_quotas')) {
      return result([{ id: '0001', category: '测试', name: '文本编号', unit: '项', price: '1.00' }]);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  const textIdList = await json(await deviceParams.GET(
    apiRequest('/api/device-params?type=self_construction_quotas', 'GET'),
  ));
  assert.equal((textIdList.data as Row[])[0].id, '0001');
  assert.equal((textIdList.data as Row[])[0].price, 1);
  assert.equal(typeof (textIdList.data as Row[])[0].price, 'number');

  const database = new FakeConfigDatabase('admin', (text, params) => {
    if (text.includes('SELECT * FROM labor_price_config')) {
      return result([{ id: '1', level: '中级', unit_price: '600.00', is_active: true }]);
    }
    if (text.startsWith('INSERT INTO labor_price_config')) {
      assert.equal(params[5], true);
      return result([{ id: '2' }], 1);
    }
    if (text.startsWith('UPDATE labor_price_config')) return result([{ id: '2' }], 1);
    if (text.startsWith('DELETE FROM labor_price_config')) return result([{ id: '2' }], 1);
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(database);
  const listed = await json(await deviceParams.GET(apiRequest('/api/device-params?type=labor_price_config', 'GET')));
  assert.equal((listed.data as Row[])[0].id, '1');
  assert.equal((listed.data as Row[])[0].unit_price, 600);
  assert.equal(typeof (listed.data as Row[])[0].unit_price, 'number');
  assert.equal((listed.data as Row[])[0].is_active, 1);
  const data = { level: '高级', unit_price: 900, unit: '人天', description: '', sort_order: 0, is_active: 1 };
  assert.equal((await deviceParams.POST(apiRequest('/api/device-params', 'POST', { type: 'labor_price_config', data }))).status, 200);
  assert.equal((await deviceParamById.PUT(apiRequest('/api/device-params/2', 'PUT', { type: 'labor_price_config', id: '2', data }))).status, 200);
  assert.equal((await deviceParamById.DELETE(apiRequest('/api/device-params/2?type=labor_price_config', 'DELETE'))).status, 200);

  installDatabase(new FakeConfigDatabase('admin', (text) => {
    if (text.startsWith('UPDATE labor_price_config')) return result();
    throw new Error(`Unexpected SQL: ${text}`);
  }));
  const missing = await deviceParamById.PUT(apiRequest('/api/device-params/404', 'PUT', {
    type: 'labor_price_config', id: '404', data,
  }));
  assert.equal(missing.status, 404);
});

test('device parameter updates are partial, nullable, allowlisted, and reject empty patches', async () => {
  const { deviceParamById } = await loadRoutes();
  const laborDatabase = new FakeConfigDatabase('admin', (text, params) => {
    if (text.startsWith('UPDATE labor_price_config')) {
      assert.match(text, /unit_price = \$1/);
      assert.doesNotMatch(text, /level =/);
      assert.deepEqual(params, [901, '2']);
      return result([{ id: '2' }], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(laborDatabase);
  const partial = await deviceParamById.PUT(apiRequest('/api/device-params/2', 'PUT', {
    type: 'labor_price_config', id: '2', data: { unit_price: 901 },
  }));
  assert.equal(partial.status, 200);

  const nullableDatabase = new FakeConfigDatabase('admin', (text, params) => {
    if (text.startsWith('UPDATE self_construction_quotas')) {
      assert.match(text, /remark = \$1/);
      assert.doesNotMatch(text, /category =/);
      assert.deepEqual(params, [null, 'SC-N']);
      return result([{ id: 'SC-N' }], 1);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  installDatabase(nullableDatabase);
  const nullable = await deviceParamById.PUT(apiRequest('/api/device-params/SC-N', 'PUT', {
    type: 'self_construction_quotas', id: 'SC-N', data: { remark: null },
  }));
  assert.equal(nullable.status, 200);

  const emptyDatabase = new FakeConfigDatabase('admin', (text) => {
    throw new Error(`Empty patch unexpectedly queried data table: ${text}`);
  });
  installDatabase(emptyDatabase);
  const empty = await deviceParamById.PUT(apiRequest('/api/device-params/2', 'PUT', {
    type: 'labor_price_config', id: '2', data: {},
  }));
  assert.equal(empty.status, 400);
  assert.equal((await json(empty)).message, '没有要更新的字段');
});

test('live PostgreSQL configuration CRUD', {
  skip: process.env.TEST_DATABASE_URL ? false : POSTGRES_TEST_SKIP_REASON,
}, async (t) => {
  await assertScopedFilesUsePostgres();
  const { self, aiModels, deviceParams } = await loadRoutes();
  const harness = await createPostgresTestHarness(t);
  await runPostgresMigrations(harness.client);
  installDatabase(harness.client);
  await saveSession(harness.client, 'live-config-admin', {
    role: 'admin',
    expiresAt: Date.now() + 60_000,
  });

  const headers = { authorization: 'Bearer live-config-admin' };
  const create = await self.POST(new NextRequest('http://localhost/api/self-construction-quotas', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'LIVE-SC-1', category: '测试', name: '测试定额', unit: '项', price: 1 }),
  }));
  assert.equal(create.status, 200);
  const list = await self.GET(new NextRequest('http://localhost/api/self-construction-quotas', { headers }));
  const liveSelf = ((await json(list)).data as Row[]).find(({ id }) => id === 'LIVE-SC-1');
  assert.ok(liveSelf);
  assert.equal(typeof liveSelf.price, 'number');
  const aggregateList = await deviceParams.GET(new NextRequest(
    'http://localhost/api/device-params?type=self_construction_quotas',
    { headers },
  ));
  const aggregateSelf = ((await json(aggregateList)).data as Row[]).find(({ id }) => id === 'LIVE-SC-1');
  assert.ok(aggregateSelf);
  assert.equal(typeof aggregateSelf.price, 'number');

  const aiBody = (name: string) => ({
    name, provider: 'deepseek', model_name: 'deepseek-chat',
    api_endpoint: 'https://api.deepseek.com/v1/chat/completions', api_key: 'secret',
    is_active: true,
  });
  const firstAI = await aiModels.POST(new NextRequest('http://localhost/api/ai-models', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(aiBody('LIVE-AI-1')),
  }));
  assert.equal(firstAI.status, 200);
  const secondAI = await aiModels.POST(new NextRequest('http://localhost/api/ai-models', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(aiBody('LIVE-AI-2')),
  }));
  assert.equal(secondAI.status, 200);
  const secondAIId = ((await json(secondAI)).data as Row).id;
  assert.equal(typeof secondAIId, 'string');
  const activeCount = await harness.client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM ai_model_configs WHERE is_active = true',
  );
  assert.equal(activeCount.rows[0]?.count, '1');
  assert.equal((await aiModels.DELETE(new NextRequest(`http://localhost/api/ai-models?id=${secondAIId}`, {
    method: 'DELETE', headers,
  }))).status, 400);
  assert.equal((await aiModels.PUT(new NextRequest(`http://localhost/api/ai-models?id=${secondAIId}`, {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ is_active: false }),
  }))).status, 200);
  assert.equal((await aiModels.DELETE(new NextRequest(`http://localhost/api/ai-models?id=${secondAIId}`, {
    method: 'DELETE', headers,
  }))).status, 200);
  const remove = await self.DELETE(new NextRequest('http://localhost/api/self-construction-quotas', {
    method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'LIVE-SC-1' }),
  }));
  assert.equal(remove.status, 200);
});
