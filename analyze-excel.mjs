
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const excelPath = path.join('/workspace/projects/assets', '政企设备维保定额库及维保查勘问询信息记录表_20260526113332723.xlsx');

console.log('📊 开始分析Excel文件...\n');

try {
  const buffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(buffer);
  
  console.log('📋 Excel工作表列表:');
  console.log('------------------------');
  workbook.SheetNames.forEach((name, index) => {
    console.log(`${index + 1}. ${name}`);
  });
  console.log('------------------------\n');

  // 详细分析每个工作表
  workbook.SheetNames.forEach((sheetName) => {
    console.log(`\n========================================`);
    console.log(`📄 工作表: ${sheetName}`);
    console.log(`========================================`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length > 0) {
      console.log(`📊 行数: ${data.length}`);
      console.log(`📊 列数: ${data[0] ? data[0].length : 0}`);
      
      // 显示前10行预览
      console.log('\n📋 数据预览 (前10行):');
      console.log('------------------------');
      data.slice(0, 10).forEach((row, index) => {
        console.log(`行${index + 1}:`, JSON.stringify(row));
      });
      console.log('------------------------');
      
      // 如果是设备定额表，分析列名
      if (sheetName.includes('设备') || sheetName.includes('定额')) {
        console.log('\n🏷️  列名分析:');
        console.log('------------------------');
        if (data[0]) {
          data[0].forEach((col, index) => {
            console.log(`列${index + 1}: ${col}`);
          });
        }
        console.log('------------------------');
      }
    } else {
      console.log('⚠️  此工作表为空');
    }
  });
  
  console.log('\n✅ Excel分析完成！');
  
} catch (error) {
  console.error('❌ 分析Excel出错:', error);
}
