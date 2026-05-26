
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const EXCEL_PATH = path.join(process.cwd(), 'assets/政企设备维保定额库及维保查勘问询信息记录表_20260526113332723.xlsx');

console.log('📊 开始简单读取Excel文件...');

const workbook = xlsx.readFile(EXCEL_PATH);
console.log('✅ Excel文件读取成功！');
console.log('📋 工作表列表:', workbook.SheetNames);

// 读取所有工作表
workbook.SheetNames.forEach(sheetName =&gt; {
  console.log(`\n📋 === 工作表: ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log(`📊 行数: ${data.length}`);
  
  // 显示前15行
  console.log('\n🔍 前15行数据:');
  data.slice(0, 15).forEach((row, i) =&gt; {
    console.log(`行 ${i+1}:`, row);
  });
});

// 保存原始数据到JSON文件
const allData = {};
workbook.SheetNames.forEach(sheetName =&gt; {
  const worksheet = workbook.Sheets[sheetName];
  allData[sheetName] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
});

fs.writeFileSync(path.join(process.cwd(), 'excel-data.json'), JSON.stringify(allData, null, 2));
console.log('\n✅ 原始数据已保存到 excel-data.json');

