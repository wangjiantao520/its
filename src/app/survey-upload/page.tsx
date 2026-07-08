'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Download, Trash2, CheckCircle2, Calculator } from 'lucide-react';
import { parseSurveyExcel, generateQuoteFromSurvey, type SurveyFormData, type QuoteResult } from '@/lib/survey-parser';
import type { FullDeviceQuota } from '@/lib/device-quota-full';

const SurveyUploadPage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formData, setFormData] = useState<SurveyFormData | null>(null);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [contractYears, setContractYears] = useState<1 | 2 | 3>(1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
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
      setErrorMessage('文件解析失败，请检查文件格式');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
    setFormData(null);
  };

  const handleGenerateQuote = () => {
    if (!formData) {
      alert('请先上传或填写记录表数据');
      return;
    }
    
    const quote = generateQuoteFromSurvey(formData, '城区', '5×8', '3级', contractYears);
    setQuoteResult(quote);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">维保查勘问询信息记录表</h1>
          <p className="text-gray-600">上传记录表并生成报价</p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">文件上传</TabsTrigger>
            <TabsTrigger value="data">数据预览</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>上传维保查勘问询信息记录表</CardTitle>
                <CardDescription>支持Excel格式文件上传</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">合同年限：</span>
                          <select 
                            value={contractYears}
                            onChange={(e) => setContractYears(parseInt(e.target.value) as 1 | 2 | 3)}
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                          >
                            <option value={1}>1年期</option>
                            <option value={2}>2年期（95折）</option>
                            <option value={3}>3年期（9折）</option>
                          </select>
                        </div>
                      </div>
                      <Button onClick={handleReset}>
                        重新上传
                      </Button>
                      <Button onClick={handleGenerateQuote} className="bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        生成报价
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
                      <CardDescription>解析后的记录表数据</CardDescription>
                    </div>
                    {formData && (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">合同年限：</span>
                          <select 
                            value={contractYears}
                            onChange={(e) => setContractYears(parseInt(e.target.value) as 1 | 2 | 3)}
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                          >
                            <option value={1}>1年期</option>
                            <option value={2}>2年期（95折）</option>
                            <option value={3}>3年期（9折）</option>
                          </select>
                        </div>
                        <Button onClick={handleGenerateQuote} className="bg-green-600 hover:bg-green-700">
                          <Calculator className="w-4 h-4 mr-2" />
                          生成报价
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
                              <TableCell>前期是否有维保服务</TableCell>
                              <TableCell>{formData.basicInfo.previousService ? '是' : '否'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>备注</TableCell>
                              <TableCell>{formData.basicInfo.remarks || '-'}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">二、维保范围</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">1、计算机及移动办公类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.computers.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">2、文印及图文处理类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.printing.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">3、会议及音视频类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.avConference.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">4、网络通信类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.network.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">5、安防监控及出入管理类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.security.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">6、机房及动力保障类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.roomPower.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">7、办公环境及后勤保障类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.officeEnvironment.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">8、服务器及存储类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.servers.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">9、自助及专用业务类</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-500">设备数量：{formData.scope.selfService.filter(Boolean).length}</p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">四、甲方核心维保诉求</h3>
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
                              <TableCell>{formData.requirements.isResident ? '是' : '否'}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">五、预算与合作模式</h3>
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
                              <TableCell>{formData.budget.paymentMode || '-'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>按次计费提供质保</TableCell>
                              <TableCell>{formData.budget.singlePrice ? '是' : '否'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>质保期要求</TableCell>
                              <TableCell>{formData.budget.qualityGuarantee ? '是' : '否'}</TableCell>
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

              {quoteResult && (
                <Card className="border-green-500">
                  <CardHeader className="bg-green-50">
                    <CardTitle className="text-green-800 flex items-center space-x-2">
                      <CheckCircle2 className="w-6 h-6" />
                      <span>报价结果</span>
                    </CardTitle>
                    <CardDescription className="text-green-600">
                      根据记录表生成的维保报价单
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">合同年限</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-blue-600">
                            {quoteResult.contractYears}年
                            {quoteResult.contractYears === 2 && ' (95折)'}
                            {quoteResult.contractYears === 3 && ' (9折)'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">设备数量</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-blue-600">
                            {quoteResult.deviceCount}台
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">总报价</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600">
                            ¥{quoteResult.totalPrice.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">设备清单</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>序号</TableHead>
                            <TableHead>设备名称</TableHead>
                            <TableHead>分档</TableHead>
                            <TableHead>单价（元/年）</TableHead>
                            <TableHead>小计</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteResult.selectedDevices.map((item: FullDeviceQuota, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell>{item.level}档</TableCell>
                              <TableCell>¥{(item.year1TotalPrice || item.cityPrice || 0).toFixed(2)}</TableCell>
                              <TableCell>¥{(item.year1TotalPrice || item.cityPrice || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SurveyUploadPage;
