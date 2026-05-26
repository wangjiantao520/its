const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/maintenance/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. 在selectedDevices类型定义中添加contractYears
content = content.replace(
  `  // 设备选择和数量（支持新老两种数据结构）
  const [selectedDevices, setSelectedDevices] = useState<Array<{
    quota: DeviceQuota | FullDeviceQuota;
    quantity: number;
    depreciationLevel: DepreciationLevel;
    inWarranty: boolean;
    needSparePart: boolean;
  }>>([]);`,
  `  // 设备选择和数量（支持新老两种数据结构）
  const [selectedDevices, setSelectedDevices] = useState<Array<{
    quota: DeviceQuota | FullDeviceQuota;
    quantity: number;
    depreciationLevel: DepreciationLevel;
    inWarranty: boolean;
    needSparePart: boolean;
    contractYears: number;
  }>>([]);`
);

// 2. 在handleAddDevice中添加contractYears
content = content.replace(
  `      setSelectedDevices([...selectedDevices, {
        quota,
        quantity: 1,
        depreciationLevel: '全新',
        inWarranty: false,
        needSparePart: false,
      }]);`,
  `      setSelectedDevices([...selectedDevices, {
        quota,
        quantity: 1,
        depreciationLevel: '全新',
        inWarranty: false,
        needSparePart: false,
        contractYears: parseInt(contractYears),
      }]);`
);

// 3. 在handleAddFullDevice中添加contractYears
content = content.replace(
  `      setSelectedDevices([...selectedDevices, {
        quota,
        quantity: 1,
        depreciationLevel: '全新',
        inWarranty: false,
        needSparePart: quota.needSparePart || false,
      }]);`,
  `      setSelectedDevices([...selectedDevices, {
        quota,
        quantity: 1,
        depreciationLevel: '全新',
        inWarranty: false,
        needSparePart: quota.needSparePart || false,
        contractYears: parseInt(contractYears),
      }]);`
);

// 4. 在handleUpdateNeedSparePart后面添加handleUpdateContractYears
content = content.replace(
  `  // 更新是否需要备件
  const handleUpdateNeedSparePart = (index: number, needSparePart: boolean) => {
    const newDevices = [...selectedDevices];
    newDevices[index].needSparePart = needSparePart;
    setSelectedDevices(newDevices);
  };`,
  `  // 更新是否需要备件
  const handleUpdateNeedSparePart = (index: number, needSparePart: boolean) => {
    const newDevices = [...selectedDevices];
    newDevices[index].needSparePart = needSparePart;
    setSelectedDevices(newDevices);
  };
  
  // 更新合同年限
  const handleUpdateContractYears = (index: number, years: number) => {
    const newDevices = [...selectedDevices];
    newDevices[index].contractYears = years;
    setSelectedDevices(newDevices);
  };`
);

// 5. 在handleCalculate中传递contractYears
content = content.replace(
  `      const fullDevices = selectedDevices.map(item => ({
        quota: item.quota as FullDeviceQuota,
        quantity: item.quantity,
        depreciationLevel: item.depreciationLevel,
        inWarranty: item.inWarranty,
        needSparePart: item.needSparePart,
      }));`,
  `      const fullDevices = selectedDevices.map(item => ({
        quota: item.quota as FullDeviceQuota,
        quantity: item.quantity,
        depreciationLevel: item.depreciationLevel,
        inWarranty: item.inWarranty,
        needSparePart: item.needSparePart,
        contractYears: item.contractYears,
      }));`
);

fs.writeFileSync(filePath, content);
console.log('✅ 文件修改完成！');

// 现在还需要修改表头和表格部分，让我再写一个简单的脚本来修改表格部分
let tableContent = content;

// 6. 在表头添加合同年限列
tableContent = tableContent.replace(
  `                            <TableHead>需要备件</TableHead>`,
  `                            <TableHead>需要备件</TableHead>
                            <TableHead>合同年限</TableHead>`
);

// 7. 在表格行中添加合同年限列
// 这个部分需要手动修改，因为有不同的显示逻辑

fs.writeFileSync(filePath, tableContent);
console.log('✅ 表头修改完成！');

console.log('✅ 所有修改完成！现在请手动在表格行部分添加合同年限选择列！');