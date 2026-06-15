'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ============ 类型定义 ============
export interface AIDevice {
  rawText?: string;
  deviceName: string;
  quantity: number;
  useYears?: number;
  underWarranty?: boolean;
  needSpareParts?: boolean;
  confidence?: number;
  warnings?: string[];
  // 前端扩展字段
  matchedPrice?: number;
  deviceCategory?: string;
  selected?: boolean;
}

export interface AIParseResult {
  customerName?: string;
  projectName?: string;
  region?: string;
  contractYears?: number;
  serviceMode?: string;
  responseTime?: string;
  arrivalTime?: string;
  serviceTime?: string;
  annualInspectionCount?: number;
  needSpareParts?: boolean;
  devices: AIDevice[];
  missingFields?: string[];
  suggestions?: string[];
  estimatedPriceRange?: { min: number; max: number; unit: string };
  quotaList?: unknown[];
  _meta?: {
    hasHistory?: boolean;
    hasFeedback?: boolean;
    timestamp?: string;
  };
}

export type FeedbackType = 'wrong_match' | 'missing_info' | 'extra_info' | 'wrong_quantity' | 'other';

export interface FeedbackData {
  originalText: string;
  aiResult: AIParseResult | null;
  correctedResult?: AIParseResult | null;
  feedbackType: FeedbackType;
  feedbackComment?: string;
  clientName?: string;
  operator?: string;
}

export interface SimilarQuote {
  client_name: string;
  device_signature: string;
  device_data: AIDevice[];
  quote_total: number;
  created_at: string;
  occurrence: number;
}

// ============ 语音识别 Hook ============
interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResultList {
  resultIndex: number;
  results: Array<{ isFinal: boolean; 0: SpeechRecognitionResultItem }>;
}
interface SpeechRecognitionEventError {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultList) => void) | null;
  onerror: ((event: SpeechRecognitionEventError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}
interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback((lang: string = 'zh-CN') => {
    if (!isSupported) {
      setError('当前浏览器不支持语音识别，请使用 Chrome、Edge 或 Safari');
      return;
    }

    setError(null);
    setTranscript('');

    const w = window as unknown as WindowWithSpeech;
    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionResultList) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }
      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionEventError) => {
      console.error('语音识别错误:', event.error);
      setError(`语音识别错误: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    start,
    stop,
    reset,
  };
}

// ============ AI解析 Hook（集成学习+推荐+价格同步）============
export function useAIParseQuote() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (
    text: string,
    options: {
      history?: Array<{ role: string; content: string }>;
      clientName?: string;
      clientId?: number;
    } = {}
  ): Promise<AIParseResult | null> => {
    if (!text.trim()) {
      setError('请输入需求描述');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-parse-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          history: options.history,
          clientName: options.clientName,
          clientId: options.clientId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'AI解析失败');
      }

      const result = await response.json();
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[useAIParseQuote] 失败:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { parse, loading, error };
}

// ============ 相似报价推荐 Hook ============
export function useSimilarQuotes() {
  const [recommendations, setRecommendations] = useState<SimilarQuote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = useCallback(async (params: {
    clientName?: string;
    clientId?: number;
    deviceName?: string;
    limit?: number;
  }): Promise<SimilarQuote[]> => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params.clientId) query.set('clientId', params.clientId.toString());
      else if (params.clientName) query.set('clientName', params.clientName);
      if (params.deviceName) query.set('deviceName', params.deviceName);
      if (params.limit) query.set('limit', params.limit.toString());

      const response: Response = await fetch(`/api/ai-recommend?${query}`);
      const data: { success: boolean; data?: SimilarQuote[] } = await response.json();
      if (data.success) {
        const items = data.data || [];
        setRecommendations(items);
        return items;
      }
      return [];
    } catch (e) {
      console.error('[useSimilarQuotes] 失败:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { recommendations, loading, fetch: fetchRecommendations };
}

// ============ AI反馈 Hook ============
export function useAIFeedback() {
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async (feedback: FeedbackData): Promise<boolean> => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      const data = await response.json();
      return data.success;
    } catch (e) {
      console.error('[useAIFeedback] 失败:', e);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting };
}

// ============ 价格同步 Hook ============
export function usePriceSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const sync = useCallback(async (
    devices: AIDevice[],
    options: {
      region?: string;
      serviceMode?: string;
      serviceTime?: string;
      needSpareParts?: boolean;
    } = {}
  ): Promise<{ min: number; max: number; unit: string } | null> => {
    setSyncing(true);
    try {
      const response = await fetch('/api/price-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devices,
          region: options.region || '城区',
          serviceMode: options.serviceMode || '远程',
          serviceTime: options.serviceTime || '5x8',
          needSpareParts: options.needSpareParts || false,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setLastSyncTime(new Date());
        return data.estimatedPriceRange;
      }
      return null;
    } catch (e) {
      console.error('[usePriceSync] 失败:', e);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { sync, syncing, lastSyncTime };
}

// ============ 设备合并工具 ============
export function mergeDevices(devices: AIDevice[]): AIDevice[] {
  const map = new Map<string, AIDevice>();

  devices.forEach(device => {
    const key = `${device.deviceName}::${device.useYears || 'unknown'}::${device.underWarranty ? 'w' : 'nw'}::${device.needSpareParts ? 'sp' : 'nsp'}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity = (existing.quantity || 0) + (device.quantity || 0);
    } else {
      map.set(key, { ...device, quantity: device.quantity || 1 });
    }
  });

  return Array.from(map.values());
}

// ============ 价格更新事件总线 ============
type PriceUpdateListener = (timestamp: number) => void;
const priceUpdateListeners = new Set<PriceUpdateListener>();

export function emitPriceUpdate() {
  const timestamp = Date.now();
  priceUpdateListeners.forEach(l => l(timestamp));
}

export function onPriceUpdate(listener: PriceUpdateListener) {
  priceUpdateListeners.add(listener);
  return () => priceUpdateListeners.delete(listener);
}

// ============ 完整AI辅助报价 Hook（一体化）============
export function useAIAssistant() {
  const { parse, loading: parseLoading, error: parseError } = useAIParseQuote();
  const { recommendations, loading: recommendLoading, fetch: fetchRecommendations } = useSimilarQuotes();
  const { submit: submitFeedback, submitting: feedbackSubmitting } = useAIFeedback();
  const { sync: syncPrice, syncing: priceSyncing, lastSyncTime } = usePriceSync();
  const speech = useSpeechRecognition();

  // 监听价格更新事件
  useEffect(() => {
    const unsubscribe = onPriceUpdate(() => {
      console.log('[useAIAssistant] 收到价格更新事件');
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    // AI解析
    parse,
    parseLoading,
    parseError,
    // 相似报价推荐
    recommendations,
    recommendLoading,
    fetchRecommendations,
    // 反馈
    submitFeedback,
    feedbackSubmitting,
    // 价格同步
    syncPrice,
    priceSyncing,
    lastSyncTime,
    // 语音识别
    speech,
  };
}
