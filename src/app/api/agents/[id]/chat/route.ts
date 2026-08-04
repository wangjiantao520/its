import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { detectIntent } from '@/lib/agent-intent';
import { skillExecutors } from '@/lib/agent-skills';
import { getActiveAIModelConfig } from '@/lib/ai-config';
import { callAIModelWithConfig } from '@/lib/ai-model-client';
import { parsePositiveDatabaseId } from '@/lib/assistant-db';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { ITS_SYSTEM_PROMPT } from '@/lib/prompts/its-system-prompt';
import { validateBody } from '@/lib/api-validate';

interface RouteContext { params: Promise<{ id: string }> }
interface SessionOwnerRow extends Record<string, unknown> {
  user_id: string | number | bigint | null;
  user_name: string | null;
  agent_id: string | number | bigint | null;
}
type TerminalStatus = 'completed' | 'failed' | 'interrupted';

const chatSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  session_id: z.string().regex(/^sess_[A-Za-z0-9_-]{1,100}$/).nullable().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(100_000),
  })).max(100).optional().default([]),
});

function ownsSession(
  session: SessionOwnerRow,
  role: string,
  userId?: number,
  username?: string,
  name?: string,
): boolean {
  if (role === 'admin') return true;
  if (userId === undefined) return false;
  if (userId > 0) return String(session.user_id) === String(userId);
  return session.user_id === null && session.user_name === (username || name || '');
}

async function persistTerminal(
  database: DatabaseClient,
  input: {
    sessionId: string;
    existingSession: boolean;
    agentId: string;
    userId: string | number | bigint | null;
    userName: string;
    message: string;
    response: string;
    actions: string[];
    status: TerminalStatus;
    error: string | null;
  },
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (input.existingSession) {
      const locked = await transaction.query<SessionOwnerRow>(`
        SELECT user_id, user_name, agent_id FROM agent_sessions
        WHERE session_id=$1 AND is_deleted=false FOR UPDATE
      `, [input.sessionId]);
      const session = locked.rows[0];
      const ownerMismatch = !session
        || String(session.user_id) !== String(input.userId)
        || (input.userId === null && session.user_name !== input.userName);
      if (ownerMismatch || String(session.agent_id) !== input.agentId) {
        throw new Error('会话已不可用');
      }
      await transaction.query(`
        UPDATE agent_sessions
        SET last_message=$1, last_message_at=now(), updated_at=now(), message_count=message_count+1
        WHERE session_id=$2 RETURNING session_id
      `, [input.message.slice(0, 30), input.sessionId]);
    } else {
      await transaction.query(`
        INSERT INTO agent_sessions
          (session_id, agent_id, user_id, user_name, title, last_message, message_count,
           last_message_at, created_at, updated_at, is_deleted)
        VALUES ($1, $2, $3, $4, $5, $6, 1, now(), now(), now(), false)
        RETURNING session_id
      `, [input.sessionId, input.agentId, input.userId, input.userName, input.message.slice(0, 30), input.message.slice(0, 30)]);
    }
    await transaction.query(`
      INSERT INTO agent_logs
        (user_id, agent_id, session_id, user_message, agent_response, actions_executed)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id
    `, [
      input.userId,
      input.agentId,
      input.sessionId,
      input.message,
      input.response,
      JSON.stringify({ actions: input.actions, status: input.status, error: input.error }),
    ]);
  });
}

