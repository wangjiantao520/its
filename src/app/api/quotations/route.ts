import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db, pool } from '@/lib/db';

interface QuotationDeviceInput {
  device_name?: unknown;
  name?: unknown;
  brand?: unknown;
  model?: unknown;
  category?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  total_price?: unknown;
  maintenance_rate?: unknown;
  maintenance_fee?: unknown;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nonNegativeNumber(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// GET /api/quotations - 获取报价记录列表
export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('user_id');
    const userId = auth.session.role === 'admin'
      ? requestedUserId
      : String(auth.session.userId ?? -1);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const offset = (page - 1) * pageSize;

    let query = 'SELECT q.*, u.name, u.username FROM quotation_records q LEFT JOIN users u ON q.user_id = u.id';
    const params: any[] = [];

    if (userId) {
      query += ' WHERE q.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY q.created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [records] = await pool.execute(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM quotation_records q';
    const countParams: any[] = [];
    if (userId) {
      countQuery += ' WHERE q.user_id = ?';
      countParams.push(userId);
    }
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({ success: true, data: { records, total, page, pageSize } });
  } catch (error) {
    console.error('获取报价记录失败:', error);
    return NextResponse.json({ success: false, error: '获取报价记录失败' }, { status: 500 });
  }
}

// POST /api/quotations - 创建报价记录
export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { client_name, client_region, project_name, quote_type, total_amount, device_count, quote_data, devices } = body;
    const userId = auth.session.userId ?? -1;

    if (typeof client_name !== 'string' || !client_name.trim()) {
      return NextResponse.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }
    if (total_amount !== undefined && (!Number.isFinite(Number(total_amount)) || Number(total_amount) < 0)) {
      return NextResponse.json({ success: false, error: '报价金额必须是有效的非负数' }, { status: 400 });
    }
    if (devices !== undefined && !Array.isArray(devices)) {
      return NextResponse.json({ success: false, error: '设备明细格式无效' }, { status: 400 });
    }

    const normalizedDevices = (devices || []).map((rawDevice: QuotationDeviceInput) => {
      const deviceName = optionalText(rawDevice.device_name) || optionalText(rawDevice.name);
      const quantity = nonNegativeNumber(rawDevice.quantity, 1);
      const unitPrice = nonNegativeNumber(rawDevice.unit_price, 0);
      const totalPrice = nonNegativeNumber(rawDevice.total_price, 0);
      const maintenanceRate = nonNegativeNumber(rawDevice.maintenance_rate, 0);
      const maintenanceFee = nonNegativeNumber(rawDevice.maintenance_fee, 0);
      if (!deviceName || [quantity, unitPrice, totalPrice, maintenanceRate, maintenanceFee].includes(null)) {
        return null;
      }
      return {
        deviceName,
        brand: optionalText(rawDevice.brand),
        model: optionalText(rawDevice.model),
        category: optionalText(rawDevice.category),
        quantity: quantity as number,
        unitPrice: unitPrice as number,
        totalPrice: totalPrice as number,
        maintenanceRate: maintenanceRate as number,
        maintenanceFee: maintenanceFee as number,
      };
    });
    if (normalizedDevices.some((device: unknown) => device === null)) {
      return NextResponse.json(
        { success: false, error: '设备名称不能为空，数量和金额必须是有效的非负数' },
        { status: 400 },
      );
    }

    const serializedQuoteData = quote_data === undefined || quote_data === null
      ? null
      : JSON.stringify(quote_data);

    const createQuotation = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO quotation_records (user_id, client_name, client_region, project_name, quote_type, total_amount, device_count, quote_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        userId,
        client_name.trim(),
        optionalText(client_region),
        optionalText(project_name),
        optionalText(quote_type) || 'full',
        Number(total_amount) || 0,
        Number(device_count) || normalizedDevices.length,
        serializedQuoteData,
      );
      const quotationId = Number(result.lastInsertRowid);
      const insertDevice = db.prepare(
          'INSERT INTO quotation_devices (quotation_id, device_name, brand, model, category, quantity, unit_price, total_price, maintenance_rate, maintenance_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      for (const device of normalizedDevices) {
        if (!device) continue;
        insertDevice.run(
            quotationId,
            device.deviceName,
            device.brand,
            device.model,
            device.category,
            device.quantity,
            device.unitPrice,
            device.totalPrice,
            device.maintenanceRate,
            device.maintenanceFee,
        );
      }
      return quotationId;
    });

    const quotationId = createQuotation();

    return NextResponse.json({
      success: true,
      data: { message: '报价记录保存成功', id: quotationId },
    }, { status: 201 });
  } catch (error) {
    console.error('保存报价记录失败:', error);
    return NextResponse.json({ success: false, error: '保存报价记录失败' }, { status: 500 });
  }
}
