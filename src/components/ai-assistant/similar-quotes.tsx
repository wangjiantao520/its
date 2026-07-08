'use client';

import { useState, useEffect } from 'react';
import { History, Star, Package, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSimilarQuotes, type SimilarQuote, type AIDevice } from '@/hooks/use-ai-assistant';
import { toast } from 'sonner';

interface SimilarQuotesProps {
  clientName?: string;
  clientId?: number;
  deviceName?: string;
  onApply?: (device: AIDevice) => void;
  className?: string;
}

export function SimilarQuotes({
  clientName,
  clientId,
  deviceName,
  onApply,
  className,
}: SimilarQuotesProps) {
  const { recommendations, loading, fetch } = useSimilarQuotes();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (clientName || clientId || deviceName) {
      fetch({ clientName, clientId, deviceName, limit: 5 });
    }
  }, [clientName, clientId, deviceName, fetch]);

  if (!clientName && !clientId && !deviceName) return null;
  if (!loading && recommendations.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              相似历史报价
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              基于{clientName ? `客户「${clientName}」` : deviceName ? `设备「${deviceName}」` : '您的历史数据'}的推荐
            </CardDescription>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recommendations.slice(0, expanded ? undefined : 3).map((rec, i) => {
          const data = typeof rec.device_data === 'string' ? JSON.parse(rec.device_data) : rec.device_data;
          return (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {data.deviceName || rec.device_signature.split('::')[0]}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    x{data.quantity || 1}
                  </Badge>
                  {rec.occurrence > 1 && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {rec.occurrence}次
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  客户: {rec.client_name || '未知'} · 时间: {new Date(rec.created_at).toLocaleDateString()}
                </div>
              </div>
              {onApply && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onApply(data);
                    toast.success('已应用历史配置');
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-700"
                >
                  复用
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}

        {recommendations.length > 3 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full"
          >
            {expanded ? '收起' : `查看更多 (${recommendations.length - 3})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
