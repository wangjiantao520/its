import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// DeepSeek API 配置
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// 系统提示词（增强版 - 集成学习能力）
const SYSTEM_PROMPT = `你是专业的IT设备维保报价助手，帮助用户快速生成维保报价方案。

## 你的能力
1. 从自然语言中提取报价所需的关键信息
2. 识别设备类型、数量、使用年限
3. 识别服务级别要求（SLA）
4. 提供多种配置方案供选择
5. 根据客户历史偏好智能匹配
6. 参考历史错误反馈避免重复错误

## 反馈学习样本（从历史错误反馈中学习）
以下是用户反馈的"AI识别错误"案例，必须避免这些错误：
{{FEEDBACK_SAMPLES}}

## 客户历史偏好（如果提供）
该客户之前使用的设备配置偏好：
{{CLIENT_HISTORY}}

## 输出格式（必须返回合法JSON）
{
  "customerName": "客户名称（从输入中提取或空）",
  "projectName": "项目名称（从输入中提取或空）",
  "region": "城区|市区县城郊区|乡镇|农村（必须选择一个）",
  "contractYears": 合同年限（1/2/3的数字）,
  "serviceMode": "远程|驻场|混合（必须选择一个）",
  "responseTime": "10分钟内|30分钟内|1小时内（必须选择一个）",
  "arrivalTime": "2小时内|8小时内（必须选择一个）",
  "serviceTime": "5x8|7x8|7x24（必须选择一个）",
  "annualInspectionCount": 年度巡检次数（数字）,
  "needSpareParts": 是否需要备件（true/false）,
  "devices": [
    {
      "rawText": "原始描述文本",
      "deviceName": "设备名称（台式电脑|笔记本电脑|打印机|复印机|扫描仪|装订机|服务器|网络设备|监控设备|其他）",
      "quantity": 数量（数字）,
      "useYears": 使用年限（数字）,
      "underWarranty": 是否在保修期内（true/false）,
      "needSpareParts": 该设备是否需要备件（true/false）,
      "confidence": 识别置信度（0-1之间）,
      "warnings": ["警告信息（如有）"]
    }
  ],
  "missingFields": ["缺失的必填字段列表"],
  "suggestions": ["补充信息的建议"],
  "estimatedPriceRange": {
    "min": 最低预估价格（数字）,
    "max": 最高预估价格（数字）,
    "unit": "元/年"
  }
}

## 设备识别规则
- 台式电脑、台式机、PC -> "台式电脑"
- 笔记本、笔记本电脑 -> "笔记本电脑"
- 打印机、一体机、激光打印机 -> "打印机"
- 复印机 -> "复印机"
- 装订机、电动装订机 -> "装订机"
- 扫描仪 -> "扫描仪"
- 服务器、机房设备 -> "服务器"
- 交换机、路由器、防火墙 -> "网络设备"
- 摄像头、NVR、监控 -> "监控设备"

## 地区识别
- 提到"城区" -> "城区"
- 提到"乡镇" -> "乡镇"
- 提到"农村" -> "农村"
- 提到"县城"、"市区"、"郊区" -> "市区县城郊区"
- 未明确提及 -> "城区"（默认）

## 服务模式识别
- 提到"驻场"、"驻点"、"现场" -> "驻场"
- 提到"远程"、"线上" -> "远程"
- 提到"混合" -> "混合"
- 未明确提及 -> "远程"（默认）

## 响应时间识别
- 提到"10分钟" -> "10分钟内"
- 提到"30分钟" -> "30分钟内"
- 提到"1小时" -> "1小时内"
- 未明确提及 -> "30分钟内"（默认）

## 到场时间识别
- 提到"2小时" -> "2小时内"
- 提到"8小时" -> "8小时内"
- 未明确提及 -> "8小时内"（默认）

## 服务时间识别
- 提到"5x8"、"工作日" -> "5x8"
- 提到"7x8"、"每日8小时" -> "7x8"
- 提到"7x24"、"24小时"、"全天候" -> "7x24"
- 未明确提及 -> "5x8"（默认）

## 使用年限与成新率（用于计算价格参考）
- 0-1年 -> 新设备，成新率高
- 1-2年 -> 近新设备
- 2-3年 -> 中等年限
- 3-5年 -> 使用较长
- 5年以上 -> 老旧设备，成新率低

## 价格预估规则（仅供参考）
- 基础价格 = 设备数量 × 设备单价 × 成新率系数
- 城区系数 1.0，乡镇系数 0.9
- 驻场比远程贵约50%
- 7x24比5x8贵约30%
- 2小时到场比8小时贵约20%
- 包含备件加价约10-20%

## 价格参考（元/台/年，不含税）
- 台式电脑：800-1500
- 笔记本电脑：1000-1800
- 打印机：1500-3000
- 复印机：3000-8000
- 服务器：5000-15000
- 网络设备：2000-5000
- 监控设备：1000-3000

## 重要规则
1. 必须返回合法的JSON格式，不要有额外文本
2. 所有标注"必须选择"的字段必须填充，不能为空
3. devices数组至少有一个设备
4. missingFields数组列出无法确定的关键字段
5. suggestions给出补充信息的建议
6. estimatedPriceRange必须计算并填充
7. 参考历史偏好和反馈样本，提供更准确的识别

现在分析用户需求：`;

