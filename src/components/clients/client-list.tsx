'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClientForm } from './client-form';
import { ClientHistory } from './client-history';
import {
  Search,
  Plus,
  Upload,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Building2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface Client {
  id?: number;
  client_code: string;
  name: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  region?: string;
  level: 'normal' | 'vip' | 'partner';
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

interface ClientListProps {
  onCreateQuote?: (client: Client) => void;
}

const levelLabels: Record<string, string> = {
  normal: '普通',
  vip: 'VIP',
  partner: '合作伙伴',
};

const levelColors: Record<string, 'secondary' | 'default' | 'outline'> = {
  normal: 'secondary',
  vip: 'default',
  partner: 'outline',
};

export function ClientList({ onCreateQuote }: ClientListProps) {
  const { token } = useUser();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Search / filter state
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        search,
        level: levelFilter === 'all' ? '' : levelFilter,
        region: regionFilter === 'all' ? '' : regionFilter,
      });
      const res = await fetch(`/api/clients?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setClients(data.data?.items ?? data.data ?? []);
        setTotal(data.data?.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, levelFilter, regionFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, levelFilter, regionFilter]);

  const handleAdd = () => {
    setEditingClient(null);
    setFormOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleViewHistory = (client: Client) => {
    setHistoryClient(client);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    fetchClients();
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingClient(null);
  };

  // Export clients to Excel
  const handleExport = () => {
    const exportData = clients.map((c) => ({
      客户编号: c.client_code,
      客户名称: c.name,
      联系人: c.contact_person ?? '',
      联系电话: c.contact_phone ?? '',
      邮箱: c.contact_email ?? '',
      地址: c.address ?? '',
      地区: c.region ?? '',
      等级: levelLabels[c.level] ?? c.level,
      备注: c.remark ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '客户列表');
    XLSX.writeFile(wb, '客户列表.xlsx');
  };

  // Import clients from Excel
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setFormLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Partial<Client>>(sheet);
      // POST each row as a new client (skip rows without name)
      for (const row of json) {
        if (!row.name) continue;
        await fetch('/api/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(row),
        });
      }
      fetchClients();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setFormLoading(false);
      e.target.value = '';
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">客户管理</h1>
        <p className="text-muted-foreground mt-1">管理客户信息，维护客户等级与联系资料</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">客户总数</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">VIP 客户</CardTitle>
            <Badge variant="default">VIP</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter((c) => c.level === 'vip').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">合作伙伴</CardTitle>
            <Badge variant="outline">合作伙伴</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.filter((c) => c.level === 'partner').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>客户列表</CardTitle>
              <CardDescription>
                共 {total} 条记录，第 {page}/{totalPages || 1} 页
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索客户名称..."
                  className="pl-9 w-[220px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Level filter */}
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="客户等级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部等级</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="partner">合作伙伴</SelectItem>
                </SelectContent>
              </Select>

              {/* Region filter */}
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="地区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部地区</SelectItem>
                  <SelectItem value="蕉城">蕉城</SelectItem>
                  <SelectItem value="福安">福安</SelectItem>
                  <SelectItem value="福鼎">福鼎</SelectItem>
                  <SelectItem value="霞浦">霞浦</SelectItem>
                  <SelectItem value="周宁">周宁</SelectItem>
                  <SelectItem value="寿宁">寿宁</SelectItem>
                  <SelectItem value="屏南">屏南</SelectItem>
                  <SelectItem value="古田">古田</SelectItem>
                  <SelectItem value="柘荣">柘荣</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-4 sm:flex-row">
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              新增客户
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              导出
            </Button>
            <div className="relative">
              <Button variant="outline" className="gap-2 w-full sm:w-auto" disabled={formLoading}>
                <Upload className="h-4 w-4" />
                导入
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleImport}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户编号</TableHead>
                <TableHead>客户名称</TableHead>
                <TableHead>联系人</TableHead>
                <TableHead>联系电话</TableHead>
                <TableHead>地区</TableHead>
                <TableHead>等级</TableHead>
                <TableHead className="w-[220px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    暂无客户数据
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id ?? client.client_code}>
                    <TableCell className="font-mono text-xs">{client.client_code}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{client.name}</span>
                        {client.address && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {client.address}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.contact_person ? (
                        <div className="flex flex-col">
                          <span>{client.contact_person}</span>
                          {client.contact_email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />
                              {client.contact_email}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.contact_phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {client.contact_phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{client.region ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant={levelColors[client.level] ?? 'secondary'}>
                        {levelLabels[client.level] ?? client.level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="查看历史报价"
                          onClick={() => handleViewHistory(client)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {onCreateQuote && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="创建报价"
                            onClick={() => onCreateQuote(client)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="编辑"
                          onClick={() => handleEdit(client)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                显示 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}，共 {total} 条
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit client dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? '编辑客户' : '新增客户'}</DialogTitle>
            <DialogDescription>
              {editingClient
                ? `正在编辑客户：${editingClient.name}`
                : '填写客户基本信息，系统将自动生成客户编号'}
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            client={editingClient}
            token={token}
            onSuccess={handleFormSuccess}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>

      {/* Client quote history dialog */}
      {historyClient && (
        <Dialog
          open={!!historyClient}
          onOpenChange={(open) => !open && setHistoryClient(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>客户报价历史</DialogTitle>
              <DialogDescription>
                {historyClient.name} — 共查看历史报价记录
              </DialogDescription>
            </DialogHeader>
            <ClientHistory clientId={historyClient.id} token={token} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
