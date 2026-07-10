'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
    <div className="container mx-auto p-6 h-[calc(100vh-4rem)]">
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{agent?.name || 'ITS智能助手'}</CardTitle>
              <CardDescription>
                {agent?.description || '我可以帮助您进行设备识别、报价计算、定额查询等操作'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="space-y-8">
                {/* 辅助报价功能区 */}
                <div>
                  <h3 className="text-lg font-medium mb-4 text-center">辅助报价功能</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {assistActions.map((action) => (
                      <Card 
                        key={action.label} 
                        className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                        onClick={() => setInput(action.prompt)}
                      >
                        <CardContent className="pt-4 pb-4">
                          <div className="flex flex-col items-center text-center gap-2">
                            <div className="p-3 bg-primary/10 rounded-full">
                              <action.icon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{action.label}</p>
                              <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 快捷对话区 */}
                <div className="text-center py-6">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">快捷对话</h3>
                  <p className="text-muted-foreground mb-4">
                    或者尝试以下快捷操作：
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {quickActions.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        onClick={() => setInput(action.label)}
                      >
                        <span className="mr-2">{action.icon}</span>
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
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4">
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled>
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
            <p className="text-sm text-muted-foreground text-center mt-2">
              暂无可用的智能体，请联系管理员配置
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
