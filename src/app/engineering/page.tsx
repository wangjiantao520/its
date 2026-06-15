'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, FileDown, Eye, FileSpreadsheet, Sparkles, Loader2, CheckCircle2, AlertCircle, Wand2, History, ThumbsUp, ThumbsDown, Mic, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  generateEngineeringQuoteHTML,
  downloadAsWord,
  convertToChineseCurrency,
  type EngineeringQuoteExportData,
} from '@/lib/export-utils';
import {
  SELF_CONSTRUCTION_QUOTA,
  INTELLIGENT_PROJECT_QUOTA,
  type SelfConstructionItem,
  type IntelligentItem,
} from '@/lib/self-construction-quota';

// ============ AI 报价解析相关类型 ============
interface AIEngineeringItem {
  id: string;
  matched: boolean;
  itemType: 'selfConstruction' | 'intelligent';
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  remark: string;
  confidence: number;
  matchedFrom: 'exact' | 'fuzzy' | 'inferred';
  originalText: string;
  suggestions: string[];
}

interface AIEngineeringResult {
  success: boolean;
  customerName?: string;
  projectName?: string;
  items: AIEngineeringItem[];
  missingFields: string[];
  suggestions: string[];
  rawResponse?: string;
  error?: string;
  fromCache?: boolean;
}

interface QuoteItem {
  id: number;
  itemType: 'selfConstruction' | 'intelligent';
  itemId: string;
  quantity: number;
}

