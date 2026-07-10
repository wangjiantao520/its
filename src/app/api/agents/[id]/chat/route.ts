import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { LLMClient } from 'coze-coding-dev-sdk';

// 技能执行器映射
const skillExecutors: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
  // 定额查询
  quota_query: async (params) => {
    const keyword = params.keyword as string || '';
    const [devices] = await pool.execute(
      'SELECT * FROM device_quotas WHERE name LIKE ? OR category LIKE ? LIMIT 10',
      [`%${keyword}%`, `%${keyword}%`]
    );
    if (!devices || devices.length === 0) {
      return `未找到与"${keyword}"相关的设备定额信息。`;
    }
    const list = devices.map((d: Record<string, unknown>) => 
      `- ${d.name}（${d.category}）：中标单价 ¥${(Number(d.original_price) / 10000).toFixed(2)}万`
    ).join('\n');
    return `查询到以下设备定额信息：\n${list}`;
  },
  
  // 维保费率查询
  maintenance_rate_query: async (params) => {
    const category = params.category as string || '';
    const [rates] = await pool.execute(
      'SELECT * FROM maintenance_rate_config WHERE category LIKE ? LIMIT 10',
      [`%${category}%`]
    );
    if (!rates || rates.length === 0) {
      return `未找到与"${category}"相关的维保费率配置。`;
    }
    const list = rates.map((r: Record<string, unknown>) => 
      `- ${r.category}：维保率 ${(Number(r.maintenance_rate) * 100).toFixed(1)}%`
    ).join('\n');
    return `查询到以下维保费率配置：\n${list}`;
  },
  
  // 报价计算
  quote_calculation: async (params) => {
    const deviceName = params.device_name as string || '';
    const originalPrice = Number(params.original_price) || 0;
    const maintenanceRate = Number(params.maintenance_rate) || 0.05;
    
    if (!deviceName || originalPrice <= 0) {
      return '请提供设备名称和原值进行报价计算。';
    }
    
    const annualFee = originalPrice * maintenanceRate;
    const threeYearFee = annualFee * 3;
    
    return `报价计算结果：
- 设备名称：${deviceName}
- 设备原值：¥${originalPrice.toLocaleString()}
- 维保率：${(maintenanceRate * 100).toFixed(1)}%
- 年维保费：¥${annualFee.toLocaleString()}
- 3年维保费：¥${threeYearFee.toLocaleString()}

注：实际报价可能因SLA等级、折旧程度等因素有所调整。`;
  },
  
  // 系统功能介绍
  system_guide: async () => {
    return `ITS报价系统功能介绍：

1. **工程报价**：基于自施工定额和智能化定额进行工程项目报价
2. **维保报价**：基于设备维保定额库进行维保服务报价
3. **设备清单导入**：支持从Excel文件导入设备清单
4. **基础数据管理**：管理定额库、维保费率、SLA配置等基础数据
5. **数据看板**：查看所有成员的报价记录和统计数据

您可以问我关于系统使用、报价计算、定额查询等问题。`;
  },
  
  // 默认：通用对话
  default: async () => {
    return '我理解了您的问题。作为ITS报价助手，我可以帮助您进行报价计算、定额查询、系统使用指导等。请告诉我具体需要什么帮助？';
  }
};

// 执行技能
async function executeSkill(skillName: string, params: Record<string, unknown>): Promise<string> {
  const executor = skillExecutors[skillName] || skillExecutors.default;
  return executor(params);
}

// POST /api/agents/[id]/chat - 智能体对话（流式）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { message, session_id, user_id } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: '消息不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取智能体配置
    const [agents] = await pool.execute(
      'SELECT * FROM agent_configs WHERE id = ? AND enabled = 1',
      [id]
    );

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ error: '智能体不存在或未启用' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const agent = agents[0];

    // 获取智能体技能
    const [skills] = await pool.execute(
      'SELECT * FROM agent_skills WHERE agent_id = ? AND enabled = 1 ORDER BY priority DESC',
      [id]
    );

    // 获取知识库
    const [knowledge] = await pool.execute(
      'SELECT * FROM agent_knowledge_base WHERE agent_id = ?',
      [id]
    );

    // 构建系统提示词
    let systemPrompt = agent.system_prompt;
    
    // 添加技能执行结果
    if (skillResult) {
      systemPrompt += `\n\n以下是系统查询结果，请基于这些信息回答用户：\n${skillResult}`;
    }
    
    // 添加技能信息
    if (skills && skills.length > 0) {
      const skillList = skills.map((s: any) => `- ${s.skill_name}: ${s.skill_type}`).join('\n');
      systemPrompt += `\n\n你可以使用以下技能：\n${skillList}`;
    }

    // 添加知识库信息
    if (knowledge && knowledge.length > 0) {
      const knowledgeList = knowledge.map((k: any) => `【${k.title}】${k.content}`).join('\n\n');
      systemPrompt += `\n\n参考资料：\n${knowledgeList}`;
    }

    // 关键词检测和技能执行
    let skillResult = '';
    const lowerMessage = message.toLowerCase();
    
    // 检测定额查询意图
    if (skills?.some((s: { skill_name: string }) => s.skill_name === 'quota_query') &&
        (lowerMessage.includes('定额') || lowerMessage.includes('单价') || lowerMessage.includes('设备价格'))) {
      const keyword = message.replace(/.*定额|单价|价格|是多少|查询|帮我|请/g, '').trim();
      skillResult = await executeSkill('quota_query', { keyword });
    }
    // 检测维保费率查询意图
    else if (skills?.some((s: { skill_name: string }) => s.skill_name === 'maintenance_rate_query') &&
        (lowerMessage.includes('维保率') || lowerMessage.includes('费率'))) {
      const category = message.replace(/.*维保率|费率|是多少|查询|帮我|请/g, '').trim();
      skillResult = await executeSkill('maintenance_rate_query', { category });
    }
    // 检测报价计算意图
    else if (skills?.some((s: { skill_name: string }) => s.skill_name === 'quote_calculation') &&
        (lowerMessage.includes('计算') || lowerMessage.includes('报价') || lowerMessage.includes('多少钱'))) {
      // 尝试从消息中提取数字
      const priceMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:万|元)?/);
      const originalPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
      skillResult = await executeSkill('quote_calculation', { 
        device_name: message, 
        original_price: originalPrice 
      });
    }
    // 检测系统介绍意图
    else if (skills?.some((s: { skill_name: string }) => s.skill_name === 'system_guide') &&
        (lowerMessage.includes('系统') || lowerMessage.includes('功能') || lowerMessage.includes('怎么用'))) {
      skillResult = await executeSkill('system_guide', {});
    }

    // 创建LLM客户端
    const client = new LLMClient({
      provider: 'doubao',
    });

    // 流式对话
    const stream = await client.chat.create({
      model: agent.model || 'doubao-seed-1-8-251228',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      stream: true,
      temperature: agent.temperature || 0.7,
    });

    // 创建ReadableStream用于SSE
    const encoder = new TextEncoder();
    let fullResponse = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
              );
            }
          }

          // 保存对话日志
          await pool.execute(
            `INSERT INTO agent_logs (user_id, agent_id, session_id, user_message, agent_response)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id || null, id, session_id || null, message, fullResponse]
          );

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('流式响应错误:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: '对话失败' })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('智能体对话失败:', error);
    return new Response(JSON.stringify({ error: '对话失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
