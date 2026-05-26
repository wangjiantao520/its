const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'assets/设备辅材报价V1.xlsx';
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ 文件不存在:', filePath);
    process.exit(1);
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  
  console.log('📊 Excel工作表列表:');
  sheetNames.forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`);
  });
  console.log('');
  
  sheetNames.forEach((sheetName, sheetIndex) => {
    console.log(`📄 工作表 ${sheetIndex + 1}: ${sheetName}`);
    console.log('─'.repeat(80));
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`行数: ${jsonData.length}`);
    if (jsonData.length > 0) {
      console.log(`列数: ${jsonData[0].length}`);
      console.log('');
      
      if (jsonData.length > 0) {
        console.log('📋 前几行数据:');
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          console.log(`  行${i + 1}:`, JSON.stringify(jsonData[i]));
        }
        console.log('');
      }
      
      const jsonObjects = XLSX.utils.sheet_to_json(worksheet);
      console.log('🔍 结构化数据（前5条）:');
      for (let i = 0; i < Math.min(5, jsonObjects.length); i++) {
        console.log(`  ${i + 1}.`, JSON.stringify(jsonObjects[i], null, 2));
      }
      console.log('');
    }
    console.log('');
  });
  
} catch (error) {
  console.error('❌ 读取Excel文件失败:', error.message);
  console.error(error.stack);
}
