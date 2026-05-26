'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { addDeviceImport, getDeviceImports, DeviceImportItem, ImportStatus } from '@/lib/roles';
import { parseDeviceImportExcel, validateDeviceImportData, type DeviceImportFormData } from '@/lib/device-import-parser';

export default function DeviceImportPage() {
  const { user } = useUser();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formData, setFormData] = useState<DeviceImportFormData | null>(null);
  const [imports, setImports] = useState<DeviceImportItem[]>(getDeviceImports());
  const [errorMessage, setErrorMessage] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setErrorMessage([]);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const data = parseDeviceImportExcel(arrayBuffer);
      
      // 验证数据
      const validation = validateDeviceImportData(data);
      if (!validation.valid) {
        setErrorMessage(validation.errors);
        return;
      }
      
      setFormData(data);
      setUploadSuccess(true);
    } catch (error) {
      console.error('解析失败:', error);
      setErrorMessage(['文件解析失败，请检查文件格式']);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
    setFormData(null);
    setErrorMessage([]);
  };

  const handleSubmitImport = () => {
    if (!formData) return;
    
    formData.devices.forEach(device => {
      addDeviceImport({
        deviceName: device.deviceName,
        quantity: device.quantity,
        contractYears: device.contractYears,
        needSparePart: device.needSparePart,
        depreciationLevel: device.depreciationLevel,
        inWarranty: device.inWarranty,
        submittedBy: user.name,
      });
    });
    
    setImports(getDeviceImports());
    handleReset();
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">设备清单导入</h1>
          <p className="text-muted-foreground mt-1">上传设备清单Excel文件，提交后需管理员审核</p>
        </div>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">文件上传</TabsTrigger>
          <TabsTrigger value="history">导入记录</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>上传设备清单Excel文件</CardTitle>
              <CardDescription>
                支持Excel格式文件上传，需包含以下字段：设备名称、数量、合同年限、是否需要备件、折旧程度、是否在保内
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {errorMessage.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">数据验证失败</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                    {errorMessage.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!uploadSuccess ? (
                <>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileSpreadsheet className="w-12 h-12 mb-4 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">点击选择文件</span> 或拖放文件
                        </p>
                        <p className="text-xs text-gray-500">支持 .xlsx, .xls 格式</p>
                      </div>
                      <Input 
                        type="file" 
                        className="hidden" 
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>

                  {selectedFile && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                          <div>
                            <p className="font-medium text-blue-900">{selectedFile.name}</p>
                            <p className="text-sm text-blue-600">
                              {(selectedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={handleReset}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    {selectedFile && (
                      <Button 
                        onClick={handleUpload} 
                        disabled={isUploading}
                        className="flex items-center space-x-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{isUploading ? '解析中...' : '上传并解析'}</span>
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {formData && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 font-medium">文件解析成功！共 {formData.devices.length} 台设备</span>
                      </div>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">设备清单预览</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>序号</TableHead>
                                <TableHead>设备名称</TableHead>
                                <TableHead>数量</TableHead>
                                <TableHead>合同年限</TableHead>
                                <TableHead>需要备件</TableHead>
                                <TableHead>折旧程度</TableHead>
                                <TableHead>在保内</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {formData.devices.map((device, index) => (
                                <TableRow key={index}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell className="font-medium">{device.deviceName}</TableCell>
                                  <TableCell>{device.quantity}</TableCell>
                                  <TableCell>{device.contractYears}年</TableCell>
                                  <TableCell>{device.needSparePart ? '是' : '否'}</TableCell>
                                  <TableCell>{device.depreciationLevel}</TableCell>
                                  <TableCell>{device.inWarranty ? '是' : '否'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      <div className="flex justify-end gap-3">
                        <Button onClick={handleReset}>
                          重新上传
                        </Button>
                        <Button 
                          onClick={handleSubmitImport} 
                          className="bg-green-700 hover:bg-green-800"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          提交审核
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>导入记录</CardTitle>
            </CardHeader>
            <CardContent>
              {imports.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">暂无导入记录</p>
              ) : (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.deviceName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.contractYears}年</TableCell>
                        <TableCell>{item.submittedBy}</TableCell>
                        <TableCell>{item.submittedAt.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.reviewedBy || '-'}</TableCell>
                        <TableCell>{item.reviewedAt ? item.reviewedAt.toLocaleString() : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