function fallbackResponse(message: string, skillResult: string): string {
  return skillResult || `我理解您的问题："${message}"\n\n作为ITS报价系统智能助手，我可以帮助您：\n- 查询设备定额和单价\n- 查询维保费率配置\n- 计算维保报价\n- 查看报价记录\n- 介绍系统功能\n\n请告诉我您需要什么帮助？\n\n> 提示：配置AI模型后可获得更智能的回复。`;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const agentId = parsePositiveDatabaseId((await context.params).id);
  if (!agentId) return NextResponse.json({ success: false, error: '无效的智能体ID' }, { status: 400 });
  const parsed = await validateBody(request, chatSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const database = getDatabase();
    const agents = await database.query<Record<string, unknown>>(
      'SELECT id FROM agent_configs WHERE id=$1 AND enabled=true', [agentId],
    );
    if (!agents.rows[0]) return NextResponse.json({ success: false, error: '智能体不存在或未启用' }, { status: 404 });

    const userId = auth.session.userId ?? null;
    const databaseUserId = userId !== null && userId > 0 ? userId : null;
    let persistenceUserId: string | number | bigint | null = databaseUserId;
    let persistenceUserName = databaseUserId === null
      ? auth.session.username || auth.session.name || '用户'
      : auth.session.name || auth.session.username || '用户';
    const requestedSessionId = parsed.data.session_id ?? null;
    if (requestedSessionId) {
      const existing = await database.query<SessionOwnerRow>(`
        SELECT user_id, user_name, agent_id FROM agent_sessions
        WHERE session_id=$1 AND is_deleted=false
      `, [requestedSessionId]);
      const session = existing.rows[0];
      if (!session) return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
      if (!ownsSession(session, auth.session.role, auth.session.userId, auth.session.username, auth.session.name)) {
        return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
      }
      if (String(session.agent_id) !== agentId) {
        return NextResponse.json({ success: false, error: '该会话不属于当前智能体' }, { status: 409 });
      }
      persistenceUserId = session.user_id;
      persistenceUserName = session.user_name || persistenceUserName;
    }

    const finalSessionId = requestedSessionId || `sess_${crypto.randomUUID()}`;
    const skills = await database.query<Record<string, unknown>>(
      'SELECT skill_name FROM agent_skills WHERE agent_id=$1 AND enabled=true ORDER BY priority DESC',
      [agentId],
    );
    const intent = detectIntent(parsed.data.message);
    let skillResult = '';
    if (intent && skills.rows.some((skill) => skill.skill_name === intent.skill)) {
      const executor = skillExecutors[intent.skill];
      if (executor) {
        try {
          skillResult = await executor(intent.params);
        } catch (error) {
          console.error('技能执行失败:', error);
        }
      }
    }

    const streamAbort = new AbortController();
    const abortFromRequest = () => streamAbort.abort();
    if (request.signal.aborted) streamAbort.abort();
    else request.signal.addEventListener('abort', abortFromRequest, { once: true });
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (event: Record<string, unknown>) => {
          if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        enqueue({ type: 'start', session_id: finalSessionId });
        if (skillResult) enqueue({ type: 'skill', skill: intent?.skill, result: skillResult });

        let responseText = '';
        let terminalStatus: TerminalStatus = 'completed';
        let terminalError: string | null = null;
        try {
          const aiConfig = await getActiveAIModelConfig(database);
          if (aiConfig) {
            const messages: Array<{ role: string; content: string }> = [
              { role: 'system', content: ITS_SYSTEM_PROMPT },
              ...parsed.data.history.slice(-10),
              { role: 'user', content: parsed.data.message },
            ];
            if (skillResult) {
              messages.splice(1, 0, {
                role: 'system',
                content: `用户查询触发了技能"${intent?.skill}"，执行结果如下：\n\n${skillResult}`,
              });
            }
            const result = await callAIModelWithConfig(aiConfig, messages, { signal: streamAbort.signal });
            if (!result.success || !result.content) {
              terminalStatus = result.error === 'AI请求已中断' ? 'interrupted' : 'failed';
              terminalError = result.error || 'AI服务返回格式异常';
            } else {
              responseText = result.content;
            }
          } else {
            responseText = fallbackResponse(parsed.data.message, skillResult);
          }
          if (cancelled || request.signal.aborted || streamAbort.signal.aborted) {
            terminalStatus = 'interrupted';
            terminalError = 'AI请求已中断';
            responseText = '';
          }
          await persistTerminal(database, {
            sessionId: finalSessionId,
            existingSession: Boolean(requestedSessionId),
            agentId,
            userId: persistenceUserId,
            userName: persistenceUserName,
            message: parsed.data.message,
            response: terminalStatus === 'completed' ? responseText : '',
            actions: intent ? [intent.skill] : [],
            status: terminalStatus,
            error: terminalError,
          });
          if (!cancelled) {
            if (terminalStatus === 'completed') {
              enqueue({ type: 'content', content: responseText });
              enqueue({ type: 'end' });
            } else {
              enqueue({ type: 'error', error: terminalError || '对话失败' });
            }
            controller.close();
          }
        } catch (error) {
          console.error('智能体对话流失败:', error);
          if (!cancelled) {
            enqueue({ type: 'error', error: '对话失败' });
            controller.close();
          }
        } finally {
          request.signal.removeEventListener('abort', abortFromRequest);
        }
      },
      cancel() {
        cancelled = true;
        streamAbort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('智能体对话错误:', error);
    return NextResponse.json({ success: false, error: '对话失败' }, { status: 500 });
  }
}
