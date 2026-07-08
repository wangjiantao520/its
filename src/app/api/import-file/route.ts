import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    // 读取文件内容
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // 将文件内容解析为文本（假设是 CSV 或制表符分隔的文本）
    const textContent = new TextDecoder().decode(bytes);
    
    // 解析文本内容为设备数据
    const devices = parseExcelContent(textContent);
    
    if (devices.length === 0) {
      return NextResponse.json({ error: '未解析到有效的设备数据' }, { status: 400 });
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
            annual_failure_count = ?, inspection_labor_fee = ?,
            visit_service_fee = ?, traffic_fee = ?, fault_handling_fee = ?,
            tool_amortization = ?, consumable_fee = ?, spare_part_reserve = ?,
            spare_part_fee = ?, year1_total_price = ?, year2_total_price = ?,
            year3_total_price = ?, urban_price = ?, town_price = ?,
            rural_price = ?, unit = ?, note = ?
          WHERE id = ?
        `).run(
          device.brand, device.model, device.level, device.engineer_level,
          device.annual_failure_count, device.inspection_labor_fee,
          device.visit_service_fee, device.traffic_fee, device.fault_handling_fee,
          device.tool_amortization, device.consumable_fee, device.spare_part_reserve,
          device.spare_part_fee, device.year1_total_price, device.year2_total_price,
          device.year3_total_price, device.urban_price, device.town_price,
          device.rural_price, device.unit, device.note,
          existing.id
        );
        updated++;
      } else {
        // 插入新记录
        db.prepare(`
          INSERT INTO device_quotas (
            category, name, brand, model, level, engineer_level,
            annual_failure_count, inspection_labor_fee, visit_service_fee,
            traffic_fee, fault_handling_fee, tool_amortization, consumable_fee,
            spare_part_reserve, spare_part_fee, year1_total_price, year2_total_price,
            year3_total_price, urban_price, town_price, rural_price, unit, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          device.category, device.name, device.brand, device.model,
          device.level, device.engineer_level, device.annual_failure_count,
          device.inspection_labor_fee, device.visit_service_fee,
          device.traffic_fee, device.fault_handling_fee,
          device.tool_amortization, device.consumable_fee,
          device.spare_part_reserve, device.spare_part_fee,
          device.year1_total_price, device.year2_total_price,
          device.year3_total_price, device.urban_price, device.town_price,
          device.rural_price, device.unit, device.note
        );
        imported++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      imported, 
      updated,
      message: `导入成功：新增 ${imported} 条，更新 ${updated} 条`
    });
  } catch (error) {
    console.error('Import file error:', error);
    return NextResponse.json({ 
      error: '导入失败',
      message: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

// 解析 Excel 内容
function parseExcelContent(content: string) {
  const devices = [];
  const lines = content.split('\n').filter(line => line.trim());

  // 跳过表头
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 尝试按制表符或逗号分割
    let parts = line.split('\t');
    if (parts.length < 2) {
      parts = line.split(',');
    }

    if (parts.length < 2) continue;

    // 解析字段（与模板列对应）
    const device = {
      category: parts[0]?.trim() || '未分类',
      name: parts[1]?.trim(),
      brand: parts[2]?.trim() || '',
      model: parts[3]?.trim() || '',
      level: parts[4]?.trim() || '',
      engineer_level: parseInt(parts[5]) || 1,
      annual_failure_count: parseFloat(parts[6]) || 0,
      inspection_labor_fee: parseFloat(parts[7]) || 0,
      visit_service_fee: parseFloat(parts[8]) || 0,
      traffic_fee: parseFloat(parts[9]) || 0,
      fault_handling_fee: parseFloat(parts[10]) || 0,
      tool_amortization: parseFloat(parts[11]) || 0,
      consumable_fee: parseFloat(parts[12]) || 0,
      spare_part_reserve: parseFloat(parts[13]) || 0,
      spare_part_fee: parseFloat(parts[14]) || 0,
      year1_total_price: parseFloat(parts[15]) || 0,
      year2_total_price: parseFloat(parts[16]) || 0,
      year3_total_price: parseFloat(parts[17]) || 0,
      urban_price: parseFloat(parts[18]) || 0,
      town_price: parseFloat(parts[19]) || 0,
      rural_price: parseFloat(parts[20]) || 0,
      unit: parts[21]?.trim() || '台',
      note: parts[22]?.trim() || ''
    };

    if (device.name) {
      devices.push(device);
    }
  }

  return devices;
}
