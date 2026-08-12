/**
 * AI 辅助报价状态与处理器
 *
 * 从 maintenance/page.tsx 抽取，集中管理 AI 识别/匹配/文件上传等逻辑。
 * page.tsx 通过此 hook 获取所有 AI 相关状态与方法。
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { extractFileContent } from '@/lib/file-content';
import {
  parseQuoteRequirement,
  type AiQuoteDraft,
  type RecognitionStatus,
  type ChatMessage,
} from '@/lib/ai-quote-parser';
import {
  parseDevicesLocal,
  type LocalQuotaDevice,
} from '@/lib/local-device-parser';

/** AI 设备匹配结果项（/api/ai-match-devices 返回的单个设备） */
export interface AiMatchingCandidate {
  id: string;
  name: string;
  category: string;
  price: number;
  matchScore: number;
}

export interface AiMatchingDevice {
  matched: boolean;
  deviceName?: string;
  quantity?: number;
  model?: string;
  brand?: string;
  confidence: number;
  matchedDeviceName?: string;
  matchedDeviceId?: string;
  matchedPrice?: number;
  candidates?: AiMatchingCandidate[];
  [key: string]: unknown;
}

export interface UseAiQuoteReturn {
  // 输入与状态
  aiRequirementText: string;
  setAiRequirementText: (v: string) => void;
  aiRecognitionStatus: RecognitionStatus;
  aiDraft: AiQuoteDraft | null;
  showAiPreview: boolean;
  setShowAiPreview: (v: boolean) => void;
  showAiCompletionDialog: boolean;
  setShowAiCompletionDialog: (v: boolean) => void;
  completionDraft: AiQuoteDraft | null;
  setCompletionDraft: (v: AiQuoteDraft | null) => void;
  showAiChat: boolean;
  setShowAiChat: (v: boolean) => void;
  aiChatHistory: ChatMessage[];
  setAiChatHistory: (v: ChatMessage[]) => void;
  uploadedFileContent: string;
  uploadedFileName: string;
  aiMatchingDevices: AiMatchingDevice[];
  isAiMatching: boolean;
  setAiDraft: (v: AiQuoteDraft | null) => void;

  // 处理器
  handleAiParse: () => Promise<void>;
  handleAiMatchDevices: () => Promise<void>;
  handleClearAi: () => void;
  handleClearFile: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleUseExample: (example: string) => void;
}

