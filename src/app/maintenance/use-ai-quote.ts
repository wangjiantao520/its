/**
 * AI 辅助报价状态与处理器
 *
 * 从 maintenance/page.tsx 抽取，集中管理 AI 识别/匹配/文件上传等逻辑。
 * page.tsx 通过此 hook 获取所有 AI 相关状态与方法。
 */

'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import {
  parseQuoteRequirement,
  type AiQuoteDraft,
  type RecognitionStatus,
  type ChatMessage,
} from '@/lib/ai-quote-parser';

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

export function useAiQuote(): UseAiQuoteReturn {
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

  /** 内部共用：识别需求文本并写入草稿 */
  const recognizeText = async (text: string) => {
    const draft = await parseQuoteRequirement(text);
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
      const result = await response.json();
      if (result.success) {
        setAiMatchingDevices(result.devices);
        setAiRecognitionStatus('success');
      } else {
        console.error('AI设备匹配失败:', result.error);
        setAiRecognitionStatus('failed');
      }
    } catch (error) {
      console.error('AI设备匹配失败:', error);
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
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          const textContent = (jsonData as unknown[][])
            .map((row: unknown[]) => (Array.isArray(row) ? row.join('\t') : String(row)))
            .join('\n');
          setUploadedFileContent(textContent);

          const fullText = `从文件 ${file.name} 中提取的设备清单：\n\n${textContent}`;
          setAiRequirementText(fullText);

          try {
            await recognizeText(fullText);
          } catch (error) {
            console.error('AI解析失败:', error);
            setAiRecognitionStatus('failed');
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          setUploadedFileContent(content);

          const fullText = `从文件 ${file.name} 中提取的设备清单：\n\n${content}`;
          setAiRequirementText(fullText);

          try {
            await recognizeText(fullText);
          } catch (error) {
            console.error('AI解析失败:', error);
            setAiRecognitionStatus('failed');
          }
        };
        reader.readAsText(file);
      } else {
        setAiRecognitionStatus('failed');
        toast.error('暂不支持该文件格式，请上传 .xlsx, .xls, .csv, .txt 或 .md 文件');
      }
    } catch (error) {
      console.error('文件读取失败:', error);
      setAiRecognitionStatus('failed');
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
