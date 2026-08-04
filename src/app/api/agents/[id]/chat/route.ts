import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool } from '@/lib/db';
import { getActiveAIModelConfig } from '@/lib/ai-config';
import { ITS_SYSTEM_PROMPT } from '@/lib/prompts/its-system-prompt';
import { skillExecutors } from '@/lib/agent-skills';
import { detectIntent } from '@/lib/agent-intent';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
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

    const userId = auth.session.userId ?? null;
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
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: '对话失败', detail: process.env.NODE_ENV === 'development' ? errMsg : undefined }, { status: 500 });
  }
}
