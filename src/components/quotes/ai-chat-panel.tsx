'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Send, User, Bot, CheckCircle, AlertCircle } from 'lucide-react';
import { parseQuoteWithHistory, AI_QUOTE_EXAMPLES, type AiQuoteDraft, type ChatMessage, formatPrice } from '@/lib/ai-quote-parser';

interface AiChatPanelProps {
  onApply: (draft: AiQuoteDraft) => void;
  onClose: () => void;
}

export function AiChatPanel({ onApply, onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<AiQuoteDraft | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // 调用 AI
      const draft = await parseQuoteWithHistory(userMessage, messages);

      // 添加 AI 消息
      const aiMessage = formatDraftToMessage(draft);
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);

      // 保存当前草案
      setCurrentDraft(draft);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，AI服务暂时不可用，请稍后重试。'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化草案为可读消息
  const formatDraftToMessage = (draft: AiQuoteDraft): string => {
    let message = '';

    // 识别状态
    if (draft.error) {
      return `❌ ${draft.error}`;
    }

    message += '✅ 已识别您的需求：\n\n';

    // 基本信息
    if (draft.region) {
      message += `📍 服务地区：${draft.region}\n`;
    }
    if (draft.contractYears) {
      message += `📅 合同年限：${draft.contractYears}年\n`;
    }
    if (draft.serviceMode) {
      message += `🔧 服务模式：${draft.serviceMode}\n`;
    }
    if (draft.serviceTime) {
      message += `⏰ 服务时间：${draft.serviceTime}\n`;
    }
    if (draft.responseTime) {
      message += `⚡ 响应时间：${draft.responseTime}\n`;
    }
    if (draft.arrivalTime) {
      message += `🚗 到场时间：${draft.arrivalTime}\n`;
    }
    if (draft.annualInspectionCount) {
      message += `🔍 年度巡检：${draft.annualInspectionCount}次\n`;
    }

    // 设备列表
    if (draft.devices.length > 0) {
      message += '\n📋 识别到的设备：\n';
      draft.devices.forEach((device, idx) => {
        message += `   ${idx + 1}. ${device.quantity || 1}台 ${device.deviceName || '未知设备'}`;
        if (device.useYears) {
          message += `（使用${device.useYears}年）`;
        }
        if (device.confidence && device.confidence < 0.8) {
          message += ' ⚠️';
        }
        message += '\n';
      });
    }

    // 价格预估
    if (draft.estimatedPriceRange) {
      message += `\n💰 预估价格范围：${formatPrice(draft.estimatedPriceRange.min)} - ${formatPrice(draft.estimatedPriceRange.max)} ${draft.estimatedPriceRange.unit}\n`;
    }

    // 缺失信息
    if (draft.missingFields.length > 0) {
      message += `\n❓ 需要补充的信息：\n`;
      draft.suggestions.forEach(suggestion => {
        message += `   • ${suggestion}\n`;
      });
    }

    // 追问
    if (draft.missingFields.length > 0 && draft.devices.length > 0) {
      message += '\n请告诉我更多信息，我会帮您完善报价方案。';
    } else if (draft.devices.length > 0) {
      message += '\n如果信息准确，可以点击"应用到报价单"继续。';
    }

    return message;
  };

  // 使用示例
  const handleUseExample = (example: string) => {
    setInputText(example);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI 智能报价助手
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 示例提示 */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">试试这样说：</span>
          {AI_QUOTE_EXAMPLES.map((example, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => handleUseExample(example)}
              className="text-xs h-7"
            >
              示例{idx + 1}
            </Button>
          ))}
        </div>

        {/* 消息列表 */}
        <ScrollArea className="h-[400px] border rounded-lg p-4 bg-slate-50" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>您好！我是 AI 报价助手</p>
              <p className="text-sm mt-2">请描述您的维保需求，我会帮您生成报价方案</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border shadow-sm'
                    }`}
                  >
                    <pre className={`whitespace-pre-wrap text-sm font-sans ${message.role === 'user' ? '' : ''}`}>
                      {message.content}
                    </pre>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="bg-white border rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* 输入框 */}
        <div className="flex gap-2">
          <Input
            placeholder="请描述您的维保需求..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={!inputText.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 操作按钮 */}
        {currentDraft && currentDraft.devices.length > 0 && (
          <div className="flex justify-center">
            <Button onClick={() => onApply(currentDraft)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              应用到报价单
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
