'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, FileDown, Eye, FileSpreadsheet, Loader2, Search, Pencil, MoreHorizontal, RefreshCw, ClipboardList, ArrowRightLeft, X } from 'lucide-react';
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
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

interface QuoteItem {
  id: number;
  itemType: 'selfConstruction' | 'intelligent';
  itemId: string;
  quantity: number;
}

interface EngineeringQuote {
  id: number;
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
  status: string;
  items: Array<{
    itemType: string;
    itemId: string;
    quantity: number;
    name: string;
    unit: string;
    price: number;
  }> | null;
  created_at: string;
  updated_at: string;
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

  // 草稿相关状态
  const [savedQuoteId, setSavedQuoteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // 列表相关状态
  const [quotes, setQuotes] = useState<EngineeringQuote[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pageSize = 10;

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EngineeringQuote | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 预览对话框
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 状态变更对话框
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<EngineeringQuote | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // 加载报价单列表
  const fetchQuotes = useCallback(async (page: number = 1, keyword: string = '', status: string = 'all') => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (keyword) params.set('keyword', keyword);
      if (status && status !== 'all') params.set('status', status);

      const response = await fetch(`/api/engineering-quotes?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setQuotes(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalCount(result.pagination?.total || 0);
        setCurrentPage(page);
      } else {
        toast.error('加载失败', { description: result.error || '无法获取报价列表' });
      }
    } catch (error) {
      console.error('加载报价列表失败:', error);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsLoadingList(false);
    }
  }, [pageSize]);

  // 切换到列表Tab时加载数据
  useEffect(() => {
    if (activeTab === 'list') {
      fetchQuotes(1, searchKeyword, statusFilter);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载报价单到编辑表单（从后端获取最新数据）
  const handleLoadQuote = async (quote: EngineeringQuote) => {
    try {
      const response = await fetch(`/api/engineering-quotes/${quote.id}`);
      const result = await response.json();

      if (!result.success) {
        toast.error('加载失败', { description: result.error || '获取报价详情失败' });
        return;
      }

      const data: EngineeringQuote = result.data;
      setCustomerName(data.client_name || '');
      setProjectName(data.project_name);
      setContactPerson(data.contact_person || '');
      setContactPhone(data.contact_phone || '');
      setManagementFeeRate(data.management_rate || 8);
      setProfitRate(data.profit_rate || 10);
      setRegulatoryFeeRate(data.regulatory_rate || 3);
      setSavedQuoteId(data.id);
      setLastSavedAt(new Date(data.updated_at).toLocaleString('zh-CN'));

      // 恢复报价明细
      if (data.items && Array.isArray(data.items)) {
        const loadedItems: QuoteItem[] = data.items.map((item: any, index: number) => ({
          id: index + 1,
          itemType: item.itemType as 'selfConstruction' | 'intelligent',
          itemId: item.itemId,
          quantity: item.quantity,
        }));
        setQuoteItems(loadedItems);
        setNextItemId(loadedItems.length + 1);
      } else {
        setQuoteItems([]);
        setNextItemId(1);
      }

      quoteRandomRef.current = Math.floor(Math.random() * 1000);
      setActiveTab('create');
      toast.success('加载成功', { description: `已加载报价单 ${data.quote_number}` });
    } catch (error) {
      console.error('加载报价单失败:', error);
      toast.error('加载失败', { description: '网络错误，请稍后重试' });
    }
  };

  // 打开删除确认对话框
  const handleOpenDeleteDialog = (quote: EngineeringQuote) => {
    setDeleteTarget(quote);
    setDeletePassword('');
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!deletePassword) {
      toast.error('请输入管理密码');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/engineering-quotes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, password: deletePassword }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success('删除成功', { description: `报价单 ${deleteTarget.quote_number} 已删除` });
        setDeleteDialogOpen(false);
        fetchQuotes(currentPage, searchKeyword, statusFilter);
      } else {
        toast.error('删除失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('删除报价单失败:', error);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsDeleting(false);
    }
  };

  // 打开状态变更对话框
  const handleOpenStatusDialog = (quote: EngineeringQuote) => {
    setStatusTarget(quote);
    setNewStatus(quote.status);
    setStatusDialogOpen(true);
  };

  // 确认状态变更
  const handleConfirmStatusChange = async () => {
    if (!statusTarget || !newStatus) return;

    setIsChangingStatus(true);
    try {
      const response = await fetch(`/api/engineering-quotes/${statusTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();

      if (result.success) {
        const statusLabels: Record<string, string> = {
          draft: '草稿',
          submitted: '已提交',
          approved: '已审批',
          rejected: '已驳回',
        };
        toast.success('状态变更成功', {
          description: `报价单 ${statusTarget.quote_number} 已变更为「${statusLabels[newStatus] || newStatus}」`,
        });
        setStatusDialogOpen(false);
        fetchQuotes(currentPage, searchKeyword, statusFilter);
      } else {
        toast.error('状态变更失败', { description: result.error || '请稍后重试' });
      }
    } catch (error) {
      console.error('状态变更失败:', error);
      toast.error('状态变更失败', { description: '网络错误，请稍后重试' });
    } finally {
      setIsChangingStatus(false);
    }
  };

  // 搜索
  const handleSearch = () => {
    setCurrentPage(1);
    fetchQuotes(1, searchKeyword, statusFilter);
  };

  // 状态筛选
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchQuotes(1, searchKeyword, status);
  };

  // 分页跳转
  const handlePageChange = (page: number) => {
    fetchQuotes(page, searchKeyword, statusFilter);
  };

  // 渲染分页
  const renderPagination = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
              className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {pages.map((page, index) =>
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => handlePageChange(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
              className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // 构建工程报价导出数据
  const buildExportData = useCallback((): EngineeringQuoteExportData | null => {
    if (quoteItems.length === 0) return null;

    // 自行计算汇总数据，避免依赖后定义的 totals
    let totalBase = 0;
    quoteItems.forEach(item => {
      const quotaItem = item.itemType === 'selfConstruction'
        ? SELF_CONSTRUCTION_QUOTA.find(q => q.id === item.itemId)
        : INTELLIGENT_PROJECT_QUOTA.find(q => q.id === item.itemId);
      if (quotaItem) {
        totalBase += quotaItem.price * item.quantity;
      }
    });

    const subtotal = totalBase;
    const managementFee = subtotal * (managementFeeRate / 100);
    const profit = subtotal * (profitRate / 100);
    const regulatoryFee = subtotal * (regulatoryFeeRate / 100);
    const taxAmount = (subtotal + managementFee + profit + regulatoryFee) * 0.13;
    const grandTotal = subtotal + managementFee + profit + regulatoryFee + taxAmount;

    // 自行生成报价单号
    const quoteNumber = `GC${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(quoteRandomRef.current).padStart(3, '0')}`;

    return {
      projectName,
      clientName: customerName,
      contactPerson,
      contactPhone,
      quoteNumber,
      quoteDate: new Date().toISOString().split('T')[0],
      items: quoteItems.map(item => {
        const quotaItem = item.itemType === 'selfConstruction'
          ? SELF_CONSTRUCTION_QUOTA.find(q => q.id === item.itemId)
          : INTELLIGENT_PROJECT_QUOTA.find(q => q.id === item.itemId);
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
        subtotal,
        managementFee,
        profit,
        regulatoryFee,
        tax: taxAmount,
        grandTotal,
        grandTotalRMB: convertToChineseCurrency(grandTotal),
      },
    };
  }, [quoteItems, projectName, customerName, contactPhone, managementFeeRate, profitRate, regulatoryFeeRate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 预览当前编辑的报价单
  const handlePreview = useCallback(() => {
    if (quoteItems.length === 0) {
      toast.error('预览失败', { description: '请至少添加一条报价明细' });
      return;
    }
    if (!projectName) {
      toast.error('预览失败', { description: '请填写项目名称' });
      return;
    }

    const exportData = buildExportData();
    if (!exportData) return;

    const html = generateEngineeringQuoteHTML(exportData);
    setPreviewHtml(html);
    setPreviewTitle(`${exportData.projectName} - ${exportData.quoteNumber}`);
    setPreviewDialogOpen(true);
  }, [quoteItems.length, projectName, buildExportData]);

  // 从列表预览报价单（从后端获取最新数据）
  const handlePreviewFromList = useCallback(async (quote: EngineeringQuote) => {
    try {
      const response = await fetch(`/api/engineering-quotes/${quote.id}`);
      const result = await response.json();

      if (!result.success) {
        toast.error('预览失败', { description: result.error || '获取报价详情失败' });
        return;
      }

      const data: EngineeringQuote = result.data;
      // 数据库返回的数值字段可能是字符串，统一转为数字
      const num = (v: any) => Number(v) || 0;

      const exportData: EngineeringQuoteExportData = {
        projectName: data.project_name,
        clientName: data.client_name || '',
        contactPerson: data.contact_person || '',
        contactPhone: data.contact_phone || '',
        quoteNumber: data.quote_number,
        quoteDate: new Date(data.created_at).toISOString().split('T')[0],
        items: (data.items || []).map(item => ({
          name: item.name,
          unit: item.unit,
          quantity: num(item.quantity),
          unitPrice: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100),
          amount: num(item.price) * (1 + num(data.management_rate) / 100 + num(data.profit_rate) / 100 + num(data.regulatory_rate) / 100) * num(item.quantity),
        })),
        rates: {
          managementRate: num(data.management_rate),
          profitRate: num(data.profit_rate),
          regulatoryRate: num(data.regulatory_rate),
          taxRate: num(data.tax_rate),
        },
        summary: {
          subtotal: num(data.subtotal),
          managementFee: num(data.management_fee),
          profit: num(data.profit),
          regulatoryFee: num(data.regulatory_fee),
          tax: num(data.tax),
          grandTotal: num(data.total),
          grandTotalRMB: convertToChineseCurrency(num(data.total)),
        },
      };

      const html = generateEngineeringQuoteHTML(exportData);
      setPreviewHtml(html);
      setPreviewTitle(`${data.project_name} - ${data.quote_number}`);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('预览报价单失败:', error);
      toast.error('预览失败', { description: '网络错误，请稍后重试' });
    }
  }, []);

  // 从预览导出Word
  const handleExportFromPreview = useCallback(() => {
    if (!previewHtml) return;
    const quoteNumber = previewTitle.split(' - ').pop() || 'unknown';
    downloadAsWord(previewHtml, `工程报价单_${quoteNumber}.doc`);
  }, [previewHtml, previewTitle]);

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">草稿</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">已提交</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">已审批</Badge>;
      case 'rejected':
        return <Badge variant="destructive">已驳回</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  // 生成报价单号
  const generateQuoteNumber = () => {
    return `GC${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(quoteRandomRef.current).padStart(3, '0')}`;
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!projectName) {
      toast.error('保存失败', {
        description: '请至少填写项目名称',
      });
      return;
    }

    setIsSaving(true);
    try {
      const quoteNumber = generateQuoteNumber();
      const payload = {
        quoteNumber: savedQuoteId ? undefined : quoteNumber,
        projectName,
        clientName: customerName,
        contactPerson,
        contactPhone,
        constructionArea: 0,
        managementRate: managementFeeRate,
        profitRate,
        regulatoryRate: regulatoryFeeRate,
        taxRate: 13,
        subtotal: totals.subtotal,
        managementFee: totals.managementFee,
        profit: totals.profit,
        regulatoryFee: totals.regulatoryFee,
        tax: totals.taxAmount,
        total: totals.total,
        items: quoteItems.map(item => {
          const quotaItem = getItemById(item.itemType, item.itemId);
          return {
            itemType: item.itemType,
            itemId: item.itemId,
            quantity: item.quantity,
            name: quotaItem?.name || '',
            unit: quotaItem?.unit || '',
            price: quotaItem?.price || 0,
          };
        }),
        status: 'draft',
      };

      let response;
      if (savedQuoteId) {
        // 更新已有草稿
        response = await fetch('/api/engineering-quotes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: savedQuoteId }),
        });
      } else {
        // 新建草稿
        response = await fetch('/api/engineering-quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (result.success) {
        if (!savedQuoteId) {
          setSavedQuoteId(result.data.id);
        }
        setLastSavedAt(new Date().toLocaleString('zh-CN'));
        toast.success('保存成功', {
          description: '草稿已保存',
        });
      } else {
        toast.error('保存失败', {
          description: result.error || '请稍后重试',
        });
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
      toast.error('保存失败', {
        description: '网络错误，请稍后重试',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 导出工程报价单
  const handleExportEngineeringQuote = () => {
    const exportData = buildExportData();
    if (!exportData) return;

    const html = generateEngineeringQuoteHTML(exportData);
    downloadAsWord(html, `工程报价单_${exportData.quoteNumber}.doc`);
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
          <TabsTrigger value="list">
            报价列表
            {totalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {totalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="quotas">定额库管理</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
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
                  onChange={(e) => setCustomerName(e.target.value)}
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
            <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {savedQuoteId && (
                  <span>报价单 ID: {savedQuoteId}</span>
                )}
                {lastSavedAt && (
                  <span className="ml-2">上次保存: {lastSavedAt}</span>
                )}
              </div>
              <div className="flex gap-4">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? '保存中...' : '保存草稿'}
              </Button>
              <Button variant="outline" onClick={handlePreview}>
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
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6 space-y-6">
          {/* 搜索与筛选 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="搜索项目名称、客户名称、报价单号..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-9 pr-8"
                    />
                    {searchKeyword && (
                      <button
                        onClick={() => {
                          setSearchKeyword('');
                          setCurrentPage(1);
                          fetchQuotes(1, '', statusFilter);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={statusFilter} onValueChange={handleStatusFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="submitted">已提交</SelectItem>
                      <SelectItem value="approved">已审批</SelectItem>
                      <SelectItem value="rejected">已驳回</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleSearch}>
                    <Search className="h-4 w-4 mr-2" />
                    搜索
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchQuotes(currentPage, searchKeyword, statusFilter)}
                    disabled={isLoadingList}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingList ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800"
                    onClick={() => {
                      setSavedQuoteId(null);
                      setCustomerName('');
                      setProjectName('');
                      setContactPerson('');
                      setContactPhone('');
                      setManagementFeeRate(8);
                      setProfitRate(10);
                      setRegulatoryFeeRate(3);
                      setQuoteItems([]);
                      setNextItemId(1);
                      setLastSavedAt(null);
                      setActiveTab('create');
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新建报价
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 报价列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                报价单列表
              </CardTitle>
              <CardDescription>
                共 {totalCount} 条记录，当前第 {currentPage}/{totalPages} 页
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingList ? (
                /* 加载骨架屏 */
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="h-4 w-[180px]" />
                      <Skeleton className="h-4 w-[120px]" />
                      <Skeleton className="h-4 w-[100px]" />
                      <Skeleton className="h-4 w-[80px]" />
                      <Skeleton className="h-4 w-[60px]" />
                    </div>
                  ))}
                </div>
              ) : quotes.length === 0 ? (
                /* 空状态 */
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ClipboardList />
                    </EmptyMedia>
                    <EmptyTitle>暂无报价记录</EmptyTitle>
                    <EmptyDescription>
                      {searchKeyword || statusFilter !== 'all'
                        ? '没有找到匹配的报价单，请调整搜索条件'
                        : '点击上方「新建报价」按钮创建第一份报价单'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                /* 列表表格 */
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">报价单号</TableHead>
                          <TableHead>项目名称</TableHead>
                          <TableHead className="w-[120px]">客户名称</TableHead>
                          <TableHead className="w-[100px]">报价总额</TableHead>
                          <TableHead className="w-[80px]">状态</TableHead>
                          <TableHead className="w-[160px]">创建时间</TableHead>
                          <TableHead className="w-[160px]">更新时间</TableHead>
                          <TableHead className="w-[80px] text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotes.map((quote) => (
                          <TableRow key={quote.id}>
                            <TableCell className="font-mono text-sm">
                              {quote.quote_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              {quote.project_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {quote.client_name || '-'}
                            </TableCell>
                            <TableCell className="font-semibold">
                              ¥{Number(quote.total).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(quote.status)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(quote.created_at).toLocaleString('zh-CN')}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(quote.updated_at).toLocaleString('zh-CN')}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handlePreviewFromList(quote)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    预览
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleLoadQuote(quote)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    编辑加载
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenStatusDialog(quote)}>
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    变更状态
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDeleteDialog(quote)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-4 flex justify-center">
                      {renderPagination()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 删除确认对话框 */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除报价单</DialogTitle>
                <DialogDescription>
                  您正在删除报价单「{deleteTarget?.quote_number} - {deleteTarget?.project_name}」，此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">报价单号：</span>
                      <span className="font-mono">{deleteTarget?.quote_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">项目名称：</span>
                      <span>{deleteTarget?.project_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">客户名称：</span>
                      <span>{deleteTarget?.client_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">报价总额：</span>
                      <span className="font-semibold">¥{deleteTarget ? Number(deleteTarget.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">管理密码</Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    placeholder="请输入管理密码以确认删除"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting || !deletePassword}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      确认删除
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 状态变更对话框 */}
          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>变更报价单状态</DialogTitle>
                <DialogDescription>
                  修改报价单「{statusTarget?.quote_number} - {statusTarget?.project_name}」的状态
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">报价单号：</span>
                      <span className="font-mono">{statusTarget?.quote_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">项目名称：</span>
                      <span>{statusTarget?.project_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">当前状态：</span>
                      {statusTarget && getStatusBadge(statusTarget.status)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">报价总额：</span>
                      <span className="font-semibold">¥{statusTarget ? Number(statusTarget.total).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>变更至</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择目标状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">草稿</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="submitted">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">已提交</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="approved">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">已审批</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <span className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">已驳回</Badge>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStatusDialogOpen(false)}
                  disabled={isChangingStatus}
                >
                  取消
                </Button>
                <Button
                  onClick={handleConfirmStatusChange}
                  disabled={isChangingStatus || !newStatus || newStatus === statusTarget?.status}
                >
                  {isChangingStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      变更中...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      确认变更
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {/* 预览对话框 */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl w-[calc(100%-2rem)] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                报价单预览
              </DialogTitle>
              <DialogDescription className="mt-1">{previewTitle}</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportFromPreview}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                导出Word
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <FileDown className="h-4 w-4 mr-2" />
                打印
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border rounded-lg bg-white"
              title="报价单预览"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
