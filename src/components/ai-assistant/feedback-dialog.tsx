'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAIFeedback, type AIParseResult } from '@/hooks/use-ai-assistant';
import { toast } from 'sonner';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalText: string;
  aiResult: AIParseResult | null;
  clientName?: string;
  onSuccess?: () => void;
}

const FEEDBACK_TYPES = [
  { value: 'wrong_match', label: '设备型号匹配错误' },
  { value: 'wrong_quantity', label: '数量识别错误' },
  { value: 'missing_info', label: '缺少设备信息' },
  { value: 'extra_info', label: '多识别了设备' },
  { value: 'other', label: '其他问题' },
] as const;

export function FeedbackDialog({
  open,
  onOpenChange,
  originalText,
  aiResult,
  clientName,
  onSuccess,
}: FeedbackDialogProps) {
  const [feedbackType, setFeedbackType] = useState<typeof FEEDBACK_TYPES[number]['value']>('wrong_match');
  const [comment, setComment] = useState('');
  const { submit, submitting } = useAIFeedback();

  const handleSubmit = async () => {
    const success = await submit({
      originalText,
      aiResult: aiResult ?? null,
      feedbackType,
      feedbackComment: comment,
      clientName,
    });
    if (success) {
      toast.success('反馈已提交，AI将学习避免类似错误');
      onOpenChange(false);
      setComment('');
      onSuccess?.();
    } else {
      toast.error('反馈提交失败，请重试');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            AI识别反馈
          </DialogTitle>
          <DialogDescription>
            您的反馈将帮助AI学习改进，避免下次出现同样错误
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>问题类型</Label>
            <div className="grid grid-cols-1 gap-2">
              {FEEDBACK_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFeedbackType(t.value)}
                  className={`text-left px-3 py-2 rounded border text-sm transition-colors ${
                    feedbackType === t.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {feedbackType === t.value && <Check className="inline h-3 w-3 mr-1" />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">详细说明（可选）</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请描述哪里识别错误，以及正确的应该是什么..."
              rows={4}
            />
          </div>

          {originalText && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">查看原始输入</summary>
              <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                {originalText}
              </pre>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '提交反馈'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FeedbackButtonsProps {
  onPositive: () => void;
  onNegative: () => void;
  className?: string;
}

export function FeedbackButtons({ onPositive, onNegative, className }: FeedbackButtonsProps) {
  const [rated, setRated] = useState<'up' | 'down' | null>(null);

  const handleUp = () => {
    setRated('up');
    onPositive();
    setTimeout(() => setRated(null), 2000);
  };

  const handleDown = () => {
    setRated('down');
    onNegative();
  };

  return (
    <div className={`flex gap-1 ${className}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleUp}
        className={rated === 'up' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}
        title="识别准确"
      >
        {rated === 'up' ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDown}
        className={rated === 'down' ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}
        title="识别有误"
      >
        {rated === 'down' ? <X className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
      </Button>
    </div>
  );
}
