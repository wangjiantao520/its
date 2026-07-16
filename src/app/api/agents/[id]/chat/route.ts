import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool } from '@/lib/db';
import { getActiveAIModelConfig } from '@/lib/ai-config';

// ITS领域系统提示词
const ITS_SYSTEM_PROMPT = `你是ITS智能报价系统的AI助手，专门服务于政务信息化项目的工程报价和维保报价业务。

## 你的核心能力

### 1. 设备定额查询
- 可以查询设备的中标单价、维保费率、设备分档等信息
- 支持按设备名称、类别模糊搜索

### 2. 维保报价计算
- 硬件维保费 = 设备原值 × 行业标准年费率（已含不驻场调整系数）
- 软件维保费 = 软件原值 × 软件维保费率
- 免维保项：随机器永久授权的软件模块不计入维保取费基数
- 支持多年限报价（1年/2年/3年），费用随年数线性增加

### 3. 工程报价计算
- 基于自施工定额和智能化定额进行工程报价
- 包含设备费、辅材费、人工费、机械费等

### 4. 成本测算
- 维保成本 = 维保报价 × 成本率（默认65%）
- 维保利润 = 维保报价 × (1 - 成本率)
- 成本构成：人力成本、备件成本、管理成本、厂商支持

## 报价依据
- 基于2020年同类政务信息化项目的政府采购中标价格
- 结合各厂商维保政策、政府采购行业标准费率
- 不驻场服务模式调整系数已包含在费率中

## 回答规范
- 金额统一使用人民币（¥），大额数字使用"万元"单位
- 回答使用Markdown格式，善用表格、列表展示数据
- 计算过程要清晰展示公式和中间结果
- 如果信息不足，主动询问用户补充必要信息
- 保持专业、简洁、准确的表达风格`;