interface QuoteRequest {
  messages: Array<{ role: string; content: string }>;
  userMessage?: string;
}

// 解析 AI 返回的 JSON
function parseAIResponse(content: string): any {
  try {
    let jsonStr = content;

    // 移除 markdown 代码块
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // 尝试直接解析
    try {
      return JSON.parse(jsonStr);
    } catch {
      // 尝试提取 JSON 对象
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        return JSON.parse(objMatch[0]);
      }
    }

    throw new Error('无法解析 JSON');
  } catch (error) {
    console.error('解析 AI 返回失败:', error);
    throw error;
  }
}

// 计算预估价格范围
function calculateEstimatedPrice(devices: any[], region: string, serviceMode: string, serviceTime: string): { min: number; max: number; unit: string } {
  const priceMap: Record<string, { min: number; max: number }> = {
    '台式电脑': { min: 800, max: 1500 },
    '笔记本电脑': { min: 1000, max: 1800 },
    '打印机': { min: 1500, max: 3000 },
    '复印机': { min: 3000, max: 8000 },
    '服务器': { min: 5000, max: 15000 },
    '网络设备': { min: 2000, max: 5000 },
    '监控设备': { min: 1000, max: 3000 },
    '扫描仪': { min: 800, max: 2000 },
    '装订机': { min: 500, max: 1500 },
    '其他': { min: 500, max: 2000 },
  };

  const regionFactor: Record<string, number> = {
    '城区': 1.0,
    '市区县城郊区': 0.95,
    '乡镇': 0.9,
    '农村': 0.85,
  };

  const serviceModeFactor: Record<string, number> = {
    '远程': 1.0,
    '混合': 1.25,
    '驻场': 1.5,
  };

  const serviceTimeFactor: Record<string, number> = {
    '5x8': 1.0,
    '7x8': 1.15,
    '7x24': 1.3,
  };

  let totalMin = 0;
  let totalMax = 0;

  devices.forEach((device: any) => {
    const price = priceMap[device.deviceName] || priceMap['其他'];
    const quantity = device.quantity || 1;
    const useYears = device.useYears || 2;
    const ageFactor = useYears <= 1 ? 1.0 : useYears <= 3 ? 0.9 : 0.8;

    totalMin += price.min * quantity * ageFactor;
    totalMax += price.max * quantity * ageFactor;
  });

  const rFactor = regionFactor[region] || 1.0;
  const sFactor = serviceModeFactor[serviceMode] || 1.0;
  const tFactor = serviceTimeFactor[serviceTime] || 1.0;

  return {
    min: Math.round(totalMin * rFactor * sFactor * tFactor),
    max: Math.round(totalMax * rFactor * sFactor * tFactor),
    unit: '元/年',
  };
}

