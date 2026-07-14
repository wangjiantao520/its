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

// 生成变更摘要
function generateChangeSummary(
  prevData: Record<string, any> | null,
  newData: Record<string, any>
): string[] {
  if (!prevData) {
    return ['初始版本'];
  }

  const changes: string[] = [];
  const fieldsToTrack = [
    'projectName', 'clientName', 'contactPerson', 'contactPhone',
    'region', 'constructionArea', 'managementRate', 'profitRate',
    'regulatoryRate', 'taxRate', 'subtotal', 'total',
    'serviceYears', 'engineerLevel', 'status'
  ];

  const ignoreFields = ['id', 'quoteNumber', 'version', 'createdAt', 'updatedAt', 'created_at', 'updated_at'];

  for (const key of fieldsToTrack) {
    if (key in newData && key in prevData) {
      if (String(prevData[key]) !== String(newData[key])) {
        changes.push(`修改 ${key}: ${prevData[key]} → ${newData[key]}`);
      }
    } else if (key in newData && !(key in prevData)) {
      changes.push(`新增 ${key}: ${newData[key]}`);
    }
  }

  // 检查 items/devices 数组长度变化
  if (newData.items && prevData.items) {
    if (newData.items.length !== prevData.items.length) {
      changes.push(`项目数量: ${prevData.items.length} → ${newData.items.length}`);
    }
  }
  if (newData.devices && prevData.devices) {
    if (newData.devices.length !== prevData.devices.length) {
      changes.push(`设备数量: ${prevData.devices.length} → ${newData.devices.length}`);
    }
  }

  if (changes.length === 0) {
    changes.push('无变更');
  }

  return changes;
}

// POST - 保存当前报价为新版本
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { quoteId, quoteType, quoteData } = body;

    if (!quoteId || !quoteType || !quoteData) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数: quoteId, quoteType, quoteData' },
        { status: 400 }
      );
    }

    if (!['maintenance', 'engineering'].includes(quoteType)) {
      return NextResponse.json(
        { success: false, error: '无效的报价类型' },
        { status: 400 }
      );
    }

    // 获取当前最大版本号
    const [versionRows] = await pool.query(
      'SELECT COALESCE(MAX(version), 0) as maxVersion FROM quote_versions WHERE quote_id = ? AND quote_type = ?',
      [quoteId, quoteType]
    );
    const nextVersion = ((versionRows as any)[0]?.maxVersion || 0) + 1;

    // 获取上一个版本的数据用于生成变更摘要
    let prevData: Record<string, any> | null = null;
    if (nextVersion > 1) {
      const [prevRows] = await pool.query(
        'SELECT data FROM quote_versions WHERE quote_id = ? AND quote_type = ? ORDER BY version DESC LIMIT 1',
        [quoteId, quoteType]
      );
      if ((prevRows as any).length > 0) {
        prevData = (prevRows as any)[0].data;
      }
    }

    // 生成变更摘要
    const changeSummary = generateChangeSummary(prevData, quoteData);

    // 获取创建者信息
    const createdBy = auth.session?.role || 'unknown';

    // 插入新版本
    const [result] = await pool.query(
      `INSERT INTO quote_versions (quote_id, quote_type, version, data, change_summary, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [quoteId, quoteType, nextVersion, JSON.stringify(quoteData), changeSummary.join('; '), createdBy]
    );

    // 如果是第一个版本，同时更新主报价表的 version 字段
    if (nextVersion === 1) {
      // 使用白名单方式而不是动态表名拼接
      if (quoteType === 'maintenance') {
        await pool.query('UPDATE maintenance_quotes SET version = 1 WHERE id = ?', [quoteId]);
      } else {
        await pool.query('UPDATE engineering_quotes SET version = 1 WHERE id = ?', [quoteId]);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        versionId: (result as any)[0]?.insertId,
        version: nextVersion,
        changeSummary
      }
    });
  } catch (error) {
    console.error('保存报价版本失败:', error);
    return NextResponse.json(
      { success: false, error: '保存报价版本失败' },
      { status: 500 }
    );
  }
}

// GET - 获取报价版本列表
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = request.nextUrl.searchParams;
    const quoteId = searchParams.get('quoteId');
    const quoteType = searchParams.get('quoteType');

    if (!quoteId || !quoteType) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数: quoteId, quoteType' },
        { status: 400 }
      );
    }

    if (!['maintenance', 'engineering'].includes(quoteType)) {
      return NextResponse.json(
        { success: false, error: '无效的报价类型' },
        { status: 400 }
      );
    }

    const [rows] = await pool.query(
      `SELECT id, quote_id, quote_type, version, change_summary, created_by, created_at
       FROM quote_versions
       WHERE quote_id = ? AND quote_type = ?
       ORDER BY version DESC`,
      [parseInt(quoteId), quoteType]
    );

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('获取报价版本列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取报价版本列表失败' },
      { status: 500 }
    );
  }
}
