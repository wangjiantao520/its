import assert from 'node:assert/strict';
import test from 'node:test';
import { callAIModelWithConfig, type AIModelConfig } from '../src/lib/ai-model-client';

const config: AIModelConfig = {
  id: 1,
  name: 'mock',
  provider: 'mock',
  model_name: 'mock-model',
  api_endpoint: 'https://mock.invalid/chat',
  api_key: 'secret',
  temperature: 0.2,
  max_tokens: 100,
};

test('accepts a valid AI response from the simulated service', async () => {
  const result = await callAIModelWithConfig(config, [{ role: 'user', content: 'hello' }], {
    fetcher: async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
  });
  assert.equal(result.success, true);
  assert.equal(result.content, 'ok');
});

test('reports authentication failures without exposing the response body', async () => {
  const result = await callAIModelWithConfig(config, [{ role: 'user', content: 'hello' }], {
    fetcher: async () => new Response('sensitive upstream detail', { status: 401 }),
  });
  assert.equal(result.success, false);
  assert.equal(result.error, 'API调用失败 (401)');
  assert.equal(result.error?.includes('sensitive'), false);
});

test('rejects malformed or truncated AI response payloads', async () => {
  const result = await callAIModelWithConfig(config, [{ role: 'user', content: 'hello' }], {
    fetcher: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
  });
  assert.equal(result.success, false);
  assert.equal(result.error, 'AI服务返回格式异常');
});

test('aborts and reports a simulated upstream timeout', async () => {
  const fetcher: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  const result = await callAIModelWithConfig(config, [{ role: 'user', content: 'hello' }], {
    fetcher,
    timeoutMs: 5,
  });
  assert.equal(result.success, false);
  assert.equal(result.error, 'AI服务调用超时');
});