// 技能执行器
const skillExecutors: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
  // 设备定额查询
  quota_query: async (params) => {
    const keyword = (params.keyword as string) || '';
    const devices = await pool.execute(
      'SELECT name, category, model, original_price, maintenance_rate FROM maintenance_device_quotas WHERE name LIKE ? OR category LIKE ? OR model LIKE ? LIMIT 20',
      [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
    );
    const deviceList = devices[0] as Array<Record<string, unknown>>;
    if (!deviceList || deviceList.length === 0) {
      return `未找到与"${keyword}"相关的设备定额信息。`;
    }
    const list = deviceList.map((d) =>
      `| ${d.name} | ${d.category || '-'} | ${d.model || '-'} | ¥${Number(d.original_price || 0).toLocaleString()} | ${d.maintenance_rate ? `${(Number(d.maintenance_rate) * 100).toFixed(1)}%` : '-'} |`
    ).join('\n');
    return `查询到以下与"${keyword}"相关的设备定额信息：\n\n| 设备名称 | 类别 | 型号 | 中标单价 | 维保费率 |\n|---------|------|------|---------|---------|\n${list}`;
  },

  // 维保费率查询
  maintenance_rate_query: async (params) => {
    const category = (params.category as string) || '';
    const rates = await pool.execute(
      'SELECT DISTINCT category, maintenance_rate FROM maintenance_device_quotas WHERE category LIKE ? LIMIT 20',
      [`%${category}%`]
    );
    const rateList = rates[0] as Array<Record<string, unknown>>;
    if (!rateList || rateList.length === 0) {
      return `未找到与"${category}"相关的维保费率配置。`;
    }
    const list = rateList.map((r) =>
      `| ${r.category} | ${(Number(r.maintenance_rate) * 100).toFixed(1)}% |`
    ).join('\n');
    return `查询到以下维保费率配置：\n\n| 设备类别 | 年维保费率 |\n|---------|------------|\n${list}`;
  },

  // 维保报价计算
  quote_calculation: async (params) => {
    const deviceName = (params.device_name as string) || '';
    const originalPrice = Number(params.original_price) || 0;
    const maintenanceRate = Number(params.maintenance_rate) || 0.05;
    const quantity = Number(params.quantity) || 1;
    const years = Number(params.years) || 1;

    if (!deviceName || originalPrice <= 0) {
      return '请提供设备名称和原值进行报价计算。';
    }

    const annualFee = originalPrice * maintenanceRate * quantity;
    const totalFee = annualFee * years;
    const cost = totalFee * 0.65;
    const profit = totalFee - cost;

    return `报价计算结果：

| 项目 | 数值 |
|------|------|
| 设备名称 | ${deviceName} |
| 设备单价 | ¥${originalPrice.toLocaleString()} |
| 数量 | ${quantity} 台 |
| 年维保费率 | ${(maintenanceRate * 100).toFixed(1)}% |
| 合同年限 | ${years} 年 |

**费用汇总**

| 费用项 | 金额 |
|--------|------|
| 年维保费用 | ¥${annualFee.toLocaleString()} |
| ${years}年维保总价 | ¥${totalFee.toLocaleString()} |
| 维保成本（65%） | ¥${cost.toLocaleString()} |
| 维保利润（35%） | ¥${profit.toLocaleString()} |

> 报价依据：基于2020年同类政务信息化项目政府采购中标价格，费率已含不驻场调整系数。`;
  },

  // 报价历史查询
  quote_history: async (params) => {
    const keyword = (params.keyword as string) || '';
    const quotes = await pool.execute(
      'SELECT id, client_name, project_name, total_amount, status, created_at FROM quotation_records WHERE client_name LIKE ? OR project_name LIKE ? ORDER BY created_at DESC LIMIT 10',
      [`%${keyword}%`, `%${keyword}%`]
    );
    const quoteList = quotes[0] as Array<Record<string, unknown>>;
    if (!quoteList || quoteList.length === 0) {
      return `未找到与"${keyword}"相关的报价记录。`;
    }
    const list = quoteList.map((q) =>
      `| WB${String(q.id).padStart(4, '0')} | ${q.client_name || '-'} | ${q.project_name || '-'} | ¥${Number(q.total_amount || 0).toLocaleString()} | ${q.status || '-'} |`
    ).join('\n');
    return `查询到以下报价记录：\n\n| 报价单号 | 客户名称 | 项目名称 | 总金额 | 状态 |\n|---------|---------|---------|-------|------|\n${list}`;
  },

  // 系统功能介绍
  system_guide: async () => {
    return `## ITS智能报价系统功能介绍

### 核心功能

| 模块 | 说明 |
|------|------|
| **工程报价** | 基于自施工定额和智能化定额进行工程报价，包含设备费、辅材费、人工费等 |
| **维保报价** | 基于设备维保定额库进行维保报价，支持多年限、成本测算 |
| **报价管理** | 报价单列表、详情查看、版本管理、审批流程 |
| **AI助手** | 智能设备识别、报价计算、定额查询、需求解析 |
| **设备导入** | 支持Excel批量导入设备清单 |
| **数据看板** | 报价统计、数据分析、可视化图表 |

### 维保报价取费逻辑

- **硬件维保费** = 设备原值 × 行业标准年费率（已含不驻场调整系数）
- **软件维保费** = 软件原值 × 软件维保费率
- **免维保项**：随机器永久授权的软件模块不计入维保取费基数

### 你可以问我

- "帮我查询交换机的定额"
- "计算一台服务器的维保报价"
- "查询网络设备的维保费率"
- "查看最近的报价记录"
- "如何使用这个系统"`;
  }
};

