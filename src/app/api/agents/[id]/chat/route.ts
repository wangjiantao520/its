import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool } from '@/lib/db';

// 简单的技能执行器
const skillExecutors: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
  // 定额查询
  quota_query: async (params) => {
    const keyword = (params.keyword as string) || '';
    const devices = await pool.execute(
      'SELECT * FROM device_quotas WHERE name LIKE ? OR category LIKE ? LIMIT 10',
      [`%${keyword}%`, `%${keyword}%`]
    );
    const deviceList = devices[0] as Array<Record<string, unknown>>;
    if (!deviceList || deviceList.length === 0) {
      return `未找到与"${keyword}"相关的设备定额信息。`;
    }
    const list = deviceList.map((d) => 
      `- ${d.name}（${d.category}）：中标单价 ¥${(Number(d.original_price) / 10000).toFixed(2)}万`
    ).join('\n');
    return `查询到以下设备定额信息：\n${list}`;
  },
  
  // 维保费率查询
  maintenance_rate_query: async (params) => {
    const category = (params.category as string) || '';
    const rates = await pool.execute(
      'SELECT * FROM maintenance_rate_config WHERE category LIKE ? LIMIT 10',
      [`%${category}%`]
    );
    const rateList = rates[0] as Array<Record<string, unknown>>;
    if (!rateList || rateList.length === 0) {
      return `未找到与"${category}"相关的维保费率配置。`;
    }
    const list = rateList.map((r) => 
      `- ${r.category}：维保率 ${(Number(r.maintenance_rate) * 100).toFixed(1)}%`
    ).join('\n');
    return `查询到以下维保费率配置：\n${list}`;
  },
  
  // 报价计算
  quote_calculation: async (params) => {
    const deviceName = (params.device_name as string) || '';
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
- 年维保费：¥${annualFee.toLocaleString()}（费率 ${(maintenanceRate * 100).toFixed(1)}%）
- 三年维保费：¥${threeYearFee.toLocaleString()}`;
  },
  
  // 系统功能介绍
  system_guide: async () => {
    return `ITS报价系统功能介绍：

1. **工程报价**：基于自施工定额和智能化定额进行工程报价
2. **维保报价**：基于设备维保定额库进行维保报价
3. **设备清单导入**：支持Excel/CSV文件导入设备清单
4. **基础数据管理**：管理设备定额、维保费率、SLA配置等
5. **数据看板**：查看所有成员的报价记录和统计数据

您可以问我：
- "帮我查询交换机的定额"
- "计算一台服务器的维保报价"
- "系统的维保费率是多少"
- "如何使用这个系统"`;
  }
};

// 简单的意图识别
function detectIntent(message: string): { skill: string; params: Record<string, unknown> } | null {
  const lowerMsg = message.toLowerCase();
  
  // 定额查询
  if (lowerMsg.includes('定额') || lowerMsg.includes('单价') || lowerMsg.includes('价格')) {
    const keyword = message.replace(/.*?(定额|单价|价格).*?/, '').trim() || '设备';
    return { skill: 'quota_query', params: { keyword } };
  }
  
  // 维保费率查询
  if (lowerMsg.includes('费率') || lowerMsg.includes('维保率')) {
    const category = message.replace(/.*?(费率|维保率).*?/, '').trim() || '设备';
    return { skill: 'maintenance_rate_query', params: { category } };
  }
  
  // 报价计算
  if (lowerMsg.includes('计算') && (lowerMsg.includes('报价') || lowerMsg.includes('维保'))) {
    return { skill: 'quote_calculation', params: { 
      device_name: '设备', 
      original_price: 100000, 
      maintenance_rate: 0.05 
    }};
  }
  
  // 系统介绍
  if (lowerMsg.includes('功能') || lowerMsg.includes('介绍') || lowerMsg.includes('帮助') || lowerMsg.includes('怎么用')) {
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
    const body = (await request.json()) as { message?: string; session_id?: string | null };
    const message = body.message?.trim();
    const sessionId = body.session_id || null;
    
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
        skillResult = await executor(intent.params);
      }
    }
    
    // 生成回复
    const response = skillResult || `我理解您的问题："${message}"\n\n作为ITS报价系统智能助手，我可以帮助您：
- 查询设备定额和单价
- 查询维保费率配置
- 计算维保报价
- 介绍系统功能

请告诉我您需要什么帮助？`;
    
    // 记录日志
    await pool.execute(
      `INSERT INTO agent_logs (user_id, agent_id, session_id, user_message, agent_response, actions_executed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        id,
        finalSessionId,
        message,
        response,
        JSON.stringify(intent ? [intent.skill] : []),
      ]
    );
    
    // 返回SSE流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 发送开始事件
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'start', session_id: finalSessionId })}\n\n`
        ));
        
        // 发送技能执行结果
        if (skillResult) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'skill', skill: intent?.skill, result: skillResult })}\n\n`
          ));
        }
        
        // 分块发送回复内容
        const words = response.split(/(?<=[\u4e00-\u9fa5])|(?<=\s+)/);
        for (const word of words) {
          if (word.trim()) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'content', content: word })}\n\n`
            ));
          }
        }
        
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
