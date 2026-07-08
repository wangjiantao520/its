import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function parseExcel() {
  // 读取本地文件
  const filePath = '/workspace/projects/assets/ZW云数据中心维保项目报价表..xlsx';
  
  const workbook = XLSX.readFile(filePath);
  
  console.log('=== Sheet Names ===');
  console.log(workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // 打印前50行
    for (let i = 0; i < Math.min(50, data.length); i++) {
      console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
  }
}

parseExcel().catch(console.error);
