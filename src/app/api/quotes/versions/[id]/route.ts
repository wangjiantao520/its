import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

// 认证中间件
function requireAuth(request: NextRequest) {
  const session = verifySession(request);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    };
  }
  return { authorized: true, session };
}

// GET - 获取指定版本详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { id } = await params;
    const versionId = parseInt(id);

    if (isNaN(versionId)) {
      return NextResponse.json(
        { success: false, error: '无效的版本ID' },
        { status: 400 }
      );
    }

    const [rows] = await pool.query(
      `SELECT id, quote_id, quote_type, version, data, change_summary, created_by, created_at
       FROM quote_versions
       WHERE id = ?`,
      [versionId]
    );

    if ((rows as any).length === 0) {
      return NextResponse.json(
        { success: false, error: '版本不存在' },
        { status: 404 }
      );
    }

    const version = (rows as any)[0];
    return NextResponse.json({
      success: true,
      data: {
        ...version,
        data: typeof version.data === 'string' ? JSON.parse(version.data) : version.data
      }
    });
  } catch (error) {
    console.error('获取版本详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取版本详情失败' },
      { status: 500 }
    );
  }
}

// POST - 恢复到指定版本
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { id } = await params;
    const versionId = parseInt(id);

    if (isNaN(versionId)) {
      return NextResponse.json(
        { success: false, error: '无效的版本ID' },
        { status: 400 }
      );
    }

    // 获取要恢复的版本数据
    const [versionRows] = await pool.query(
      'SELECT quote_id, quote_type, version, data FROM quote_versions WHERE id = ?',
      [versionId]
    );

    if ((versionRows as any).length === 0) {
      return NextResponse.json(
        { success: false, error: '版本不存在' },
        { status: 404 }
      );
    }

    const versionData = (versionRows as any)[0];
    const { quote_id, quote_type, version: sourceVersion, data } = versionData;
    const quoteData = typeof data === 'string' ? JSON.parse(data) : data;

    // 获取当前最大版本号
    const [maxVersionRows] = await pool.query(
      'SELECT COALESCE(MAX(version), 0) as maxVersion FROM quote_versions WHERE quote_id = ? AND quote_type = ?',
      [quote_id, quote_type]
    );
    const nextVersion = ((maxVersionRows as any)[0]?.maxVersion || 0) + 1;

    // 准备恢复到主表的数据
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 基础字段映射
    const fieldMappings: Record<string, string> = {
      projectName: 'project_name',
      clientName: 'client_name',
      contactPerson: 'contact_person',
      contactPhone: 'contact_phone',
      region: 'region',
      constructionArea: 'construction_area',
      managementRate: 'management_rate',
      profitRate: 'profit_rate',
      regulatoryRate: 'regulatory_rate',
      taxRate: 'tax_rate',
      subtotal: 'subtotal',
      managementFee: 'management_fee',
      profit: 'profit',
      regulatoryFee: 'regulatory_fee',
      tax: 'tax',
      total: 'total',
      serviceYears: 'service_years',
      engineerLevel: 'engineer_level',
      slaConfig: 'sla_config',
      subtotalBeforeDiscount: 'subtotal_before_discount',
      slaAdjustment: 'sla_adjustment',
      regionAdjustment: 'region_adjustment',
      subtotalAfterCoefficients: 'subtotal_after_coefficients',
      yearsDiscount: 'years_discount',
      bulkDiscount: 'bulk_discount',
      yearsDiscountAmount: 'years_discount_amount',
      bulkDiscountAmount: 'bulk_discount_amount',
      status: 'status',
      remark: 'remark'
    };

    for (const [jsField, dbField] of Object.entries(fieldMappings)) {
      if (jsField in quoteData) {
        updateFields.push(`${dbField} = ?`);
        updateValues.push(quoteData[jsField]);
      }
    }

    // 根据报价类型选择目标表（使用白名单方式，避免 SQL 标识符注入）
    const tableName = quote_type === 'maintenance' ? 'maintenance_quotes' : 'engineering_quotes';
    updateFields.push('version = ?');
    updateValues.push(nextVersion);
    updateValues.push(quote_id);

    // 直接使用表名，不使用 ?? 占位符
    await pool.query(
      `UPDATE \`${tableName}\` SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // 处理 items/devices JSON 字段
    if (quoteData.items) {
      await pool.query(
        `UPDATE \`${tableName}\` SET items = ? WHERE id = ?`,
        [JSON.stringify(quoteData.items), quote_id]
      );
    }
    if (quoteData.devices) {
      await pool.query(
        `UPDATE \`${tableName}\` SET devices = ? WHERE id = ?`,
        [JSON.stringify(quoteData.devices), quote_id]
      );
    }

    // 创建恢复后的新版本记录
    const createdBy = auth.session?.role || 'unknown';
    const changeSummary = `从版本 ${sourceVersion} 恢复到当前版本`;

    await pool.query(
      `INSERT INTO quote_versions (quote_id, quote_type, version, data, change_summary, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [quote_id, quote_type, nextVersion, JSON.stringify(quoteData), changeSummary, createdBy]
    );

    return NextResponse.json({
      success: true,
      data: {
        newVersion: nextVersion,
        restoredFrom: sourceVersion,
        message: `已成功从版本 ${sourceVersion} 恢复到版本 ${nextVersion}`
      }
    });
  } catch (error) {
    console.error('恢复版本失败:', error);
    return NextResponse.json(
      { success: false, error: '恢复版本失败' },
      { status: 500 }
    );
  }
}
