const fs = require('fs');

const filePath = '/workspace/projects/src/app/maintenance/page.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const oldCardHeader = `                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-green-600" />
                    报价计算结果
                    {useFullData && (
                      <Badge className="bg-green-100 text-green-700">完整计算逻辑</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {useFullData ? '完全复刻Excel公式，支持4个地区报价' : '基于维保定额库的专业报价'}
                  </CardDescription>
                </CardHeader>`;

const newCardHeader = `                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-green-600" />
                        报价计算结果
                        {useFullData && (
                          <Badge className="bg-green-100 text-green-700">完整计算逻辑</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {useFullData ? '完全复刻Excel公式，支持4个地区报价' : '基于维保定额库的专业报价'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">合同年限：</span>
                      <Select value={String(contractYears)} onValueChange={(v) => setContractYears(Number(v) as 1 | 2 | 3)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1年期</SelectItem>
                          <SelectItem value="2">2年期（95折）</SelectItem>
                          <SelectItem value="3">3年期（9折）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>`;

const newContent = content.replace(oldCardHeader, newCardHeader);
fs.writeFileSync(filePath, newContent);
console.log('✅ CardHeader updated successfully!');
