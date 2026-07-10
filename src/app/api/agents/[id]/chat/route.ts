import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { createLLMClient } from 'coze-coding-dev-sdk';

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

    // 创建LLM客户端
    const client = createLLMClient({
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
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
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
