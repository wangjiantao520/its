
#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';

const EXCEL_PATH = path.join(process.cwd(), 'assets/政企设备维保定额库及维保查勘问询信息记录表_20260526113332723.xlsx');
const OUTPUT_PATH = path.join(process.cwd(), 'src/lib/complete-device-data.ts');

console.log('📊 开始读取Excel文件...');

if (!fs.existsSync(EXCEL_PATH)) {
  console.error('❌ Excel文件不存在:', EXCEL_PATH);
  process.exit(1);
}

try {
  // 读取Excel文件
  const workbook = xlsx.readFile(EXCEL_PATH);
  
  console.log('✅ Excel文件读取成功！');
  console.log('📋 工作表列表:', workbook.SheetNames);
  
  // 查找设备定额库相关的工作表
  const targetSheetNames = ['设备定额库', '维保定额', '定额库', '政企设备维保定额库'];
  let targetSheetName = '';
  
  for (const sheetName of workbook.SheetNames) {
    for (const targetName of targetSheetNames) {
      if (sheetName.includes(targetName) || targetName.includes(sheetName)) {
        targetSheetName = sheetName;
        break;
      }
    }
    if (targetSheetName) break;
  }
  
  // 如果没找到，使用第一个工作表
  if (!targetSheetName &amp;&amp; workbook.SheetNames.length &gt; 0) {
    targetSheetName = workbook.SheetNames[0];
    console.log(`⚠️ 未找到设备定额库工作表，使用第一个工作表: ${targetSheetName}`);
  } else if (targetSheetName) {
    console.log(`✅ 找到目标工作表: ${targetSheetName}`);
  } else {
    console.error('❌ 没有找到可用的工作表');
    process.exit(1);
  }
  
  // 读取目标工作表数据
  const worksheet = workbook.Sheets[targetSheetName];
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`📊 工作表共 ${jsonData.length} 行数据`);
  
  // 分析数据结构
  console.log('\n🔍 前10行数据预览:');
  jsonData.slice(0, 10).forEach((row, index) =&gt; {
    console.log(`行 ${index + 1}:`, row);
  });
  
  // 查找表头行
  let headerRowIndex = 0;
  for (let i = 0; i &lt; Math.min(20, jsonData.length); i++) {
    const row = jsonData[i] as string[];
    if (row &amp;&amp; row.length &gt; 0) {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (rowStr.includes('名称') || rowStr.includes('型号') || rowStr.includes('定额') || rowStr.includes('维保')) {
        headerRowIndex = i;
        console.log(`\n📋 找到表头行: 第 ${i + 1} 行`);
        break;
      }
    }
  }
  
  const headers = jsonData[headerRowIndex] as string[];
  console.log('📋 表头字段:', headers);
  
  // 提取数据行（表头之后）
  const dataRows = jsonData.slice(headerRowIndex + 1);
  
  console.log(`\n📊 共找到 ${dataRows.length} 条数据行`);
  
  // 转换为结构化数据
  const devices = [];
  let validRowCount = 0;
  
  for (let i = 0; i &lt; dataRows.length; i++) {
    const row = dataRows[i] as string[];
    if (!row || row.length === 0) continue;
    
    // 检查是否有有效数据（至少包含名称）
    const nameIndex = headers.findIndex(h =&gt; h &amp;&amp; (h.includes('名称') || h.includes('name')));
    const hasName = nameIndex &gt;= 0 &amp;&amp; row[nameIndex];
    
    if (!hasName) {
      // 检查第一个单元格是否有内容
      if (!row[0] || String(row[0]).trim() === '') {
        continue;
      }
    }
    
    validRowCount++;
    
    // 创建设备数据
    const device: any = {
      id: `device-${String(validRowCount).padStart(3, '0')}`,
      serialNumber: validRowCount,
      dataSource: '政企设备维保定额库_2026'
    };
    
    // 映射字段
    headers.forEach((header, index) =&gt; {
      if (!header) return;
      
      const value = row[index];
      const headerLower = header.toLowerCase();
      
      // 字段映射
      if (headerLower.includes('名称')) {
        device.name = value || '';
      } else if (headerLower.includes('型号')) {
        device.model = value || '';
      } else if (headerLower.includes('品牌')) {
        device.brand = value || '';
      } else if (headerLower.includes('类别') || headerLower.includes('分类')) {
        device.category = value || '';
      } else if (headerLower.includes('规格')) {
        device.specification = value || '';
      } else if (headerLower.includes('单位')) {
        device.unit = value || '';
      } else if (headerLower.includes('等级') || headerLower.includes('分档')) {
        device.level = value || 'B';
      } else if (headerLower.includes('描述')) {
        device.levelDescription = value || '';
      } else if (headerLower.includes('价格') || headerLower.includes('报价')) {
        const priceValue = parseFloat(value) || 0;
        if (headerLower.includes('市区') || headerLower.includes('城市')) {
          device.cityPrice = priceValue;
        } else if (headerLower.includes('县城') || headerLower.includes('城镇')) {
          device.urbanPrice = priceValue;
        } else if (headerLower.includes('乡镇')) {
          device.townPrice = priceValue;
        } else if (headerLower.includes('农村')) {
          device.ruralPrice = priceValue;
        }
      }
    });
    
    // 设置默认值
    device.category = device.category || '其他设备类';
    device.unit = device.unit || '台';
    device.level = device.level || 'B';
    device.levelName = getLevelName(device.level);
    device.engineerLevel = getEngineerLevel(device.level);
    
    // 设置默认价格（如果没有从Excel读取到）
    if (!device.cityPrice) {
      const basePrice = getBasePriceByLevel(device.level);
      device.cityPrice = basePrice;
      device.urbanPrice = basePrice * 1.1;
      device.townPrice = basePrice * 1.5;
      device.ruralPrice = basePrice * 2.0;
    }
    
    // 填充其他必填字段的默认值
    device.inspectionLaborFee = device.cityPrice * 0.1;
    device.inspectionPersonCount = 1;
    device.inspectionDuration = 30;
    device.inspectionTimesPerYear = 4;
    device.inspectionContent = '常规巡检维护';
    device.inspectionFeeAnnual = device.inspectionLaborFee * device.inspectionTimesPerYear;
    device.trafficFee = 20;
    device.singleTripDuration = 15;
    device.connectionDuration = 2;
    device.onSiteConnectionLaborFee = device.cityPrice * 0.08;
    device.onSiteFeeAnnual = device.onSiteConnectionLaborFee * 2;
    device.inWarrantyFactor = 1.0;
    device.baseFaultCount = 1.5;
    device.depreciationFactor = 0.6;
    device.faultServiceCount = device.baseFaultCount * device.depreciationFactor;
    device.faultHandlerCount = 1;
    device.faultHandlingDuration = 60;
    device.faultHandlingLaborFee = device.cityPrice * 0.15;
    device.faultHandlingFeeTotal = device.faultHandlingLaborFee * device.faultServiceCount;
    device.toolAmortization = 5;
    device.consumableFee = 5;
    device.sparePartReserve = device.cityPrice * 0.2;
    device.coreMaintenanceContent = '日常维保服务';
    device.isActive = true;
    
    devices.push(device);
  }
  
  console.log(`\n✅ 成功提取 ${validRowCount} 条有效设备数据！`);
  
  // 显示设备分类统计
  const categories = {} as Record&lt;string, number&gt;;
  devices.forEach(d =&gt; {
    categories[d.category] = (categories[d.category] || 0) + 1;
  });
  
  console.log('\n📂 设备分类统计:');
  Object.entries(categories).forEach(([cat, count]) =&gt; {
    console.log(`  - ${cat}: ${count} 条`);
  });
  
  // 显示前5条数据预览
  console.log('\n📋 前5条设备数据预览:');
  devices.slice(0, 5).forEach(d =&gt; {
    console.log(`  ${d.serialNumber}. ${d.name} (${d.category}) - ¥${d.cityPrice}`);
  });
  
  // 生成TypeScript文件
  const tsContent = `import type { FullDeviceQuota } from './device-quota-full';

// 从Excel文件提取的完整${validRowCount}条设备数据
export const FULL_DEVICE_QUOTAS: FullDeviceQuota[] = ${JSON.stringify(devices, null, 2)};

// 获取设备分类列表
export function getDeviceCategories(): string[] {
  const categories = new Set(FULL_DEVICE_QUOTAS.map(d =&gt; d.category));
  return Array.from(categories);
}

// 根据分类获取设备列表
export function getDevicesByCategory(category: string): FullDeviceQuota[] {
  return FULL_DEVICE_QUOTAS.filter(d =&gt; d.category === category);
}

// 根据维保分档获取设备列表
export function getDevicesByLevel(level: string): FullDeviceQuota[] {
  return FULL_DEVICE_QUOTAS.filter(d =&gt; d.level === level);
}

// 根据ID获取设备
export function getDeviceById(id: string): FullDeviceQuota | undefined {
  return FULL_DEVICE_QUOTAS.find(d =&gt; d.id === id);
}

// 搜索设备
export function searchDevices(keyword: string): FullDeviceQuota[] {
  const lowerKeyword = keyword.toLowerCase();
  return FULL_DEVICE_QUOTAS.filter(d =&gt; 
    d.name.toLowerCase().includes(lowerKeyword) ||
    d.model.toLowerCase().includes(lowerKeyword) ||
    d.category.toLowerCase().includes(lowerKeyword)
  );
}

// 获取设备总数统计
export function getDeviceStats() {
  return {
    total: FULL_DEVICE_QUOTAS.length,
    categories: getDeviceCategories().length,
    byLevel: {
      A: FULL_DEVICE_QUOTAS.filter(d =&gt; d.level === 'A').length,
      B: FULL_DEVICE_QUOTAS.filter(d =&gt; d.level === 'B').length,
      C: FULL_DEVICE_QUOTAS.filter(d =&gt; d.level === 'C').length,
      D: FULL_DEVICE_QUOTAS.filter(d =&gt; d.level === 'D').length,
      E: FULL_DEVICE_QUOTAS.filter(d =&gt; d.level === 'E').length
    }
  };
}
`;
  
  fs.writeFileSync(OUTPUT_PATH, tsContent, 'utf8');
  console.log(`\n✅ 数据已保存到: ${OUTPUT_PATH}`);
  
  console.log('\n🎉 完成！');
  
} catch (error) {
  console.error('❌ 读取Excel文件失败:', error);
  process.exit(1);
}

// 辅助函数：根据等级获取等级名称
function getLevelName(level: string): string {
  const names: Record&lt;string, string&gt; = {
    'A': '标准型',
    'B': '基础型', 
    'C': '增强型',
    'D': '专业型',
    'E': '专家型'
  };
  return names[level] || '基础型';
}

// 辅助函数：根据等级获取工程师级别
function getEngineerLevel(level: string): string {
  const levels: Record&lt;string, string&gt; = {
    'A': '初级',
    'B': '初级',
    'C': '中级',
    'D': '高级',
    'E': '专家'
  };
  return levels[level] || '初级';
}

// 辅助函数：根据等级获取基础价格
function getBasePriceByLevel(level: string): number {
  const prices: Record&lt;string, number&gt; = {
    'A': 200,
    'B': 180,
    'C': 300,
    'D': 500,
    'E': 800
  };
  return prices[level] || 180;
}