export function useAiQuote(deviceQuotas: LocalQuotaDevice[] = []): UseAiQuoteReturn {
  const [aiRequirementText, setAiRequirementText] = useState('');
  const [aiRecognitionStatus, setAiRecognitionStatus] = useState<RecognitionStatus>('idle');
  const [aiDraft, setAiDraft] = useState<AiQuoteDraft | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [showAiCompletionDialog, setShowAiCompletionDialog] = useState(false);
  const [completionDraft, setCompletionDraft] = useState<AiQuoteDraft | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([]);
  const [uploadedFileContent, setUploadedFileContent] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [aiMatchingDevices, setAiMatchingDevices] = useState<AiMatchingDevice[]>([]);
  const [isAiMatching, setIsAiMatching] = useState(false);

  // 设备库是异步加载的，用 ref 保持 recognizeText 始终读到最新数据
  const deviceQuotasRef = useRef(deviceQuotas);
  useEffect(() => {
    deviceQuotasRef.current = deviceQuotas;
  }, [deviceQuotas]);

  /** 内部共用：识别需求文本并写入草稿（优先本地规则，秒级；本地无结果才回退 DeepSeek） */
  const recognizeText = async (text: string) => {
    let draft: AiQuoteDraft | null = null;

    // 1. 本地规则解析（用设备库做词典，不依赖 AI）
    const quotas = deviceQuotasRef.current;
    if (quotas.length > 0) {
      const local = parseDevicesLocal(text, quotas);
      if (local.devices.length > 0) {
        draft = {
          devices: local.devices.map((d) => ({
            rawText: d.rawText,
            deviceName: d.deviceName,
            model: d.model,
            brand: d.brand,
            quantity: d.quantity,
            useYears: d.useYears,
            confidence: d.confidence,
            matchedDeviceId: d.matchedDeviceId,
            matchedDeviceName: d.matchedDeviceName,
            warnings: d.warnings,
          })),
          missingFields: local.unmatchedText.length > 0 ? ['部分内容未识别'] : [],
          suggestions: local.suggestions,
        };
      }
    }

    // 2. 本地无结果时回退 DeepSeek
    if (!draft || draft.devices.length === 0) {
      draft = await parseQuoteRequirement(text);
    }

    setAiDraft(draft);
    setCompletionDraft(JSON.parse(JSON.stringify(draft)));
    setAiRecognitionStatus(
      draft.missingFields.length > 0 && draft.devices.length === 0 ? 'needs_info' : 'success'
    );
    setShowAiCompletionDialog(true);
  };

  const handleAiParse = async () => {
    if (!aiRequirementText.trim()) return;
    setAiRecognitionStatus('analyzing');
    try {
      await recognizeText(aiRequirementText);
    } catch (error) {
      console.error('AI解析失败:', error);
      setAiRecognitionStatus('failed');
    }
  };

  const handleAiMatchDevices = async () => {
    if (!aiRequirementText.trim()) return;
    setIsAiMatching(true);
    try {
      const response = await fetch('/api/ai-match-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiRequirementText }),
      });
      if (!response.ok) {
        // 避免 500 时 response.json() 抛错，先读取文本再尝试解析
        const raw = await response.text();
        let errorText = 'AI 服务暂时不可用，请稍后重试';
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed.error) errorText = parsed.error;
        } catch { /* 非 JSON 响应，用默认文案 */ }
        console.error('AI设备匹配失败:', errorText);
        toast.error(errorText);
        setAiRecognitionStatus('failed');
        return;
      }
      const result = await response.json();
      if (result.success) {
        setAiMatchingDevices(result.devices);
        setAiRecognitionStatus('success');
        if (result.devices && result.devices.length === 0) {
          toast.info('未识别到设备，请补充设备描述');
        }
      } else {
        console.error('AI设备匹配失败:', result.error);
        toast.error(result.error || 'AI 匹配失败，请稍后重试');
        setAiRecognitionStatus('failed');
      }
    } catch (error) {
      console.error('AI设备匹配失败:', error);
      toast.error('AI 匹配失败，请检查网络后重试');
      setAiRecognitionStatus('failed');
    } finally {
      setIsAiMatching(false);
    }
  };

  const handleClearAi = () => {
    setAiRequirementText('');
    setAiRecognitionStatus('idle');
    setAiDraft(null);
    setShowAiPreview(false);
    setUploadedFileContent('');
    setUploadedFileName('');
  };

  const handleClearFile = () => {
    setUploadedFileName('');
    setUploadedFileContent('');
    setAiRequirementText('');
    setAiRecognitionStatus('idle');
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setAiRecognitionStatus('recognizing');

    try {
      const extracted = await extractFileContent(file);
      if (!extracted.ok) {
        setAiRecognitionStatus('failed');
        toast.error(extracted.error);
        return;
      }
      setUploadedFileContent(extracted.content);

      const fullText = `从文件 ${file.name} 中提取的设备清单：\n\n${extracted.content}`;
      setAiRequirementText(fullText);

      try {
        await recognizeText(fullText);
      } catch (error) {
        console.error('AI解析失败:', error);
        setAiRecognitionStatus('failed');
      }
    } catch (error) {
      console.error('文件读取失败:', error);
      setAiRecognitionStatus('failed');
      toast.error('文件读取失败，请重试');
    }
  };

  const handleUseExample = (example: string) => {
    setAiRequirementText(example);
  };

  return {
    aiRequirementText,
    setAiRequirementText,
    aiRecognitionStatus,
    aiDraft,
    setAiDraft,
    showAiPreview,
    setShowAiPreview,
    showAiCompletionDialog,
    setShowAiCompletionDialog,
    completionDraft,
    setCompletionDraft,
    showAiChat,
    setShowAiChat,
    aiChatHistory,
    setAiChatHistory,
    uploadedFileContent,
    uploadedFileName,
    aiMatchingDevices,
    isAiMatching,
    handleAiParse,
    handleAiMatchDevices,
    handleClearAi,
    handleClearFile,
    handleFileUpload,
    handleUseExample,
  };
}
