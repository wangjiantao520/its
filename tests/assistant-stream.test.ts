import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAssistantStreamParser,
  type AssistantStreamEvent,
} from '../src/lib/assistant-stream';

test('parses split SSE chunks without losing session or content events', () => {
  const events: AssistantStreamEvent[] = [];
  const parser = createAssistantStreamParser((event) => events.push(event));

  parser.push('data: {"type":"start","session_id":"sess_1"}\n\nda');
  parser.push('ta: {"type":"content","content":"你');
  parser.push('好"}\n\ndata: {"type":"end"}\n\n');
  parser.finish();

  assert.deepEqual(events, [
    { type: 'start', session_id: 'sess_1' },
    { type: 'content', content: '你好' },
    { type: 'end' },
  ]);
});

test('ignores malformed events but reports a server error event', () => {
  const events: AssistantStreamEvent[] = [];
  const parser = createAssistantStreamParser((event) => events.push(event));

  parser.push('data: not-json\n\ndata: {"type":"error","error":"模型超时"}\n\n');
  parser.finish();

  assert.deepEqual(events, [{ type: 'error', error: '模型超时' }]);
});

test('reports an interrupted stream when it ends after start without a terminal event', () => {
  const events: AssistantStreamEvent[] = [];
  const parser = createAssistantStreamParser((event) => events.push(event));

  parser.push('data: {"type":"start","session_id":"sess_interrupted"}\n\n');
  parser.push('data: {"type":"content","content":"部分回复"}\n\n');
  parser.finish();

  assert.deepEqual(events, [
    { type: 'start', session_id: 'sess_interrupted' },
    { type: 'content', content: '部分回复' },
    { type: 'error', error: '连接中断，请重试' },
  ]);
});

test('does not report interruption after an explicit server error', () => {
  const events: AssistantStreamEvent[] = [];
  const parser = createAssistantStreamParser((event) => events.push(event));

  parser.push('data: {"type":"start","session_id":"sess_failed"}\n\n');
  parser.push('data: {"type":"error","error":"AI服务返回格式异常"}\n\n');
  parser.finish();

  assert.deepEqual(events, [
    { type: 'start', session_id: 'sess_failed' },
    { type: 'error', error: 'AI服务返回格式异常' },
  ]);
});
