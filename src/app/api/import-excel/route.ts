import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ success: false, error: '请提供文件URL' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    // 解析 Excel 文件
    const response = await client.fetch(url);
    
    if (response.status_code !== 0) {
      return NextResponse.json({ 
        error: '文件解析失败', 
        message: response.status_message 
      }, { status: 400 });
    }

    // 提取文本内容
    const textContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    // 解析文本内容为设备数据
    const devices = parseExcelContent(textContent);
    
    if (devices.length === 0) {
      return NextResponse.json({ success: false, error: '未解析到有效的设备数据' }, { status: 400 });
    }

    // 导入到数据库
    let imported = 0;
    let updated = 0;

    for (const device of devices) {
      // 检查是否已存在
      const existing = db.prepare(
        'SELECT id FROM device_quotas WHERE name = ? AND category = ?'
      ).get(device.name, device.category) as { id: number } | undefined;

      if (existing) {
        // 更新现有记录
        db.prepare(`
          UPDATE device_quotas SET
            brand = ?, model = ?, level = ?, engineer_level = ?,
            year_fault_rate = ?, inspection_labor_fee = ?,
            visit_service_fee = ?, traffic_fee = ?, fault_handling_fee_total = ?,
            tool_amortization = ?, consumable_fee = ?, spare_part_reserve = ?,
            spare_part_fee = ?,
            year1_total_price = ?, year2_total_price = ?, year3_total_price = ?,
            city_price = ?, town_price = ?, rural_price = ?,
            unit = ?, note = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          device.brand || null,
          device.model || null,
          device.level || null,
          device.engineer_level || null,
          device.year_fault_rate || 0,
          device.inspection_labor_price || 0,
          device.arrival_service_price || 0,
          device.traffic_price || 0,
          device.fault_handling_fee || 0,
          device.tool_amortization || 0,
          device.consumable_fee || 0,
          device.spare_part_reserve || 0,
          device.spare_parts_price || 0,
          device.year1_total_price || 0,
          device.year2_total_price || 0,
          device.year3_total_price || 0,
          device.city_price || 0,
          device.town_price || 0,
          device.rural_price || 0,
          device.unit || null,
          device.note || null,
          existing.id
        );
        updated++;
      } else {
        // 插入新记录
        db.prepare(`
          INSERT INTO device_quotas (
            category, name, brand, model, level, engineer_level,
            year_fault_rate, inspection_labor_fee, visit_service_fee,
            traffic_fee, fault_handling_fee_total, tool_amortization,
            consumable_fee, spare_part_reserve, spare_part_fee,
            year1_total_price, year2_total_price, year3_total_price,
            city_price, town_price, rural_price, unit, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          device.category || '未分类',
          device.name,
          device.brand || null,
          device.model || null,
          device.level || null,
          device.engineer_level || null,
          device.year_fault_rate || 0,
          device.inspection_labor_price || 0,
          device.arrival_service_price || 0,
          device.traffic_price || 0,
          device.fault_handling_fee || 0,
          device.tool_amortization || 0,
          device.consumable_fee || 0,
          device.spare_part_reserve || 0,
          device.spare_parts_price || 0,
          device.year1_total_price || 0,
          device.year2_total_price || 0,
          device.year3_total_price || 0,
          device.city_price || 0,
          device.town_price || 0,
          device.rural_price || 0,
          device.unit || null,
          device.note || null
        );
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `导入完成：新增 ${imported} 条，更新 ${updated} 条`,
      imported,
      updated,
      total: devices.length
    });

  } catch (error) {
    console.error('导入失败:', error);
    return NextResponse.json({ 
      error: '导入失败', 
      message: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}

// 解析 Excel 内容为设备数据
function parseExcelContent(content: string): Array<{
  category?: string;
  name: string;
  brand?: string;
  model?: string;
  level?: string;
  engineer_level?: string;
  year_fault_rate?: number;
  inspection_labor_price?: number;
  arrival_service_price?: number;
  traffic_price?: number;
  fault_handling_fee?: number;
  tool_amortization?: number;
  consumable_fee?: number;
  spare_part_reserve?: number;
  spare_parts_price?: number;
  year1_total_price?: number;
  year2_total_price?: number;
  year3_total_price?: number;
  city_price?: number;
  town_price?: number;
  rural_price?: number;
  unit?: string;
  note?: string;
}> {
  const devices: Array<{
    category?: string;
    name: string;
    brand?: string;
    model?: string;
    level?: string;
    engineer_level?: string;
    year_fault_rate?: number;
    inspection_labor_price?: number;
    arrival_service_price?: number;
    traffic_price?: number;
    fault_handling_fee?: number;
    tool_amortization?: number;
    consumable_fee?: number;
    spare_part_reserve?: number;
    spare_parts_price?: number;
    year1_total_price?: number;
    year2_total_price?: number;
    year3_total_price?: number;
    city_price?: number;
    town_price?: number;
    rural_price?: number;
    unit?: string;
    note?: string;
  }> = [];

  const lines = content.split('\n').filter(line => line.trim());
  
  // 跳过表头，从第2行开始解析
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 使用制表符或逗号分割
    const parts = line.split(/\t|,/).map(p => p.trim());
    
    // 至少需要分类、名称、型号等基本信息
    if (parts.length < 3) continue;

    // 尝试解析各列数据
    const device: typeof devices[0] = {
      category: parts[0] || '未分类',
      name: parts[1] || '',
      brand: parts[2] || '',
      model: parts[3] || '',
      level: parts[4] || '',
      engineer_level: parts[5] || '',
    };

    // 解析数值字段
    device.year_fault_rate = parseNumber(parts[6]);
    device.inspection_labor_price = parseNumber(parts[7]);   // 巡检费
    device.arrival_service_price = parseNumber(parts[8]);    // 上门费
    device.traffic_price = parseNumber(parts[9]);            // 交通费
    device.fault_handling_fee = parseNumber(parts[10]);      // 故障处理费
    device.tool_amortization = parseNumber(parts[11]);       // 工具仪表摊销
    device.consumable_fee = parseNumber(parts[12]);          // 耗材费
    device.spare_part_reserve = parseNumber(parts[13]);      // 备件风险准备金
    device.spare_parts_price = parseNumber(parts[14]);       // 备件费
    device.year1_total_price = parseNumber(parts[15]);
    device.year2_total_price = parseNumber(parts[16]);
    device.year3_total_price = parseNumber(parts[17]);
    device.city_price = parseNumber(parts[18]);
    device.town_price = parseNumber(parts[19]);
    device.rural_price = parseNumber(parts[20]);
    device.unit = parts[21] || '';
    device.note = parts[22] || '';

    // 只添加有名称的设备
    if (device.name) {
      devices.push(device);
    }
  }

  return devices;
}

// 解析数值
function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  // 移除货币符号和空格
  const cleaned = value.replace(/[¥￥,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