// 意图识别（增强版）
function detectIntent(message: string): { skill: string; params: Record<string, unknown> } | null {
  const lowerMsg = message.toLowerCase();

  // 报价历史查询
  if (lowerMsg.includes('报价记录') || lowerMsg.includes('历史报价') || lowerMsg.includes('报价单') && (lowerMsg.includes('查看') || lowerMsg.includes('列表'))) {
    const keyword = message.replace(/.*?(报价记录|历史报价|报价单).*?/, '').trim() || '';
    return { skill: 'quote_history', params: { keyword } };
  }

  // 定额查询
  if (lowerMsg.includes('定额') || lowerMsg.includes('单价') || (lowerMsg.includes('价格') && lowerMsg.includes('查询'))) {
    const keyword = message.replace(/.*?(定额|单价|价格|查询).*?/g, '').trim() || '设备';
    return { skill: 'quota_query', params: { keyword } };
  }

  // 维保费率查询
  if (lowerMsg.includes('费率') || lowerMsg.includes('维保率')) {
    const category = message.replace(/.*?(费率|维保率).*?/, '').trim() || '设备';
    return { skill: 'maintenance_rate_query', params: { category } };
  }

  // 报价计算
  if (lowerMsg.includes('计算') && (lowerMsg.includes('报价') || lowerMsg.includes('维保'))) {
    const params: Record<string, unknown> = {};

    // 尝试提取数量
    const qtyMatch = message.match(/(\d+)\s*[台套个]/);
    if (qtyMatch) params.quantity = parseInt(qtyMatch[1]);

    // 尝试提取年限
    const yearMatch = message.match(/(\d+)\s*年/);
    if (yearMatch) params.years = parseInt(yearMatch[1]);

    // 尝试提取价格
    const priceMatch = message.match(/(\d+(?:\.\d+)?)\s*万/);
    if (priceMatch) params.original_price = parseFloat(priceMatch[1]) * 10000;

    // 尝试提取设备名称
    const nameMatch = message.match(/(?:计算|报价).*?([\u4e00-\u9fa5]{2,})/);
    if (nameMatch) params.device_name = nameMatch[1];

    return { skill: 'quote_calculation', params };
  }

  // 系统介绍
  if (lowerMsg.includes('功能') || lowerMsg.includes('介绍') || lowerMsg.includes('帮助') || lowerMsg.includes('怎么用') || lowerMsg.includes('使用')) {
    return { skill: 'system_guide', params: {} };
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as { message?: string; session_id?: string | null; history?: Array<{ role: string; content: string }> };
    const message = body.message?.trim();
    const sessionId = body.session_id || null;
    const history = body.history || [];

    if (!message) {
      return NextResponse.json({ success: false, error: '消息不能为空' }, { status: 400 });
    }

    const agents = await pool.execute('SELECT * FROM agent_configs WHERE id = ? AND enabled = 1', [id]);
    const agent = (agents[0] as Array<Record<string, unknown>>)?.[0];
    if (!agent) {
      return NextResponse.json({ success: false, error: '智能体不存在或未启用' }, { status: 404 });
    }

    const userId = auth.session.userId ?? -1;
    const userName = auth.session.name || auth.session.username || '用户';

    const finalSessionId = sessionId || `sess_${crypto.randomUUID()}`;
    const firstLine = message.slice(0, 30);

    if (sessionId) {
      const existingResult = await pool.execute(
        'SELECT user_id, agent_id FROM agent_sessions WHERE session_id = ? AND is_deleted = 0',
        [sessionId],
      );
      const existing = (existingResult[0] as Array<{ user_id: number; agent_id: number }>)[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
      }
      if (auth.session.role !== 'admin' && existing.user_id !== userId) {
        return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
      }
      if (Number(existing.agent_id) !== Number(id)) {
        return NextResponse.json(
          { success: false, error: '该会话不属于当前智能体' },
          { status: 409 },
        );
      }
      await pool.execute(
        `UPDATE agent_sessions
         SET last_message = ?, last_message_at = datetime('now'),
             updated_at = datetime('now'), message_count = message_count + 1
         WHERE session_id = ?`,
        [firstLine, sessionId],
      );
    } else {
      await pool.execute(
        `INSERT INTO agent_sessions (session_id, agent_id, user_id, user_name, title, last_message, message_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [finalSessionId, id, userId, userName, firstLine, firstLine],
      );
    }

    // 获取启用的技能
    const skills = await pool.execute(
      'SELECT * FROM agent_skills WHERE agent_id = ? AND enabled = 1',
      [id]
    );
    const skillList = (skills[0] as Array<Record<string, unknown>>) || [];

    // 检测意图并执行技能
    const intent = detectIntent(message);
    let skillResult = '';

    if (intent && skillList.some(s => s.skill_name === intent.skill)) {
      const executor = skillExecutors[intent.skill];
      if (executor) {
        try {
          skillResult = await executor(intent.params);
        } catch (e) {
          console.error('技能执行失败:', e);
        }
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 发送开始事件
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'start', session_id: finalSessionId })}\n\n`
        ));

        // 发送技能执行结果（作为上下文）
        if (skillResult) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'skill', skill: intent?.skill, result: skillResult })}\n\n`
          ));
        }

        // 尝试调用AI模型
        const aiConfig = await getActiveAIModelConfig();
        let fullAiResponse = ''; // 收集完整AI回复用于日志记录

        if (aiConfig) {
          // 构建AI对话消息
          const aiMessages: Array<{ role: string; content: string }> = [
            { role: 'system', content: ITS_SYSTEM_PROMPT },
          ];

          // 添加技能执行结果作为上下文
          if (skillResult) {
            aiMessages.push({
              role: 'system',
              content: `用户查询触发了技能"${intent?.skill}"，执行结果如下，请基于此结果回答用户问题：\n\n${skillResult}`
            });
          }

          // 添加历史对话（最多保留最近10轮）
          const recentHistory = history.slice(-10);
          for (const msg of recentHistory) {
            aiMessages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }

          // 添加当前用户消息
          aiMessages.push({ role: 'user', content: message });

          try {
            // 调用AI模型（流式）
            const aiResponse = await fetch(aiConfig.api_endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${aiConfig.api_key}`,
              },
              body: JSON.stringify({
                model: aiConfig.model_name,
                messages: aiMessages,
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.max_tokens,
                stream: true,
              }),
            });

            if (aiResponse.ok && aiResponse.body) {
              const reader = aiResponse.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith('data:')) continue;
                  const data = trimmed.slice(5).trim();
                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullAiResponse += delta;
                      controller.enqueue(encoder.encode(
                        `data: ${JSON.stringify({ type: 'content', content: delta })}\n\n`
                      ));
                    }
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            } else {
              // AI调用失败，回退到技能结果
              if (skillResult) {
                fullAiResponse = skillResult;
                const words = skillResult.split(/(?<=[\u4e00-\u9fa5])|(?<=\s+)/);
                for (const word of words) {
                  if (word.trim()) {
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'content', content: word })}\n\n`
                    ));
                  }
                }
              } else {
                fullAiResponse = '抱歉，AI服务暂时不可用。请检查AI模型配置或稍后重试。';
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'content', content: fullAiResponse })}\n\n`
                ));
              }
            }
          } catch (aiError) {
            console.error('AI调用失败:', aiError);
            if (skillResult) {
              fullAiResponse = skillResult;
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'content', content: skillResult })}\n\n`
              ));
            } else {
              fullAiResponse = '抱歉，AI服务调用失败，请稍后重试。';
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'content', content: fullAiResponse })}\n\n`
              ));
            }
          }
        } else {
          // 没有AI配置，使用技能结果或默认回复
          const fallbackResponse = skillResult || `我理解您的问题："${message}"\n\n作为ITS报价系统智能助手，我可以帮助您：\n- 查询设备定额和单价\n- 查询维保费率配置\n- 计算维保报价\n- 查看报价记录\n- 介绍系统功能\n\n请告诉我您需要什么帮助？\n\n> 提示：配置AI模型后可获得更智能的回复。`;

          fullAiResponse = fallbackResponse;
          const words = fallbackResponse.split(/(?<=[\u4e00-\u9fa5])|(?<=\s+)/);
          for (const word of words) {
            if (word.trim()) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'content', content: word })}\n\n`
              ));
            }
          }
        }

        // 记录日志（使用完整的AI回复）
        await pool.execute(
          `INSERT INTO agent_logs (user_id, agent_id, session_id, user_message, agent_response, actions_executed)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            id,
            finalSessionId,
            message,
            fullAiResponse || skillResult || '无回复',
            JSON.stringify(intent ? [intent.skill] : []),
          ]
        );

        // 发送结束事件
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'end' })}\n\n`
        ));

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('智能体对话错误:', error);
    return NextResponse.json({ success: false, error: '对话失败' }, { status: 500 });
  }
}
