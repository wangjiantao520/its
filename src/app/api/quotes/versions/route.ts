import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { db } from '@/lib/db';
import { getQuoteSummaries, type QuoteSource } from '@/lib/quote-summary';
import { canAccessQuote } from '@/lib/quote-access';

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
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { quoteId, quoteType, quoteData } = body;

    if (!quoteId || !quoteType || !quoteData || typeof quoteData !== 'object' || Array.isArray(quoteData)) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数: quoteId, quoteType, quoteData' },
        { status: 400 }
      );
    }

    if (!['maintenance', 'engineering', 'quotation'].includes(quoteType)) {
      return NextResponse.json(
        { success: false, error: '无效的报价类型' },
        { status: 400 }
      );
    }

    const createdBy = auth.session.role === 'admin' ? undefined : String(auth.session.userId ?? -1);
    const quote = getQuoteSummaries(db, { source: quoteType as QuoteSource, createdBy })
      .find((item) => item.id === Number(quoteId));
    if (!quote) {
      return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    }

    const versionCreatedBy = auth.session.name || auth.session.username || auth.session.role;
    const saveVersion = db.transaction(() => {
      const current = db.prepare(`
        SELECT version, data
        FROM quote_versions
        WHERE quote_id = ? AND quote_type = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(Number(quoteId), quoteType) as { version: number; data: string } | undefined;
      const nextVersion = (current?.version || 0) + 1;
      const prevData = current?.data
        ? JSON.parse(current.data) as Record<string, any>
        : null;
      const changeSummary = generateChangeSummary(prevData, quoteData);
      const result = db.prepare(`
        INSERT INTO quote_versions
          (quote_id, quote_type, version, data, change_summary, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        Number(quoteId),
        quoteType,
        nextVersion,
        JSON.stringify(quoteData),
        changeSummary.join('; '),
        versionCreatedBy,
      );
      return {
        versionId: Number(result.lastInsertRowid),
        version: nextVersion,
        changeSummary,
      };
    });
    const saved = saveVersion();

    return NextResponse.json({
      success: true,
      data: saved,
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
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

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

    if (!['maintenance', 'engineering', 'quotation'].includes(quoteType)) {
      return NextResponse.json(
        { success: false, error: '无效的报价类型' },
        { status: 400 }
      );
    }

    if (!canAccessQuote(db, auth.session, quoteType as QuoteSource, Number(quoteId))) {
      return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 });
    }

    const rows = db.prepare(
      `SELECT id, quote_id, quote_type, version, change_summary, created_by, created_at
       FROM quote_versions
       WHERE quote_id = ? AND quote_type = ?
       ORDER BY version DESC`,
    ).all(parseInt(quoteId), quoteType);

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
