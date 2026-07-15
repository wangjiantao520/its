export type AssistantStreamEvent =
  | { type: 'start'; session_id: string }
  | { type: 'content'; content: string }
  | { type: 'skill'; skill?: string; result?: string }
  | { type: 'end' }
  | { type: 'error'; error: string };

function isAssistantStreamEvent(value: unknown): value is AssistantStreamEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (event.type === 'start') return typeof event.session_id === 'string';
  if (event.type === 'content') return typeof event.content === 'string';
  if (event.type === 'skill') return true;
  if (event.type === 'end') return true;
  if (event.type === 'error') return typeof event.error === 'string';
  return false;
}

export function createAssistantStreamParser(
  onEvent: (event: AssistantStreamEvent) => void,
) {
  let buffer = '';

  const parseBlock = (block: string) => {
    const payload = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!payload || payload === '[DONE]') return;

    try {
      const event: unknown = JSON.parse(payload);
      if (isAssistantStreamEvent(event)) onEvent(event);
    } catch {
      // 忽略无效事件，后续合法事件仍可继续处理。
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk.replaceAll('\r\n', '\n');
      let separator = buffer.indexOf('\n\n');
      while (separator >= 0) {
        parseBlock(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
      }
    },
    finish() {
      if (buffer.trim()) parseBlock(buffer);
      buffer = '';
    },
  };
}
