/**
 * AI 模型提供商预设配置
 *
 * 从 api/ai-models/route.ts 提取，供路由和前端共享。
 */

export interface ProviderPreset {
  endpoint: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-v4-flash',
    models: [
      'deepseek-v4-flash',
      'deepseek-chat',
      'deepseek-v3-2-251201',
      'deepseek-reasoner',
      'deepseek-v4-pro',
      'deepseek-coder',
      'deepseek-r1',
    ],
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o1-preview',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
    ],
  },
  doubao: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    defaultModel: 'doubao-seed-2-0-pro-260215',
    models: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215',
      'doubao-seed-2-0-mini-260215',
      'doubao-seed-1-8-251228',
      'doubao-pro-32k',
      'doubao-pro-128k',
      'doubao-lite-32k',
      'doubao-1-5-pro-32k',
    ],
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-max',
    models: [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-long',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
      'qwen3-46b',
      'qwen3-72b',
      'qwq-32b',
    ],
  },
  moonshot: {
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'moonshot-v1-128k',
    models: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      'kimi-k2-5-260127',
      'kimi-k2',
      'moonshot-k2',
    ],
  },
  zhipu: {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-4-plus',
    models: [
      'glm-4',
      'glm-4-flash',
      'glm-4-plus',
      'glm-4-air',
      'glm-4-long',
      'glm-5-0-260211',
      'glm-4-0520',
      'glm-3-turbo',
    ],
  },
  minimax: {
    endpoint: 'https://api.minimax.chat/v1/chat/completions',
    defaultModel: 'abab6.5s-chat',
    models: [
      'MiniMax-M1',
      'abab6.5s-chat',
      'abab6.5-chat',
      'abab6-chat',
      'abab5.5-chat',
      'abab5.5-chat-0324',
      'abab5-chat',
      'minimax-text-01',
    ],
  },
  baichuan: {
    endpoint: 'https://api.baichuan-ai.com/v1/chat/completions',
    defaultModel: 'Baichuan4',
    models: [
      'Baichuan4',
      'Baichuan3-Turbo',
      'Baichuan3-Turbo-128k',
      'Baichuan2',
      'Baichuan2-Turbo',
    ],
  },
  custom: {
    endpoint: '',
    defaultModel: '',
    models: [],
  },
};

/** 脱敏显示 API Key */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}
