'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { apiFetch } from '@/lib/api-fetch';
import {
  QUOTE_LIBRARY_TEMPLATE_VERSION,
  type QuoteData,
  type QuoteFloorPoint,
  type QuoteItem,
  type QuoteSummary,
} from '@/lib/quote-library-types';
import { renderQuoteDataToWorkbook } from '@/lib/quote-library-template';

interface QuoteEditorProps {
  initialData?: QuoteData;
  initialTotalAmount?: number;
  onChange: (data: QuoteData, totalAmount: number) => void;
  onTotalAmountOverride?: (amount: number) => void;
  disabled?: boolean;
}

const EMPTY_SUMMARY: QuoteSummary = {
  title: '',
  items: [],
  totals: { taxable_total: 0, tiejiang_taxable_total: 0, yidong_taxable_total: 0 },
};

const newItem = (): QuoteItem => ({
  name: '',
  spec: '',
  unit: '',
  quantity: 1,
  unit_price: 0,
  taxable_unit_price: 0,
  tiejiang_taxable_unit_price: 0,
  yidong_taxable_unit_price: 0,
  total_taxable: 0,
  tiejiang_total: 0,
  yidong_total: 0,
  remark: '',
});

function num(v: unknown): number {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function QuoteEditor({ initialData, initialTotalAmount, onChange, disabled }: QuoteEditorProps) {
  const [title, setTitle] = useState(initialData?.summary.title ?? '');
  const [items, setItems] = useState<QuoteItem[]>(initialData?.summary.items ?? []);
  const [note, setNote] = useState(initialData?.summary.note ?? '');
  const [taxableTotal, setTaxableTotal] = useState(initialData?.summary.totals.taxable_total ?? 0);
  const [tiejiangTotal, setTiejiangTotal] = useState(initialData?.summary.totals.tiejiang_taxable_total ?? 0);
  const [yidongTotal, setYidongTotal] = useState(initialData?.summary.totals.yidong_taxable_total ?? 0);
  const [totalOverride, setTotalOverride] = useState(initialTotalAmount ?? 0);
  const [points, setPoints] = useState<QuoteFloorPoint[]>(initialData?.points?.floors ?? []);
  const [templateVersion, setTemplateVersion] = useState<typeof QUOTE_LIBRARY_TEMPLATE_VERSION>(
    initialData?.template ?? QUOTE_LIBRARY_TEMPLATE_VERSION,
  );
  const [importing, setImporting] = useState(false);

  const recomputeRow = useCallback((item: QuoteItem): QuoteItem => {
    const q = num(item.quantity);
    const taxable = num(item.taxable_unit_price);
    const tiejiang = num(item.tiejiang_taxable_unit_price);
    const yidong = num(item.yidong_taxable_unit_price);
    return {
      ...item,
      quantity: q,
      unit_price: num(item.unit_price),
      taxable_unit_price: taxable,
      tiejiang_taxable_unit_price: tiejiang,
      yidong_taxable_unit_price: yidong,
      total_taxable: Number((taxable * q).toFixed(2)),
      tiejiang_total: Number((tiejiang * q).toFixed(2)),
      yidong_total: Number((yidong * q).toFixed(2)),
    };
  }, []);

  const totals = useMemo(() => {
    const tt = items.reduce((sum, it) => sum + num(it.total_taxable), 0);
    const tj = items.reduce((sum, it) => sum + num(it.tiejiang_total), 0);
    const yd = items.reduce((sum, it) => sum + num(it.yidong_total), 0);
    return {
      taxable_total: Number(tt.toFixed(2)),
      tiejiang_taxable_total: Number(tj.toFixed(2)),
      yidong_taxable_total: Number(yd.toFixed(2)),
    };
  }, [items]);

  useEffect(() => {
    setTaxableTotal(totals.taxable_total);
    setTiejiangTotal(totals.tiejiang_taxable_total);
    setYidongTotal(totals.yidong_taxable_total);
  }, [totals]);

  useEffect(() => {
    const data: QuoteData = {
      template: templateVersion,
      summary: {
        title,
        items,
        totals: { taxable_total: taxableTotal, tiejiang_taxable_total: tiejiangTotal, yidong_taxable_total: yidongTotal },
        note: note || undefined,
      },
      points: points.length > 0 ? { floors: points } : undefined,
    };
    onChange(data, totalOverride || totals.taxable_total);
  }, [templateVersion, title, items, taxableTotal, tiejiangTotal, yidongTotal, note, points, totalOverride, totals.taxable_total, onChange]);

  const updateRow = (index: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === index ? recomputeRow({ ...it, ...patch }) : it)));
  };
  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };
  const addRow = () => {
    setItems((prev) => [...prev, newItem()]);
  };

  const downloadTemplate = () => {
    const data: QuoteData = {
      template: templateVersion,
      summary: { title: title || '报价汇总', items: items.length > 0 ? items : [newItem()], totals: { taxable_total: 0, tiejiang_taxable_total: 0, yidong_taxable_total: 0 }, note: note || undefined },
    };
    const wb = renderQuoteDataToWorkbook(data);
    XLSX.writeFile(wb, '报价模板.xlsx');
  };

  const importFromExcel = async (file: File) => {
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await apiFetch<QuoteData>('/api/quote-library/import', { method: 'POST', body: form });
      if (!result.success || !result.data) throw new Error(result.error || '解析失败');
      const data = result.data;
      setTemplateVersion(data.template);
      setTitle(data.summary.title);
      setItems(data.summary.items.map((it) => recomputeRow(it)));
      setNote(data.summary.note ?? '');
      setTaxableTotal(data.summary.totals.taxable_total);
      setTiejiangTotal(data.summary.totals.tiejiang_taxable_total);
      setYidongTotal(data.summary.totals.yidong_taxable_total);
      setTotalOverride(data.summary.totals.taxable_total);
      setPoints(data.points?.floors ?? []);
      toast.success('已按模板解析报价单，请复核数据');
    } catch (error) {
      const message = error instanceof Error ? error.message : '解析失败';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    const data: QuoteData = {
      template: templateVersion,
      summary: {
        title,
        items,
        totals: { taxable_total: taxableTotal, tiejiang_taxable_total: tiejiangTotal, yidong_taxable_total: yidongTotal },
        note: note || undefined,
      },
      points: points.length > 0 ? { floors: points } : undefined,
    };
    const wb = renderQuoteDataToWorkbook(data);
    XLSX.writeFile(wb, `${title || '报价资料'}.xlsx`);
  };

  const itemCount = items.length;

  return (
    <Card className="overflow-hidden border-primary/15 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">报价单编辑</CardTitle>
              <CardDescription>基于康海模板，支持在线编辑或 Excel 模板导入/导出。</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} disabled={disabled} className="h-9">
              <Download className="h-4 w-4 mr-1" />
              下载空模板
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={disabled || importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFromExcel(f);
                  e.target.value = '';
                }}
              />
              <Button type="button" variant="outline" size="sm" asChild disabled={disabled || importing} className="h-9">
                <span className="cursor-pointer">
                  {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  从 Excel 导入
                </span>
              </Button>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={exportToExcel} disabled={disabled} className="h-9">
              <Save className="h-4 w-4 mr-1" />
              导出 Excel
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="space-y-2 md:col-span-7">
            <Label className="text-sm">报价单标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：康海物流固话线路整改报价"
              disabled={disabled}
              className="h-10"
            />
          </div>
          <div className="space-y-2 md:col-span-5">
            <Label className="text-sm">含税合计（元，可手动覆盖）</Label>
            <Input
              type="number"
              step="0.01"
              value={totalOverride}
              onChange={(e) => setTotalOverride(Number(e.target.value))}
              disabled={disabled}
              className="h-10 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="项目数" value={`${itemCount}`} suffix="项" tone="default" />
          <StatCard label="含税合计" value={formatCurrency(taxableTotal)} tone="primary" />
          <StatCard label="铁建合计" value={formatCurrency(tiejiangTotal)} tone="info" />
          <StatCard label="移动合计" value={formatCurrency(yidongTotal)} tone="success" />
        </div>

        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-[420px]">
            <TabsTrigger value="items">报价明细</TabsTrigger>
            <TabsTrigger value="points">点位表</TabsTrigger>
            <TabsTrigger value="note">备注</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="mt-4">
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[1100px] table-fixed">
                  <colgroup>
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '70px' }} />
                    <col style={{ width: '80px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '52px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">项目名称</TableHead>
                      <TableHead className="font-semibold">规格/型号/参数</TableHead>
                      <TableHead className="font-semibold">单位</TableHead>
                      <TableHead className="font-semibold text-right">数量</TableHead>
                      <TableHead className="font-semibold text-right">单价</TableHead>
                      <TableHead className="font-semibold text-right">含税单价<br /><span className="text-[10px] font-normal text-muted-foreground">6%</span></TableHead>
                      <TableHead className="font-semibold text-right">铁建含税<br /><span className="text-[10px] font-normal text-muted-foreground">管理费 6%</span></TableHead>
                      <TableHead className="font-semibold text-right">移动含税<br /><span className="text-[10px] font-normal text-muted-foreground">管理费 8%</span></TableHead>
                      <TableHead className="font-semibold text-right">含税合计</TableHead>
                      <TableHead className="font-semibold text-right">铁建合计</TableHead>
                      <TableHead className="font-semibold text-right">移动合计</TableHead>
                      <TableHead className="font-semibold">备注</TableHead>
                      <TableHead className="font-semibold text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground py-10">
                          <div className="flex flex-col items-center gap-2">
                            <Sparkles className="h-6 w-6 text-muted-foreground/50" />
                            <p>暂无明细，可点击右上角「从 Excel 导入」快速填充</p>
                            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
                              <Plus className="h-4 w-4 mr-1" />
                              新增第一条
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {items.map((item, index) => (
                      <TableRow key={index} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="p-2">
                          <Input
                            value={item.name}
                            onChange={(e) => updateRow(index, { name: e.target.value })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm"
                            placeholder="如：机柜"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.spec ?? ''}
                            onChange={(e) => updateRow(index, { spec: e.target.value })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm"
                            placeholder="600*600*1000"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.unit ?? ''}
                            onChange={(e) => updateRow(index, { unit: e.target.value })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm"
                            placeholder="个"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateRow(index, { unit_price: Number(e.target.value) })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.taxable_unit_price ?? 0}
                            onChange={(e) => updateRow(index, { taxable_unit_price: Number(e.target.value) })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm text-right tabular-nums bg-primary/5"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.tiejiang_taxable_unit_price ?? 0}
                            onChange={(e) => updateRow(index, { tiejiang_taxable_unit_price: Number(e.target.value) })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.yidong_taxable_unit_price ?? 0}
                            onChange={(e) => updateRow(index, { yidong_taxable_unit_price: Number(e.target.value) })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right tabular-nums text-sm font-semibold text-primary">
                          {(item.total_taxable ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2 text-right tabular-nums text-sm text-muted-foreground">
                          {(item.tiejiang_total ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2 text-right tabular-nums text-sm text-muted-foreground">
                          {(item.yidong_total ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={item.remark ?? ''}
                            onChange={(e) => updateRow(index, { remark: e.target.value })}
                            disabled={disabled}
                            className="h-8 px-2 text-sm"
                            placeholder="备注"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeRow(index)}
                            disabled={disabled}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="删除明细"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="default" size="sm" onClick={addRow} disabled={disabled} className="h-9">
                <Plus className="h-4 w-4 mr-1" />
                新增明细
              </Button>
              <div className="text-xs text-muted-foreground">
                合计随明细自动计算，含税合计将作为资料库含税合计展示。
              </div>
            </div>
          </TabsContent>

          <TabsContent value="points" className="mt-4">
            <div className="space-y-3">
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 p-3 text-sm flex items-start gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>可选填写；用于导出 Sheet2（如楼层点位 / AP 信息）。</span>
              </div>
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-32">楼层</TableHead>
                      <TableHead>点位计数（英文逗号分隔）</TableHead>
                      <TableHead className="w-32">AP</TableHead>
                      <TableHead className="w-16 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {points.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          暂无楼层数据
                        </TableCell>
                      </TableRow>
                    )}
                    {points.map((p, index) => (
                      <TableRow key={index} className="hover:bg-muted/30">
                        <TableCell className="p-2">
                          <Input
                            value={p.name}
                            placeholder="楼层名称"
                            onChange={(e) => {
                              const v = e.target.value;
                              setPoints((prev) => prev.map((it, idx) => idx === index ? { ...it, name: v } : it));
                            }}
                            disabled={disabled}
                            className="h-8 px-2 text-sm"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={p.counts.join(',')}
                            placeholder="3,3,3,4,6,15,24"
                            onChange={(e) => {
                              const arr = e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
                              setPoints((prev) => prev.map((it, idx) => idx === index ? { ...it, counts: arr } : it));
                            }}
                            disabled={disabled}
                            className="h-8 px-2 text-sm tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={p.ap ?? ''}
                            placeholder="AP1 / 34 / AP2 / 43"
                            onChange={(e) => {
                              const v = e.target.value;
                              setPoints((prev) => prev.map((it, idx) => idx === index ? { ...it, ap: v } : it));
                            }}
                            disabled={disabled}
                            className="h-8 px-2 text-sm"
                          />
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPoints((prev) => prev.filter((_, idx) => idx !== index))}
                            disabled={disabled}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="删除楼层"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setPoints((prev) => [...prev, { name: '', counts: [] }])} disabled={disabled}>
                <Plus className="h-4 w-4 mr-1" />
                新增楼层
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="note" className="mt-4">
            <Textarea
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="说明 / 备注"
              disabled={disabled}
              className="resize-y"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone: 'default' | 'primary' | 'info' | 'success' }) {
  const toneClass = {
    default: 'bg-muted/40 text-foreground border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
    info: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200/40',
    success: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/40',
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums truncate" title={value}>{value}</span>
        {suffix && <span className="text-xs opacity-70">{suffix}</span>}
      </div>
    </div>
  );
}

// 注：保留 Separator 导入占位以备后续使用
void Separator;

export function useEmptyQuoteData(): QuoteData {
  return useMemo(() => ({
    template: QUOTE_LIBRARY_TEMPLATE_VERSION,
    summary: { ...EMPTY_SUMMARY, items: [] },
  }), []);
}