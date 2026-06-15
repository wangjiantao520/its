'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpeechRecognition } from '@/hooks/use-ai-assistant';
import { toast } from 'sonner';

interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInput({ onResult, disabled, className }: VoiceInputProps) {
  const { isListening, transcript, error, isSupported, start, stop, reset } = useSpeechRecognition();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    if (isListening) {
      setPulse(true);
    } else {
      setPulse(false);
      if (transcript && transcript.trim()) {
        onResult(transcript);
        reset();
      }
    }
  }, [isListening, transcript, isSupported]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleToggle = () => {
    if (!isSupported) {
      toast.error('当前浏览器不支持语音识别，请使用 Chrome、Edge 或 Safari');
      return;
    }

    if (isListening) {
      stop();
    } else {
      start('zh-CN');
    }
  };

  if (!isSupported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        className={className}
        title="当前浏览器不支持语音识别"
      >
        <MicOff className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="icon"
        onClick={handleToggle}
        disabled={disabled}
        className={`${className} ${isListening ? 'animate-pulse' : ''}`}
        title={isListening ? '点击停止录音' : '点击开始语音输入'}
      >
        {isListening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {isListening && (
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 shadow-lg">
          🎤 正在录音中...再次点击结束
        </div>
      )}
      {pulse && (
        <span className="absolute top-0 right-0 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}
    </div>
  );
}
