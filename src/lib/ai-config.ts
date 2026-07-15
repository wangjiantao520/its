import pool, { type DbRow } from '@/lib/db';
import { callAIModelWithConfig, type AIModelConfig } from './ai-model-client';
export { callAIModelWithConfig, type AIModelConfig } from './ai-model-client';

interface AIModelConfigRow extends DbRow {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  api_endpoint: string;
  api_key: string;
  temperature: string | number;
  max_tokens: number;
  system_prompt?: string;
}

function mapAIModelConfigRow(config: AIModelConfigRow): AIModelConfig {
  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    model_name: config.model_name,
    api_endpoint: config.api_endpoint,
    api_key: config.api_key,
    temperature: parseFloat(String(config.temperature)) || 0.3,
    max_tokens: config.max_tokens || 3000,
    system_prompt: config.system_prompt,
  };
}

/**
 * 获取当前激活的AI模型配置
 * 如果数据库没有配置或没有激活配置，则使用环境变量回退
 */
export async function getActiveAIModelConfig(): Promise<AIModelConfig | null> {
  // 1. 优先从数据库读取激活的配置
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM ai_model_configs WHERE is_active = 1 LIMIT 1'
      );
      const config = (rows as AIModelConfigRow[])[0];
      if (config) {
        return mapAIModelConfigRow(config);
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.warn('[AI Config] 数据库读取失败，使用环境变量回退:', (error as Error).message);
  }

  // 2. 回退到环境变量
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey && apiKey !== 'your-deepseek-api-key-here') {
    return {
      id: 0,
      name: '环境变量配置',
      provider: 'deepseek',
      model_name: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
      api_endpoint: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      api_key: apiKey,
      temperature: 0.3,
      max_tokens: 3000,
    };
  }

  return null;
}

/**
 * 调用AI模型（统一入口）
 */
export async function callAIModel(
  messages: Array<{ role: string; content: string }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
    configId?: number;
  }
): Promise<{ success: boolean; content?: string; error?: string; config?: AIModelConfig }> {
  const config = options?.configId
    ? await getAIModelConfigById(options.configId)
    : await getActiveAIModelConfig();

  if (!config) {
    return { success: false, error: '未找到可用的AI模型配置，请在系统设置中配置或设置 DEEPSEEK_API_KEY 环境变量' };
  }

  return callAIModelWithConfig(config, messages, options);
}

async function getAIModelConfigById(id: number): Promise<AIModelConfig | null> {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM ai_model_configs WHERE id = ?',
        [id]
      );
      const config = (rows as AIModelConfigRow[])[0];
      if (!config) return null;
      return mapAIModelConfigRow(config);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.warn('[AI Config] 按 ID 读取配置失败:', (error as Error).message);
    return null;
  }
}