export default function EngineeringPage() {
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [managementFeeRate, setManagementFeeRate] = useState(8);
  const [profitRate, setProfitRate] = useState(10);
  const [regulatoryFeeRate, setRegulatoryFeeRate] = useState(3);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [nextItemId, setNextItemId] = useState(1);
  const quoteRandomRef = useRef(Math.floor(Math.random() * 1000));
  const [activeTab, setActiveTab] = useState('create');

  // ============ AI 报价解析状态 ============
  const [aiRequirement, setAiRequirement] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiResult, setAiResult] = useState<AIEngineeringResult | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ============ 语音识别 ============
  const startVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) {
        setAiRequirement((prev) => prev + finalTranscript);
      }
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('语音识别出错，请重试');
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    toast.info('开始语音输入，再次点击麦克风停止');
  };

  // ============ AI 智能解析工程报价 ============
  const handleAIParse = async () => {
    if (!aiRequirement.trim()) {
      toast.error('请输入报价需求描述');
      return;
    }
    setAiParsing(true);
    try {
      const response = await fetch('/api/ai-parse-engineering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiRequirement,
          customerName,
        }),
      });
      const data: AIEngineeringResult = await response.json();
      if (data.success || data.items?.length > 0) {
        setAiResult(data);
        setAiDialogOpen(true);
        if (data.customerName && !customerName) {
          setCustomerName(data.customerName);
        }
        if (data.projectName && !projectName) {
          setProjectName(data.projectName);
        }
        toast.success(`识别完成！匹配到 ${data.items?.length || 0} 个项目`);
      } else {
        toast.error(data.error || '识别失败，请重试');
      }
    } catch (err) {
      console.error('AI 解析失败:', err);
      toast.error('AI 解析请求失败，请检查网络或 AI 服务配置');
    } finally {
      setAiParsing(false);
    }
  };

  // ============ 应用 AI 识别结果到报价明细 ============
  const applyAIResult = () => {
    if (!aiResult?.items?.length) return;
    const matchedItems = aiResult.items.filter((i) => i.matched);
    if (matchedItems.length === 0) {
      toast.error('没有可应用的项目');
      return;
    }
    let currentId = nextItemId;
    const newItems: QuoteItem[] = matchedItems.map((item) => {
      const newId = currentId++;
      return {
        id: newId,
        itemType: item.itemType,
        itemId: item.itemId,
        quantity: item.quantity || 1,
      };
    });
    setQuoteItems([...quoteItems, ...newItems]);
    setNextItemId(currentId);
    setAiDialogOpen(false);
    toast.success(`已成功添加 ${matchedItems.length} 个项目到报价明细`);
  };

  // ============ 提交反馈（学习） ============
  const submitAIFeedback = async (helpful: boolean) => {
    if (!aiResult) return;
    try {
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: customerName || 'unknown',
          originalText: aiRequirement,
          aiResult: JSON.stringify(aiResult.items),
          feedbackType: helpful ? 'correct' : 'wrong_match',
          correctedResult: helpful ? null : '用户标记为不准确',
        }),
      });
      toast.success(helpful ? '感谢您的反馈，AI 会越用越智能' : '已记录反馈，AI 将持续学习');
    } catch (err) {
      console.error('提交反馈失败:', err);
    }
  };

  // ============ 查询历史相似报价 ============
  const [similarQuotes, setSimilarQuotes] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const fetchSimilarQuotes = async (name: string) => {
    if (!name || name.length < 2) {
      setSimilarQuotes([]);
      return;
    }
    setLoadingSimilar(true);
    try {
      const res = await fetch(`/api/ai-recommend?clientName=${encodeURIComponent(name)}&limit=3`);
      const data = await res.json();
      if (data.success) {
        setSimilarQuotes(data.data || []);
      }
    } catch (err) {
      console.error('查询相似报价失败:', err);
    } finally {
      setLoadingSimilar(false);
    }
  };

  // ============ 一键复用历史报价 ============
  const reuseSimilarQuote = (sq: any) => {
    if (sq.items && Array.isArray(sq.items)) {
      const newItems: QuoteItem[] = [];
      let currentId = nextItemId;
      sq.items.forEach((it: any) => {
        if (it.itemId && (it.itemType === 'selfConstruction' || it.itemType === 'intelligent')) {
          newItems.push({
            id: currentId++,
            itemType: it.itemType,
            itemId: it.itemId,
            quantity: it.quantity || 1,
          });
        }
      });
      if (newItems.length > 0) {
        setQuoteItems([...quoteItems, ...newItems]);
        setNextItemId(currentId);
        toast.success(`已复用 ${newItems.length} 个项目`);
      }
    }
  };

  const addQuoteItem = (itemType: 'selfConstruction' | 'intelligent', itemId: string) => {
    setQuoteItems([...quoteItems, { id: nextItemId, itemType, itemId, quantity: 1 }]);
    setNextItemId(nextItemId + 1);
  };

  const removeQuoteItem = (itemId: number) => {
    setQuoteItems(quoteItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: number, quantity: number) => {
    setQuoteItems(quoteItems.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const getItemById = (itemType: 'selfConstruction' | 'intelligent', itemId: string) => {
    if (itemType === 'selfConstruction') {
      return SELF_CONSTRUCTION_QUOTA.find(item => item.id === itemId);
    } else {
      return INTELLIGENT_PROJECT_QUOTA.find(item => item.id === itemId);
    }
  };

  const calculateTotals = () => {
    let totalBase = 0;

    quoteItems.forEach(item => {
      const quotaItem = getItemById(item.itemType, item.itemId);
      if (quotaItem) {
        totalBase += quotaItem.price * item.quantity;
      }
    });

    const subtotal = totalBase;
    const managementFee = subtotal * (managementFeeRate / 100);
    const profit = subtotal * (profitRate / 100);
    const regulatoryFee = subtotal * (regulatoryFeeRate / 100);
    const taxRate = 0.13;
    const taxAmount = (subtotal + managementFee + profit + regulatoryFee) * taxRate;
    const total = subtotal + managementFee + profit + regulatoryFee + taxAmount;

    return {
      totalBase,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      taxAmount,
      total,
    };
  };

  const totals = calculateTotals();

  // 导出工程报价单
  const handleExportEngineeringQuote = () => {
    if (quoteItems.length === 0) return;

    // 生成报价单号
    const quoteNumber = `GC${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(quoteRandomRef.current).padStart(3, '0')}`;

    const exportData: EngineeringQuoteExportData = {
      projectName,
      clientName: customerName,
      contactPerson,
      contactPhone,
      quoteNumber,
      quoteDate: new Date().toISOString().split('T')[0],
      items: quoteItems.map(item => {
        const quotaItem = getItemById(item.itemType, item.itemId);
        if (!quotaItem) return { name: '', unit: '', quantity: 0, unitPrice: 0, amount: 0 };
        const unitPrice = quotaItem.price * (1 + managementFeeRate / 100 + profitRate / 100 + regulatoryFeeRate / 100);
        return {
          name: quotaItem.name,
          unit: quotaItem.unit,
          quantity: item.quantity,
          unitPrice: unitPrice,
          amount: unitPrice * item.quantity,
        };
      }).filter(item => item.name),
      rates: {
        managementRate: managementFeeRate,
        profitRate: profitRate,
        regulatoryRate: regulatoryFeeRate,
        taxRate: 13,
      },
      summary: {
        subtotal: totals.subtotal,
        managementFee: totals.managementFee,
        profit: totals.profit,
        regulatoryFee: totals.regulatoryFee,
        tax: totals.taxAmount,
        grandTotal: totals.total,
        grandTotalRMB: convertToChineseCurrency(totals.total),
      },
    };

    const html = generateEngineeringQuoteHTML(exportData);
    downloadAsWord(html, `工程报价单_${quoteNumber}.doc`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工程报价</h1>
          <p className="text-muted-foreground mt-1">创建和管理工程报价单</p>
        </div>
      </div>

      <Tabs defaultValue="create" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create">新建报价</TabsTrigger>
          <TabsTrigger value="quotas">定额库管理</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
          {/* AI 智能辅助报价区 */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Sparkles className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    AI 智能辅助报价
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">工程报价</Badge>
                  </CardTitle>
                  <CardDescription>
                    用自然语言描述您的工程需求，AI 自动识别并匹配定额项目（支持自施工工序 + 智能化项目）
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-requirement" className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-600" />
                  工程需求描述
                </Label>
                <div className="relative">
                  <Textarea
                    id="ai-requirement"
                    placeholder="例如：宁德市政府办公室宽带专线项目，需要铺设光纤500米，安装分光器2台，配置ONU设备10台，并完成调试开通…"
                    value={aiRequirement}
                    onChange={(e) => setAiRequirement(e.target.value)}
                    rows={4}
                    className="pr-12"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant={isRecording ? 'destructive' : 'ghost'}
                    className="absolute right-2 top-2 h-8 w-8"
                    onClick={startVoiceInput}
                    title={isRecording ? '停止录音' : '语音输入'}
                  >
                    <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  支持中英文混合描述，可包含工序、数量、品牌型号、施工要求等信息
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAIParse}
                  disabled={aiParsing || !aiRequirement.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {aiParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      AI 正在分析…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      智能识别
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAiRequirement('');
                    setAiResult(null);
                  }}
                  disabled={aiParsing}
                >
                  <X className="h-4 w-4 mr-2" />
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 历史相似报价推荐 */}
          {customerName && customerName.length >= 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-purple-600" />
                    <div>
                      <CardTitle className="text-base">历史相似报价</CardTitle>
                      <CardDescription className="text-xs">基于客户名称推荐的历史报价，可一键复用</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchSimilarQuotes(customerName)}
                    disabled={loadingSimilar}
                  >
                    {loadingSimilar ? <Loader2 className="h-4 w-4 animate-spin" /> : '刷新'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSimilar ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在查找相似历史报价…
                  </div>
                ) : similarQuotes.length > 0 ? (
                  <div className="space-y-2">
                    {similarQuotes.map((sq: any) => (
                      <div
                        key={sq.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{sq.projectName || '未命名项目'}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sq.quoteNumber} · {sq.createdAt?.slice(0, 10)} · {sq.itemCount} 项 · ¥{sq.totalAmount?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reuseSimilarQuote(sq)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          复用
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">暂无该客户的历史报价</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>填写客户和项目基本信息</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">客户名称</Label>
                <Input
                  id="customerName"
                  placeholder="请输入客户名称"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (e.target.value.length >= 2) {
                      fetchSimilarQuotes(e.target.value);
                    } else {
                      setSimilarQuotes([]);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectName">项目名称</Label>
                <Input
                  id="projectName"
                  placeholder="请输入项目名称"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">联系人</Label>
                <Input
                  id="contactPerson"
                  placeholder="请输入联系人"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">联系电话</Label>
                <Input
                  id="contactPhone"
                  placeholder="请输入联系电话"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 报价明细 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>报价明细</CardTitle>
                  <CardDescription>添加工序和数量</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select onValueChange={(value) => addQuoteItem('selfConstruction', value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="添加自施工工序" />
                    </SelectTrigger>
                    <SelectContent>
                      {SELF_CONSTRUCTION_QUOTA.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(value) => addQuoteItem('intelligent', value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="添加智能化项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTELLIGENT_PROJECT_QUOTA.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">操作</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead className="w-[100px]">单位</TableHead>
                    <TableHead className="w-[120px]">数量</TableHead>
                    <TableHead className="w-[120px]">单价</TableHead>
                    <TableHead className="w-[120px]">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteItems.map((item) => {
                    const quotaItem = getItemById(item.itemType, item.itemId);
                    if (!quotaItem) return null;
                    const baseFee = quotaItem.price * item.quantity;
                    const subtotal = baseFee * (1 + managementFeeRate / 100 + profitRate / 100 + regulatoryFeeRate / 100);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQuoteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.itemType === 'selfConstruction' ? '自施工' : '智能化'}
                          </span>
                        </TableCell>
                        <TableCell>{quotaItem.name}</TableCell>
                        <TableCell>{quotaItem.unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>¥{quotaItem.price.toFixed(2)}</TableCell>
                        <TableCell>¥{subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 费率配置 */}
          <Card>
            <CardHeader>
              <CardTitle>费率配置</CardTitle>
              <CardDescription>设置管理费率、利润率和规费率</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="managementFeeRate">管理费率 (%)</Label>
                <Input
                  id="managementFeeRate"
                  type="number"
                  value={managementFeeRate}
                  onChange={(e) => setManagementFeeRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profitRate">利润率 (%)</Label>
                <Input
                  id="profitRate"
                  type="number"
                  value={profitRate}
                  onChange={(e) => setProfitRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regulatoryFeeRate">规费率 (%)</Label>
                <Input
                  id="regulatoryFeeRate"
                  type="number"
                  value={regulatoryFeeRate}
                  onChange={(e) => setRegulatoryFeeRate(parseFloat(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 汇总计算 */}
          <Card>
            <CardHeader>
              <CardTitle>报价汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">定额费合计</p>
                  <p className="text-xl font-semibold">¥{totals.totalBase.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">管理费</p>
                  <p className="text-lg font-semibold">¥{totals.managementFee.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">利润</p>
                  <p className="text-lg font-semibold">¥{totals.profit.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">规费</p>
                  <p className="text-lg font-semibold">¥{totals.regulatoryFee.toFixed(2)}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">税额 (13%)</p>
                    <p className="text-lg">¥{totals.taxAmount.toFixed(2)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">总价</p>
                    <p className="text-3xl font-bold text-primary">¥{totals.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button variant="outline">
                <Save className="h-4 w-4 mr-2" />
                保存草稿
              </Button>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                预览报价单
              </Button>
              <Button variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                导出PDF
              </Button>
              <Button 
                className="bg-green-700 hover:bg-green-800"
                onClick={handleExportEngineeringQuote}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                导出Word
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="quotas" className="mt-6 space-y-6">
          {/* 自施工工序定额 */}
          <Card>
            <CardHeader>
              <CardTitle>自施工工序定额</CardTitle>
              <CardDescription>宽带、专线项目和常规内部布线施工工序</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SELF_CONSTRUCTION_QUOTA.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>¥{item.price.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{item.remark || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 集成商智能化项目报价 */}
          <Card>
            <CardHeader>
              <CardTitle>集成商智能化项目报价</CardTitle>
              <CardDescription>设备和施工安装项目报价</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>定额名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>可抵扣税率</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INTELLIGENT_PROJECT_QUOTA.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>¥{item.price.toFixed(2)}</TableCell>
                      <TableCell>{item.deductibleTaxRate}%</TableCell>
                      <TableCell className="text-muted-foreground">{item.remark || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ AI 识别结果对话框 ============ */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI 智能识别结果
            </DialogTitle>
            <DialogDescription>
              {aiResult?.fromCache && <Badge variant="outline" className="mr-2">来自学习记忆</Badge>}
              共识别到 {aiResult?.items?.length || 0} 个项目，匹配成功 {aiResult?.items?.filter((i) => i.matched).length || 0} 个
            </DialogDescription>
          </DialogHeader>

          {aiResult && (
            <div className="space-y-4">
              {/* 客户/项目信息 */}
              {(aiResult.customerName || aiResult.projectName) && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  {aiResult.customerName && (
                    <div>
                      <div className="text-xs text-muted-foreground">客户名称</div>
                      <div className="font-medium text-sm mt-1">{aiResult.customerName}</div>
                    </div>
                  )}
                  {aiResult.projectName && (
                    <div>
                      <div className="text-xs text-muted-foreground">项目名称</div>
                      <div className="font-medium text-sm mt-1">{aiResult.projectName}</div>
                    </div>
                  )}
                </div>
              )}

              {/* 缺失字段提示 */}
              {aiResult.missingFields?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    需要补充的信息
                  </div>
                  <ul className="text-xs text-amber-700 mt-2 list-disc list-inside">
                    {aiResult.missingFields.map((field, idx) => (
                      <li key={idx}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 识别结果列表 */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">单价</TableHead>
                      <TableHead className="text-right">小计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiResult.items?.map((item, idx) => (
                      <TableRow key={idx} className={item.matched ? '' : 'bg-red-50/30'}>
                        <TableCell>
                          {item.matched ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{item.itemName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.category}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.itemType === 'selfConstruction' ? '自施工' : '智能化'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.unit}</TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">¥{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ¥{(item.unitPrice * item.quantity).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 建议 */}
              {aiResult.suggestions?.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="text-sm font-medium text-blue-800">AI 建议</div>
                  <ul className="text-xs text-blue-700 mt-1 list-disc list-inside">
                    {aiResult.suggestions.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 反馈区 */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-muted-foreground">识别结果是否准确？</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => submitAIFeedback(true)}>
                    <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                    准确
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => submitAIFeedback(false)}>
                    <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                    不准确
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={applyAIResult}
              disabled={!aiResult?.items?.some((i) => i.matched)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              应用到报价明细
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
