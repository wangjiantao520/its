'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, XSquare, MessageSquare } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { getDeviceImports, updateDeviceImportStatus, DeviceImportItem, ImportStatus } from '@/lib/roles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function DeviceReviewPage() {
  const { user } = useUser();
  const [imports, setImports] = useState<DeviceImportItem[]>(getDeviceImports());
  const [selectedItem, setSelectedItem] = useState<DeviceImportItem | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);

  const getStatusBadge = (status: ImportStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">待审核</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">已通过</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600">已拒绝</Badge>;
      default:
        return <Badge>未知</Badge>;
    }
  };

  const handleOpenApproveDialog = (item: DeviceImportItem) => {
    setSelectedItem(item);
    setDialogAction('approve');
    setReviewComment('');
    setIsDialogOpen(true);
  };

  const handleOpenRejectDialog = (item: DeviceImportItem) => {
    setSelectedItem(item);
    setDialogAction('reject');
    setReviewComment('');
    setIsDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (!selectedItem || !dialogAction) return;
    
    const status = dialogAction === 'approve' ? 'approved' : 'rejected';
    updateDeviceImportStatus(selectedItem.id, status, user.name, reviewComment);
    
    setImports(getDeviceImports());
    setIsDialogOpen(false);
    setSelectedItem(null);
    setDialogAction(null);
  };

  const pendingImports = imports.filter(item => item.status === 'pending');
  const reviewedImports = imports.filter(item => item.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">设备清单审核</h1>
          <p className="text-muted-foreground mt-1">审核ITS成员提交的设备清单</p>
        </div>
        {pendingImports.length > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            待审核: {pendingImports.length}
          </Badge>
        )}
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>待审核清单</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingImports.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">暂无待审核的清单</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>合同年限</TableHead>
                    <TableHead>需要备件</TableHead>
                    <TableHead>折旧程度</TableHead>
                    <TableHead>在保内</TableHead>
                    <TableHead>提交人</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingImports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.deviceName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.contractYears}年</TableCell>
                      <TableCell>{item.needSparePart ? '是' : '否'}</TableCell>
                      <TableCell>{item.depreciationLevel}</TableCell>
                      <TableCell>{item.inWarranty ? '是' : '否'}</TableCell>
                      <TableCell>{item.submittedBy}</TableCell>
                      <TableCell>{item.submittedAt.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleOpenApproveDialog(item)}
                          >
                            <CheckSquare className="h-4 w-4 mr-1" />
                            通过
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleOpenRejectDialog(item)}
                          >
                            <XSquare className="h-4 w-4 mr-1" />
                            拒绝
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {reviewedImports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>已审核记录</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备名称</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>合同年限</TableHead>
                    <TableHead>提交人</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>审核人</TableHead>
                    <TableHead>审核时间</TableHead>
                    <TableHead>审核意见</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewedImports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.deviceName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.contractYears}年</TableCell>
                      <TableCell>{item.submittedBy}</TableCell>
                      <TableCell>{item.submittedAt.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.reviewedBy || '-'}</TableCell>
                      <TableCell>{item.reviewedAt ? item.reviewedAt.toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        {item.reviewComment ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{item.reviewComment}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? '通过审核' : '拒绝审核'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve' 
                ? '您确定要通过这个设备清单的审核吗？' 
                : '请提供拒绝的原因（可选）'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">设备名称：</span>
                  <span className="font-medium">{selectedItem.deviceName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">数量：</span>
                  <span className="font-medium">{selectedItem.quantity}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">合同年限：</span>
                  <span className="font-medium">{selectedItem.contractYears}年</span>
                </div>
                <div>
                  <span className="text-muted-foreground">提交人：</span>
                  <span className="font-medium">{selectedItem.submittedBy}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>审核意见（可选）</Label>
                <Textarea 
                  placeholder="请输入审核意见..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button 
              className={dialogAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              onClick={handleConfirmAction}
            >
              {dialogAction === 'approve' ? '确认通过' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
