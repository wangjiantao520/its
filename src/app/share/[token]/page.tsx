
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  generateEngineeringQuoteHTML,
  downloadAsPDF,
  convertToChineseCurrency,
  type EngineeringQuoteExportData,
} from '@/lib/export-utils';
import { Lock, Eye, FileDown, FileSpreadsheet, Loader2, ShieldCheck, Clock, AlertTriangle, LinkIcon, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ShareQuoteData {
  quote: {
    quote_number: string;
    project_name: string;
    client_name: string | null;
    contact_person: string | null;
    contact_phone: string | null;
    construction_area: number | null;
    management_rate: number;
    profit_rate: number;
    regulatory_rate: number;
    tax_rate: number;
    subtotal: number;
    management_fee: number;
    profit: number;
    regulatory_fee: number;
    tax: number;
    total: number;
    items: Array<{
      itemType: string;
      itemId: string;
      quantity: number;
      name: string;
      unit: string;
      price: number;
    }> | null;
    created_at: string;
  };
  shareInfo: {
    expiresAt: string | null;
    maxViews: number;
    viewCount: number;
  };
}

export default function ShareQuotePage() {
  const params = useParams();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [data, setData] = useState<ShareQuoteData | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const fetchData = useCallback(async (pwd?: string) => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    setNeedPassword(false);

    try {
      const options: RequestInit = {};
      if (pwd) {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({ password: pwd });
      }

      const response = await fetch(`/api/quote-shares/${token}`, options);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        buildPreview(result.data.quote);
      } else {
        if (result.code === 'PASSWORD_REQUIRED') {
          setNeedPassword(true);
        } else {
          setError(result.error || '获取报价单失败');
          setErrorCode(result.code || null);
        }
      }
    } catch (err) {
      console.error('获取分享报价单失败:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  const buildPreview = (quote: ShareQuoteData['quote']) => {
    const num = (v: any) => Number(v) || 0;
    const exportData: EngineeringQuoteExportData = {
      projectName: quote.project_name,
      clientName: quote.client_name || '',
      contactPerson: quote.contact_person || '',
      contactPhone: quote.contact_phone || '',
      quoteNumber: quote.quote_number,
      quoteDate: new Date(quote.created_at).toISOString().split('T')[0],
      items: (quote.items || []).map(item => ({
        name: item.name,
        unit: item.unit,
        quantity: num(item.quantity),
        unitPrice: num(item.price) * (1 + num(quote.management_rate) / 100 + num(quote.profit_rate) / 100 + num(quote.regulatory_rate) / 100),
        amount: num(item.price) * (1 + num(quote.management_rate) / 100 + num(quote.profit_rate) / 100 + num(quote.regulatory_rate) / 100) * num(item.quantity),
      })),
      rates: {
        managementRate: num(quote.management_rate),
        profitRate: num(quote.profit_rate),
        regulatoryRate: num(quote.regulatory_rate),
        taxRate: num(quote.tax_rate),
      },
      summary: {
        subtotal: num(quote.subtotal),
        managementFee: num(quote.management_fee),
        profit: num(quote.profit),
        regulatoryFee: num(quote.regulatory_fee),
        tax: num(quote.tax),
        grandTotal: num(quote.total),
        grandTotalRMB: convertToChineseCurrency(num(quote.total)),
      },
    };

    const html = generateEngineeringQuoteHTML(exportData);
    setPreviewHtml(html);
  };

  const handlePasswordVerify = async () => {
    if (!password.trim()) {
      toast.error('请输入访问密码');
      return;
    }
    setIsVerifying(true);
    await fetchData(password);
    setIsVerifying(false);
  };

  const handleExportPDF = async () => {
    if (!previewHtml) return;
    setIsExportingPDF(true);
    try {
      await downloadAsPDF(previewHtml, `工程报价单_${data?.quote.quote_number || 'share'}.pdf`);
      toast.success('PDF导出成功');
    } catch (err) {
      console.error('导出PDF失败:', err);
      toast.error('导出PDF失败');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportWord = () => {
    if (!previewHtml || !data) return;
    const blob = new Blob([previewHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `工程报价单_${data.quote.quote_number}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Word导出成功');
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-muted-foreground">正在加载报价单...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !needPassword) {
    const isExpired = errorCode === 'EXPIRED';
    const isInactive = errorCode === 'INACTIVE';
    const isMaxViews = errorCode === 'MAX_VIEWS';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">
              {isExpired ? '链接已过期' : isInactive ? '链接已停用' : isMaxViews ? '查看次数已达上限' : '无法访问'}
            </h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-4">如有疑问，请联系报价方</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 密码验证状态
  if (needPassword && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center bg-blue-100">
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold">需要访问密码</h2>
              <p className="text-sm text-muted-foreground">该报价单已设置访问密码，请输入密码后查看</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="share-password">访问密码</Label>
                <Input
                  id="share-password"
                  type="password"
                  placeholder="请输入访问密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerify()}
                />
              </div>
              <Button className="w-full" onClick={handlePasswordVerify} disabled={isVerifying}>
                {isVerifying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                {isVerifying ? '验证中...' : '验证并查看'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 正常显示报价单
  if (!data) return null;

  const { quote, shareInfo } = data;
  const num = (v: any) => Number(v) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <LinkIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold">{quote.project_name}</h1>
              <p className="text-xs text-muted-foreground">报价单号：{quote.quote_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shareInfo.expiresAt && (
              <Badge variant="outline" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                有效期至 {new Date(shareInfo.expiresAt).toLocaleDateString('zh-CN')}
              </Badge>
            )}
            {shareInfo.maxViews > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Eye className="h-3 w-3" />
                已查看 {shareInfo.viewCount}/{shareInfo.maxViews} 次
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExportingPDF}>
              {isExportingPDF ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-1" />
              )}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportWord}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Word
            </Button>
          </div>
        </div>
      </div>

      {/* 报价单内容 */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">客户名称</span>
                <p className="font-medium mt-0.5">{quote.client_name || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">联系人</span>
                <p className="font-medium mt-0.5">{quote.contact_person || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">联系电话</span>
                <p className="font-medium mt-0.5">{quote.contact_phone || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">报价日期</span>
                <p className="font-medium mt-0.5">{new Date(quote.created_at).toLocaleDateString('zh-CN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 报价明细 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">报价明细</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">序号</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead className="w-[60px]">单位</TableHead>
                  <TableHead className="w-[80px] text-right">数量</TableHead>
                  <TableHead className="w-[120px] text-right">单价（元）</TableHead>
                  <TableHead className="w-[120px] text-right">金额（元）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(quote.items || []).map((item, idx) => {
                  const unitPrice = num(item.price) * (1 + num(quote.management_rate) / 100 + num(quote.profit_rate) / 100 + num(quote.regulatory_rate) / 100);
                  const amount = unitPrice * num(item.quantity);
                  return (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{num(item.quantity)}</TableCell>
                      <TableCell className="text-right">¥{unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">¥{amount.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 费用汇总 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">费用汇总</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">直接工程费小计</span>
                <span>¥{num(quote.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">管理费（{num(quote.management_rate)}%）</span>
                <span>¥{num(quote.management_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">利润（{num(quote.profit_rate)}%）</span>
                <span>¥{num(quote.profit).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">规费（{num(quote.regulatory_rate)}%）</span>
                <span>¥{num(quote.regulatory_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">增值税（{num(quote.tax_rate)}%）</span>
                <span>¥{num(quote.tax).toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold">报价总计</span>
                <span className="text-2xl font-bold text-blue-700">¥{num(quote.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>大写金额</span>
                <span>{convertToChineseCurrency(num(quote.total))}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 报价单预览 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">报价单预览</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExportingPDF}>
                  {isExportingPDF ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  导出PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportWord}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  导出Word
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: '600px' }}
                title="报价单预览"
              />
            </div>
          </CardContent>
        </Card>

        {/* 底部提示 */}
        <div className="text-center text-xs text-muted-foreground py-4 space-y-1">
          <p>本报价单由「工程报价管理系统」生成，仅供参考</p>
          <p>如有疑问，请联系报价方</p>
          <p className="mt-2 text-[10px] opacity-60">此页面为受保护的分享链接，仅展示单份报价单内容，无法访问系统其他功能</p>
        </div>
      </div>
    </div>
  );
}
