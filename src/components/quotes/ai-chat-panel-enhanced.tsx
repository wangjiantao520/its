'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Send, User, Bot, CheckCircle, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { VoiceInput } from '@/components/ai-assistant/voice-input';
import { SimilarQuotes } from '@/components/ai-assistant/similar-quotes';
import { FeedbackDialog, FeedbackButtons } from '@/components/ai-assistant/feedback-dialog';
import { DeviceTable } from '@/components/ai-assistant/device-table';
import { useAIAssistant, type AIDevice, type AIParseResult } from '@/hooks/use-ai-assistant';
import { toast } from 'sonner';

const AI_QUOTE_EXAMPLES = [
  '我需要为宁德移动ICT项目的30台台式电脑做3年的维保服务，城区，远程支持',
  '某银行20台笔记本和5台服务器，需要2年驻场维保，7x24服务',
  '县政府办公室15台台式电脑，使用3年，需要1年维保，包含备件',
];

interface AiChatPanelEnhancedProps {
  clientName?: string;
  clientId?: number;
  onApply: (result: AIParseResult) => void;
  onClose: () => void;
}

export function AiChatPanelEnhanced({ clientName, clientId, onApply, onClose }: AiChatPanelEnhancedProps) {
  const [inputText, setInputText] = useState('');
  const [currentResult, setCurrentResult] = useState<AIParseResult | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [showDeviceTable, setShowDeviceTable] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { parse, parseLoading, recommendations, fetchRecommendations, submitFeedback } = useAIAssistant();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // 当输入变化时，触发相似报价推荐
  useEffect(() => {
    if (clientName || clientId) {
      fetchRecommendations({ clientName, clientId, limit: 5 });
    }
  }, [clientName, clientId, fetchRecommendations]);

  const handleSend = async () => {
    if (!inputText.trim() || parseLoading) return;
    const text = inputText.trim();
    setInputText('');

    setChatHistory(prev => [...prev, { role: 'user', content: text }]);

    const result = await parse(text, {
      history: chatHistory,
      clientName,
      clientId,
    });

    if (result) {
      setCurrentResult(result);
      setChatHistory(prev => [...prev, { role: 'assistant', content: formatResultToText(result) }]);

      if (result.devices && result.devices.length > 0) {
        setShowDeviceTable(true);
        toast.success(`已识别 ${result.devices.length} 种设备`);
      }

      if (result._meta?.hasHistory) {
        toast.info('已加载客户历史偏好，AI识别更准确', { duration: 3000 });
      }
    } else {
      setChatHistory(prev => [...prev, { role: 'assistant', content: '抱歉，AI服务暂时不可用，请稍后重试。' }]);
    }
  };

  const handleVoiceResult = (text: string) => {
    setInputText(prev => prev ? `${prev} ${text}` : text);
  };

  const handlePositiveFeedback = () => {
    toast.success('感谢您的反馈！');
  };

  const handleNegativeFeedback = () => {
    setFeedbackOpen(true);
  };

  const handleApplySimilar = (device: AIDevice) => {
    if (!currentResult) {
      // 如果还没有结果，创建一个新的
      setCurrentResult({
        devices: [device],
        customerName: clientName,
      } as AIParseResult);
      setShowDeviceTable(true);
      return;
    }
    setCurrentResult({
      ...currentResult,
      devices: [...(currentResult.devices || []), device],
    });
    toast.success('已添加历史设备配置');
  };

  const handleDeviceChange = (devices: AIDevice[]) => {
    if (!currentResult) return;
    setCurrentResult({ ...currentResult, devices });
  };

  const handleApplyToQuote = () => {
    if (!currentResult || !currentResult.devices || currentResult.devices.length === 0) {
      toast.warning('暂无设备数据可应用');
      return;
    }
    onApply(currentResult);
    toast.success('已应用到报价单');
  };

  const formatResultToText = (result: AIParseResult): string => {
    let message = '✅ 已识别您的需求：\n\n';

    if (result.region) message += `📍 地区：${result.region}\n`;
    if (result.contractYears) message += `📅 合同年限：${result.contractYears}年\n`;
    if (result.serviceMode) message += `🔧 服务模式：${result.serviceMode}\n`;
    if (result.serviceTime) message += `⏰ 服务时间：${result.serviceTime}\n`;
    if (result.responseTime) message += `⚡ 响应时间：${result.responseTime}\n`;

    if (result.devices && result.devices.length > 0) {
      message += `\n📋 识别到 ${result.devices.length} 种设备：\n`;
      result.devices.forEach((device, idx) => {
        message += `   ${idx + 1}. ${device.quantity || 1}台 ${device.deviceName || '未知设备'}`;
        if (device.useYears) message += `（使用${device.useYears}年）`;
        if (device.confidence !== undefined && device.confidence < 0.8) message += ' ⚠️';
        message += '\n';
      });
    }

    if (result.estimatedPriceRange) {
      message += `\n💰 预估价格：¥${result.estimatedPriceRange.min} - ¥${result.estimatedPriceRange.max} ${result.estimatedPriceRange.unit}\n`;
    }

    if (result.missingFields && result.missingFields.length > 0) {
      message += `\n❓ 缺失字段：${result.missingFields.join('、')}\n`;
    }

    if (result._meta?.hasHistory) {
      message += '\n💡 已参考该客户的历史偏好\n';
    }

    return message;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI 智能报价助手
              {clientName && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  客户：{clientName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentResult && currentResult.devices && currentResult.devices.length > 0 && (
                <FeedbackButtons
                  onPositive={handlePositiveFeedback}
                  onNegative={handleNegativeFeedback}
                />
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                关闭
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 示例提示 */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">试试：</span>
            {AI_QUOTE_EXAMPLES.map((example, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => setInputText(example)}
                className="text-xs h-7"
              >
                示例{idx + 1}
              </Button>
            ))}
          </div>

          {/* 消息列表 */}
          <ScrollArea className="h-[350px] border rounded-lg p-4 bg-slate-50" ref={scrollRef}>
            {chatHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">您好！我是 AI 报价助手</p>
                <p className="text-sm mt-2">请描述您的维保需求，我会帮您生成报价方案</p>
                <p className="text-xs mt-2 text-blue-600">💡 支持语音输入，点击麦克风按钮</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((message, idx) => (
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
                        message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border shadow-sm'
                      }`}
                    >
                      <pre className="whitespace-pre-wrap text-sm font-sans">
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
                {parseLoading && (
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

          {/* 输入框 + 语音按钮 */}
          <div className="flex gap-2">
            <Input
              placeholder="请描述维保需求（支持语音输入）..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={parseLoading}
              className="flex-1"
            />
            <VoiceInput onResult={handleVoiceResult} disabled={parseLoading} />
            <Button onClick={handleSend} disabled={!inputText.trim() || parseLoading}>
              {parseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 相似历史报价推荐 */}
      {(clientName || clientId) && (
        <SimilarQuotes
          clientName={clientName}
          clientId={clientId}
          onApply={handleApplySimilar}
        />
      )}

      {/* 设备表格（可编辑） */}
      {showDeviceTable && currentResult && currentResult.devices && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">📝 设备清单（可编辑）</CardTitle>
          </CardHeader>
          <CardContent>
            <DeviceTable
              devices={currentResult.devices}
              onChange={handleDeviceChange}
            />
            {currentResult.estimatedPriceRange && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <span className="text-sm text-gray-600">预估价格范围：</span>
                <span className="text-lg font-bold text-blue-600">
                  ¥{currentResult.estimatedPriceRange.min.toLocaleString()} - ¥{currentResult.estimatedPriceRange.max.toLocaleString()}
                  <span className="text-xs text-gray-500 ml-1">{currentResult.estimatedPriceRange.unit}</span>
                </span>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeviceTable(false)}>
                隐藏
              </Button>
              <Button onClick={handleApplyToQuote} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                应用到报价单
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 反馈弹窗 */}
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        originalText={chatHistory.filter(m => m.role === 'user').slice(-1)[0]?.content || ''}
        aiResult={currentResult}
        clientName={clientName}
      />
    </div>
  );
}
