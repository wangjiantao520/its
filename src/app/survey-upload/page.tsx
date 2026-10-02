'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Trash2, Save, History, ArrowRight, AlertCircle } from 'lucide-react';
import { parseSurveyExcel, type SurveyFormData } from '@/lib/survey-parser';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface SurveyQuoteSummary {
  quotationId: string;
  quoteNumber: string | null;
  totalPrice: number;
  deviceCount: number;
  contractYears: number;
  updatedAt: string;
}

interface SurveyRecord {
  id: string;
  survey_data: SurveyFormData;
  quote_result: SurveyQuoteSummary | null;
  contract_years: number;
  created_at: string;
}

const SurveyUploadPage = () => {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formData, setFormData] = useState<SurveyFormData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [contractYears, setContractYears] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');

  const loadRecords = async () => {
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const result = await apiFetch<SurveyRecord[]>('/api/survey-records');
      if (result.success) setRecords(result.data || []);
      else setRecordsError(result.error || '加载查勘记录失败');
    } catch (error) {
      console.error('加载查勘记录失败:', error);
      setRecordsError('无法连接服务器，查勘记录未能加载');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const persistSurveyRecord = async (): Promise<string | null> => {
    if (!formData) {
      toast.error('没有可保存的查勘数据');
      return null;
    }
    if (savedRecordId) return savedRecordId;

    const result = await apiFetch<{ id: string }>('/api/survey-records', {
      method: 'POST',
      body: JSON.stringify({
        survey_data: formData,
        quote_result: null,
        contract_years: contractYears,
      }),
    });
    if (!result.success || !result.data?.id) {
      toast.error(result.error || '保存失败');
      return null;
    }
    setSavedRecordId(result.data.id);
    setRecordSaved(true);
    return result.data.id;
  };

  const handleSaveRecord = async () => {
    setSaving(true);
    try {
      const id = await persistSurveyRecord();
      if (id) {
        toast.success('已保存识别出的查勘信息');
        await loadRecords();
      }
    } catch (error) {
      toast.error('保存失败: ' + String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleContinueToQuote = async () => {
    if (!formData) return;
    setSaving(true);
    try {
      const id = await persistSurveyRecord();
      if (!id) return;
      await loadRecords();
      router.push(`/maintenance?surveyRecordId=${encodeURIComponent(id)}`);
    } catch (error) {
      toast.error('进入报价流程失败: ' + String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormData(null);
      setUploadSuccess(false);
      setRecordSaved(false);
      setSavedRecordId(null);
      setErrorMessage('');
    }
    e.currentTarget.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!/\.(xlsx|xls)$/i.test(selectedFile.name)) {
      setErrorMessage('仅支持 .xlsx 或 .xls 格式');
      return;
    }
    if (selectedFile.size === 0 || selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage('文件不能为空，且不能超过 10MB');
      return;
    }
    
    setIsUploading(true);
    setErrorMessage('');
    
    try {
      // 读取Excel文件
      const arrayBuffer = await selectedFile.arrayBuffer();
      const surveyData = parseSurveyExcel(arrayBuffer);
      
      setFormData(surveyData);
      setUploadSuccess(true);
    } catch (error) {
      console.error('解析失败:', error);
      setErrorMessage(error instanceof Error ? error.message : '文件解析失败，请检查文件格式');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
    setFormData(null);
    setRecordSaved(false);
    setSavedRecordId(null);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">维保查勘问询信息记录表</h1>
          <p className="text-gray-600">识别查勘信息后可继续创建正式维保报价；设备清单需按实际情况确认</p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">文件上传</TabsTrigger>
            <TabsTrigger value="data">数据预览</TabsTrigger>
            <TabsTrigger value="history">历史记录</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>上传维保查勘问询信息记录表</CardTitle>
                <CardDescription>仅解析并保存可识别字段；原始 Excel 不会上传或保存在系统中</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileSpreadsheet className="w-12 h-12 mb-4 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">点击选择文件</span>
                      </p>
                      <p className="text-xs text-gray-500">当前读取 A 列字段名、B 列对应值，识别单位、联系人、岗位、电话和前期维保项</p>
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

                {errorMessage && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{errorMessage}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  {selectedFile && !uploadSuccess && (
                    <Button 
                      onClick={handleUpload} 
                      disabled={isUploading}
                      className="flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isUploading ? '处理中...' : '上传并解析'}</span>
                    </Button>
                  )}
                  {uploadSuccess && (
                    <>
                      <Button onClick={handleReset}>
                        重新上传
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="data">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>数据预览</CardTitle>
                      <CardDescription>仅展示解析器成功识别的字段；未识别内容不会自动补成“否”或 0</CardDescription>
                    </div>
                    {formData && (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">合同年限（带入报价）：</span>
                          <select 
                            value={contractYears}
                            disabled={recordSaved}
                            onChange={(e) => { setContractYears(parseInt(e.target.value) as 1 | 2 | 3); setRecordSaved(false); setSavedRecordId(null); }}
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                          >
                            <option value={1}>1年</option>
                            <option value={2}>2年</option>
                            <option value={3}>3年</option>
                          </select>
                        </div>
                        <Button variant="outline" onClick={() => void handleSaveRecord()} disabled={saving || recordSaved}>
                          <Save className="w-4 h-4 mr-2" />
                          {saving ? '保存中…' : recordSaved ? '已保存' : '保存识别信息'}
                        </Button>
                        <Button onClick={() => void handleContinueToQuote()} disabled={saving}>
                          <ArrowRight className="w-4 h-4 mr-2" />
                          {saving ? '正在准备…' : '保存并创建正式报价'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {formData ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">一、基础维护信息</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>项目</TableHead>
                              <TableHead>内容</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>单位名称</TableCell>
                              <TableCell>{formData.basicInfo.companyName || '未识别'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>对接人</TableCell>
                              <TableCell>{formData.basicInfo.contactPerson || '未识别'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>对接人岗位</TableCell>
                              <TableCell>{formData.basicInfo.contactPosition || '未识别'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>联系电话</TableCell>
                              <TableCell>{formData.basicInfo.contactPhone || '未识别'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>前期是否有维保服务</TableCell>
                              <TableCell>{formData.basicInfo.previousService === null ? '未识别' : formData.basicInfo.previousService ? '是' : '否'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>备注</TableCell>
                              <TableCell>{formData.basicInfo.remarks || '未识别'}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">二、维保范围</h3>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <p>设备范围、逐台设备和数量没有从该文件中可靠识别。系统会带入客户信息与合同年限；请在维保报价页按实际设备选择定额并计算金额。</p>
                          <Button variant="outline" className="mt-3" onClick={() => void handleContinueToQuote()} disabled={saving}>
                            保存并带入客户信息，继续报价 <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">三、甲方核心维保诉求</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>项目</TableHead>
                              <TableHead>内容</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>是否需驻点服务</TableCell>
                              <TableCell>{formData.requirements.isResident === null ? '未识别' : formData.requirements.isResident ? '是' : '否'}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">四、预算与合作模式</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>项目</TableHead>
                              <TableHead>内容</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>期望的维保付费模式</TableCell>
                              <TableCell>{formData.budget.paymentMode || '未识别'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>按次计费提供质保</TableCell>
                              <TableCell>{formData.budget.singlePrice === null ? '未识别' : formData.budget.singlePrice ? '是' : '否'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>质保期要求</TableCell>
                              <TableCell>{formData.budget.qualityGuarantee === null ? '未识别' : formData.budget.qualityGuarantee ? '是' : '否'}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <FileSpreadsheet className="w-16 h-16 mb-4 opacity-50" />
                      <p>请先上传记录表文件</p>
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>历史记录</CardTitle>
                    <CardDescription>已保存的查勘记录</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => void loadRecords()}>
                    <History className="w-4 h-4 mr-2" />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recordsError ? (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{recordsError}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadRecords()}>重试</Button>
                    </div>
                  </div>
                ) : recordsLoading ? (
                  <div className="py-12 text-center text-gray-500" role="status">正在加载查勘记录…</div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <History className="w-16 h-16 mb-4 opacity-50" />
                    <p>暂无已保存的查勘记录</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>客户名称</TableHead>
                        <TableHead>联系人</TableHead>
                        <TableHead>合同年限（记录）</TableHead>
                        <TableHead>报价状态</TableHead>
                        <TableHead>保存时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.survey_data?.basicInfo?.companyName || '-'}</TableCell>
                          <TableCell>{record.survey_data?.basicInfo?.contactPerson || '-'}</TableCell>
                          <TableCell>{record.contract_years}年</TableCell>
                          <TableCell>{record.quote_result
                            ? `已生成正式报价${record.quote_result.quoteNumber ? ` ${record.quote_result.quoteNumber}` : ''}：${record.quote_result.deviceCount} 台 / ¥${Number(record.quote_result.totalPrice).toFixed(2)}`
                            : '仅保存查勘信息'}</TableCell>
                          <TableCell>{new Date(record.created_at).toLocaleString('zh-CN')}</TableCell>
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
    </div>
  );
};

export default SurveyUploadPage;
