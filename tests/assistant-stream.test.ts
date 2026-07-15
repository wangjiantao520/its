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
