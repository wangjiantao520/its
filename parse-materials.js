const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'assets/设备辅材报价V1.xlsx';
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ 文件不存在:', filePath);
    process.exit(1);
  }
  
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['1'];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`📊 总行数: ${jsonData.length}`);
  console.log('');
  
  // 从第3行开始是数据（索引为2）
  const materials = [];
  
  for (let i = 2; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row.length >= 2) {
      const item = {
        name: String(row[1] || ''),
        unit: String(row[2] || ''),
        brand: String(row[3] || ''),
        model: String(row[4] || ''),
        specs: String(row[5] || ''),
        remark: String(row[6] || ''),
        price: Number(row[7] || 0)
      };
      
      if (item.name) {
        materials.push(item);
      }
    }
  }
  
  console.log(`✅ 共提取 ${materials.length} 条设备辅材数据`);
  console.log('');
  
  console.log('📋 前10条数据:');
  materials.slice(0, 10).forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} - ${item.brand} ${item.model} - ¥${item.price}`);
  });
  console.log('');
  
  // 创建TypeScript文件
  const tsContent = `// 设备辅材报价数据
// 来源: 设备辅材报价V1.xlsx

export interface MaterialItem {
  name: string;
  unit: string;
  brand: string;
  model: string;
  specs: string;
  remark: string;
  price: number;
}

export const MATERIAL_QUOTATION: MaterialItem[] = [
${materials.map(item => `  {
    name: "${item.name.replace(/"/g, '\\"')}",
    unit: "${item.unit.replace(/"/g, '\\"')}",
    brand: "${item.brand.replace(/"/g, '\\"')}",
    model: "${item.model.replace(/"/g, '\\"')}",
    specs: "${item.specs.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
    remark: "${item.remark.replace(/"/g, '\\"')}",
    price: ${item.price}
  }`).join(',\n')}
];

export default MATERIAL_QUOTATION;
`;

  fs.writeFileSync('src/lib/material-quotation.ts', tsContent);
  console.log('✅ 数据文件已创建: src/lib/material-quotation.ts');
  
} catch (error) {
  console.error('❌ 解析Excel文件失败:', error.message);
  console.error(error.stack);
}