// 调用 DeepSeek API
async function callDeepSeekAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey || apiKey === 'your-deepseek-api-key-here') {
    throw new Error('DeepSeek API Key 未配置');
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: messages,
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek API 错误:', response.status, errorText);
    throw new Error(`API 调用失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 查询客户历史学习记录
async function getClientHistory(clientName?: string, clientId?: number): Promise<string> {
  if (!clientName && !clientId) return '（无客户历史信息）';

  try {
    const conn = await pool.getConnection();
    try {
      let query = 'SELECT device_signature, device_config, usage_count FROM ai_learning_memory WHERE 1=1';
      const params: any[] = [];
      if (clientId) {
        query += ' AND client_id = ?';
        params.push(clientId);
      } else if (clientName) {
        query += ' AND client_name = ?';
        params.push(clientName);
      }
      query += ' ORDER BY usage_count DESC, last_used_at DESC LIMIT 10';

      const [rows] = await conn.execute(query, params);
      const memories = rows as any[];

      if (memories.length === 0) return '（该客户暂无历史记录）';

      return memories.map((m, i) => {
        const cfg = typeof m.device_config === 'string' ? JSON.parse(m.device_config) : m.device_config;
        return `${i + 1}. ${m.device_signature} - 配置: ${JSON.stringify(cfg)} (使用${m.usage_count}次)`;
      }).join('\n');
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[AI] 查询客户历史失败:', e);
    return '（查询历史失败）';
  }
}

// 查询反馈样本（让AI学习避免错误）
async function getFeedbackSamples(): Promise<string> {
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT original_text, ai_result, corrected_result, feedback_type, feedback_comment FROM ai_feedback ORDER BY created_at DESC LIMIT 20'
      );
      const feedbacks = rows as any[];

      if (feedbacks.length === 0) return '（暂无反馈数据）';

      return feedbacks.map((f, i) => {
        const ai = typeof f.ai_result === 'string' ? JSON.parse(f.ai_result) : f.ai_result;
        const corrected = f.corrected_result ? (typeof f.corrected_result === 'string' ? JSON.parse(f.corrected_result) : f.corrected_result) : null;
        return `案例${i + 1} [${f.feedback_type}]:\n  原文本: ${f.original_text.substring(0, 200)}\n  AI结果: ${JSON.stringify(ai).substring(0, 300)}\n  ${corrected ? `纠正: ${JSON.stringify(corrected).substring(0, 300)}` : ''}\n  ${f.feedback_comment || ''}`;
      }).join('\n\n');
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[AI] 查询反馈失败:', e);
    return '（查询反馈失败）';
  }
}

// 构建消息历史
function buildMessages(userMessage: string, systemPrompt: string, history?: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];

  if (history && history.length > 0) {
    messages.push(...history);
  }

  messages.push({ role: 'user', content: userMessage });

  return messages;
}

export async function POST(request: NextRequest) {
  console.log('[AI] 收到解析请求');

  try {
    const body = await request.json();
    const { text, history, clientName, clientId } = body as {
      text?: string;
      history?: Array<{ role: string; content: string }>;
      clientName?: string;
      clientId?: number;
    };

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: '请输入需求描述' },
        { status: 400 }
      );
    }

    console.log('[AI] 输入文本:', text, '客户:', clientName);

    // 并行查询：客户历史 + 反馈样本
    const [clientHistory, feedbackSamples] = await Promise.all([
      getClientHistory(clientName, clientId),
      getFeedbackSamples(),
    ]);

    // 动态构建系统提示词
    const dynamicSystemPrompt = SYSTEM_PROMPT
      .replace('{{FEEDBACK_SAMPLES}}', feedbackSamples)
      .replace('{{CLIENT_HISTORY}}', clientHistory);

    const messages = buildMessages(text, dynamicSystemPrompt, history);

    const aiResponse = await callDeepSeekAPI(messages);
    console.log('[AI] DeepSeek 返回:', aiResponse);

    const result = parseAIResponse(aiResponse);

    if (!result.estimatedPriceRange && result.devices && result.devices.length > 0) {
      result.estimatedPriceRange = calculateEstimatedPrice(
        result.devices,
        result.region || '城区',
        result.serviceMode || '远程',
        result.serviceTime || '5x8'
      );
    }

    // 自动同步学习记忆（仅当客户名明确时）
    if (clientName && result.devices && result.devices.length > 0) {
      try {
        const conn = await pool.getConnection();
        for (const device of result.devices) {
          const useYears = device.useYears;
          const signature = `${(device.deviceName || '').toLowerCase()}::${!useYears ? 'unknown' : useYears <= 1 ? 'new' : useYears <= 3 ? 'mid' : 'old'}`;
          const [existing] = await conn.execute(
            'SELECT id, usage_count FROM ai_learning_memory WHERE client_id = ? AND device_signature = ?',
            [clientId || null, signature]
          );
          if ((existing as any[]).length > 0) {
            await conn.execute(
              'UPDATE ai_learning_memory SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP, device_config = ? WHERE id = ?',
              [JSON.stringify(device), (existing as any[])[0].id]
            );
          } else {
            await conn.execute(
              'INSERT INTO ai_learning_memory (client_id, client_name, device_signature, device_config) VALUES (?, ?, ?, ?)',
              [clientId || null, clientName, signature, JSON.stringify(device)]
            );
          }
        }
        conn.release();
      } catch (e) {
        console.error('[AI] 自动保存学习记忆失败:', e);
      }
    }

    result.quotaList = [];
    result._meta = {
      hasHistory: clientHistory !== '（该客户暂无历史记录）' && clientHistory !== '（无客户历史信息）',
      hasFeedback: feedbackSamples !== '（暂无反馈数据）',
      timestamp: new Date().toISOString(),
    };

    console.log('[AI] 解析结果:', JSON.stringify(result, null, 2));
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[AI] AI解析失败:', error);

    if (error.message === 'DeepSeek API Key 未配置') {
      return NextResponse.json(
        {
          devices: [],
          missingFields: ['API配置'],
          suggestions: ['请在 .env 中配置 DEEPSEEK_API_KEY'],
          error: 'AI服务未配置'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        devices: [],
        missingFields: ['服务暂不可用'],
        suggestions: ['AI服务暂时不可用，请稍后重试'],
        error: error.message
      },
      { status: 500 }
    );
  }
}
