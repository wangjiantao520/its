
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_PATH = path.join(__dirname, 'assets', '自施工工序定额表（工程）.xlsx');

console.log('开始读取Excel文件...');
console.log('文件路径:', EXCEL_PATH);
console.log('文件是否存在:', fs.existsSync(EXCEL_PATH));

if (fs.existsSync(EXCEL_PATH)) {
  const workbook = xlsx.readFile(EXCEL_PATH);
  console.log('工作表列表:', workbook.SheetNames);
  
  workbook.SheetNames.forEach((sheetName) => {
    console.log('\n========================================');
    console.log('工作表:', sheetName);
    console.log('========================================');
    
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('前20行数据:');
    data.slice(0, 20).forEach((row, index) => {
      console.log(`行 ${index + 1}:`, row);
    });
    
    console.log(`\n总行数: ${data.length}`);
  });
} else {
  console.log('文件不存在！');
}

