'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, Search, Calculator, TrendingUp, History, Database, Settings, Paperclip } from 'lucide-react';
import { createAssistantStreamParser } from '@/lib/assistant-stream';
import { extractFileContent, buildFilePrompt } from '@/lib/file-content';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  session_id: string;
  title: string;
  last_message: string;
  updated_at: string;
}

const QUICK_PROMPTS = [
  { icon: Search, label: '查询交换机定额' },
  { icon: Calculator, label: '计算服务器维保报价' },
  { icon: TrendingUp, label: '查询网络设备费率' },
  { icon: History, label: '查看最近报价记录' },
  { icon: Database, label: '查询摄像机价格' },
  { icon: Settings, label: '系统功能介绍' },
];

export function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading || isReadingFile) return;
    setIsReadingFile(true);
    try {
      const result = await extractFileContent(file);
      if (!result.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${result.error}` }]);
        return;
      }
      await handleSend(buildFilePrompt(result.label, result.content), file.name);
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (overrideInput?: string, fileLabel?: string) => {
    const textToSend = overrideInput ?? input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: textToSend.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agents/1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          session_id: currentSessionId,
          history: [...messages, userMessage].slice(-10),
        }),
      });
      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let streamError = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const parser = createAssistantStreamParser((event) => {
        if (event.type === 'start') {
          setCurrentSessionId(event.session_id);
        } else if (event.type === 'content') {
          assistantMessage += event.content;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
            return updated;
          });
        } else if (event.type === 'error') {
          streamError = event.error;
        }
      });

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode());
        parser.finish();
      }
      if (streamError) throw new Error(streamError);
    } catch (error) {
      setMessages((prev) => {
        const fallback: Message = { role: 'assistant', content: '抱歉，处理您的请求时出现错误，请稍后重试。' };
        if (prev.at(-1)?.role === 'assistant' && !prev.at(-1)?.content) {
          return [...prev.slice(0, -1), fallback];
        }
        return [...prev, fallback];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          AI 智能助手
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          和 DeepSeek 对话，查询定额、计算报价、了解系统
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] border rounded-lg p-4 mb-3 bg-muted/20">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">您好！我是 AI 报价助手</p>
              <p className="text-xs mt-1">可以问我设备定额、维保报价、系统功能等</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {QUICK_PROMPTS.map(({ icon: Icon, label }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSend(label)}
                    className="text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans">{msg.content || ' '}</pre>
                  </div>
                </div>
              ))}
              {isLoading && messages.at(-1)?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-card border rounded-xl">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isReadingFile}
            title="上传文件（txt/csv/xlsx）"
          >
            {isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input
            placeholder="输入您的问题，如「查询交换机的定额」..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={isLoading}
          />
          <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.md,.json,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <p className="text-xs text-muted-foreground/60 text-center mt-2">
          AI 生成内容仅供参考 · Enter 发送 · 可上传文件让 AI 分析
        </p>
      </CardContent>
    </Card>
  );
}
