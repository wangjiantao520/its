'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Send, Paperclip, Loader2, MessageSquare, Calculator, FileText, Wrench, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Agent {
  id: number;
  name: string;
  description: string;
  enabled: number;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessionId, setSessionId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAgent();
    generateSessionId();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAgent = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const agents = await res.json();
        const enabledAgent = agents.find((a: Agent) => a.enabled === 1);
        if (enabledAgent) {
          setAgent(enabledAgent);
        }
      }
    } catch (error) {
      console.error('加载智能体失败:', error);
    }
  };

  const generateSessionId = () => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(id);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !agent) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          session_id: sessionId,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('请求失败');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'chunk' && parsed.content) {
                  assistantContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                } else if (parsed.type === 'error') {
                  toast({ title: '错误', description: parsed.error, variant: 'destructive' });
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      toast({ title: '发送失败', description: '请稍后重试', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: '帮我识别设备清单', icon: '📋' },
    { label: '计算维保报价', icon: '💰' },
    { label: '计算工程报价', icon: '🏗️' },
    { label: '查询设备定额', icon: '📊' },
    { label: '解释报价公式', icon: '📝' },
    { label: '生成报价报告', icon: '📄' },
  ];

  // 辅助报价功能
  const assistActions = [
    { 
      label: '工程报价', 
      icon: Calculator,
      description: '辅助创建工程报价单',
      prompt: '帮我创建一个工程报价单，我需要报价一个ICT项目'
    },
    { 
      label: '维保报价', 
      icon: Wrench,
      description: '辅助创建维保报价单',
      prompt: '帮我创建一个维保报价单，需要计算维保费用'
    },
    { 
      label: '设备识别', 
      icon: ClipboardList,
      description: '识别设备清单中的设备',
      prompt: '帮我识别设备清单中的设备，我会上传设备清单图片'
    },
    { 
      label: '定额查询', 
      icon: FileText,
      description: '查询设备定额信息',
      prompt: '帮我查询一下设备的定额信息'
    },
  ];

  return (
    <div className="container mx-auto p-6 h-[calc(100vh-2rem)]">
      <div className="fabric-card h-full flex flex-col bg-canvas-texture overflow-hidden">
        <div className="p-5 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a67c52] to-[#8b5a2b] flex items-center justify-center shadow-[0_2px_4px_rgba(61,44,30,0.15)]">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold font-serif">{agent?.name || 'ITS智能助手'}</h2>
              <p className="text-sm text-muted-foreground">
                {agent?.description || '我可以帮助您进行设备识别、报价计算、定额查询等操作'}
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="space-y-8">
                {/* 辅助报价功能区 */}
                <div>
                  <h3 className="text-lg font-medium mb-4 text-center font-serif">辅助报价功能</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {assistActions.map((action) => (
                      <div 
                        key={action.label} 
                        className="fabric-card cursor-pointer p-5 hover:-translate-y-1 hover:shadow-fabric transition-all duration-200 group"
                        onClick={() => setInput(action.prompt)}
                      >
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#f5efe3] to-[#ebe2d3] flex items-center justify-center group-hover:from-[#e8ddd0] group-hover:to-[#d9ccb8] transition-all duration-200 shadow-[inset_0_1px_2px_rgba(61,44,30,0.05)]">
                            <action.icon className="h-7 w-7 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{action.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 快捷对话区 */}
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-lg font-medium mb-2 font-serif">快捷对话</h3>
                  <p className="text-muted-foreground mb-4">
                    或者尝试以下快捷操作：
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickActions.map((action) => (
                      <Button
                        key={action.label}
                        variant="secondary"
                        size="sm"
                        onClick={() => setInput(action.label)}
                      >
                        <span className="mr-1">{action.icon}</span>
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#a67c52] to-[#8b5a2b] flex items-center justify-center flex-shrink-0 shadow-[0_2px_4px_rgba(61,44,30,0.15)]">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-3 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-[#a67c52] to-[#8b5a2b] text-white shadow-[0_2px_4px_rgba(61,44,30,0.15)]'
                      : 'bg-card border border-border/60 shadow-[0_1px_2px_rgba(61,44,30,0.06)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-1.5 ${
                    message.role === 'user' ? 'text-white/60' : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5efe3] to-[#ebe2d3] flex items-center justify-center flex-shrink-0 border border-border/60">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#a67c52] to-[#8b5a2b] flex items-center justify-center flex-shrink-0 shadow-[0_2px_4px_rgba(61,44,30,0.15)]">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-card border border-border/60 rounded-xl px-4 py-3 shadow-[0_1px_2px_rgba(61,44,30,0.06)]">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 flex-shrink-0 bg-card/50">
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" disabled>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入您的问题..."
              disabled={isLoading || !agent}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !agent}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {!agent && (
            <p className="text-sm text-muted-foreground text-center mt-3">
              暂无可用的智能体，请联系管理员配置
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
