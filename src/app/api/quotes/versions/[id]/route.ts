import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';
import { asQuoteSource, canAccessQuote } from '@/lib/quote-access';

// GET - 获取指定版本详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const versionId = parseInt(id);

    if (isNaN(versionId)) {
      return NextResponse.json(
        { success: false, error: '无效的版本ID' },
        { status: 400 }
      );
    }

    const version = db.prepare(
      `SELECT id, quote_id, quote_type, version, data, change_summary, created_by, created_at
       FROM quote_versions
       WHERE id = ?`,
    ).get(versionId) as Record<string, unknown> | undefined;

    if (!version) {
      return NextResponse.json(
        { success: false, error: '版本不存在' },
        { status: 404 }
      );
    }

    const source = asQuoteSource(String(version.quote_type));
    if (!source || !canAccessQuote(db, auth.session, source, Number(version.quote_id))) {
      return NextResponse.json({ success: false, error: '版本不存在或无权访问' }, { status: 404 });
    }
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
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

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
    const versionData = db.prepare(
      'SELECT quote_id, quote_type, version, data FROM quote_versions WHERE id = ?',
    ).get(versionId) as {
      quote_id: number;
      quote_type: string;
      version: number;
      data: string;
    } | undefined;

    if (!versionData) {
      return NextResponse.json(
        { success: false, error: '版本不存在' },
        { status: 404 }
      );
    }

    const { quote_id, quote_type, version: sourceVersion, data } = versionData;
    const source = asQuoteSource(quote_type);
    if (!source || !canAccessQuote(db, auth.session, source, Number(quote_id))) {
      return NextResponse.json({ success: false, error: '版本不存在或无权访问' }, { status: 404 });
    }
    const quoteData = typeof data === 'string' ? JSON.parse(data) : data;

    if (!quoteData || typeof quoteData !== 'object' || Array.isArray(quoteData)) {
      return NextResponse.json({ success: false, error: '版本数据格式无效' }, { status: 400 });
    }
    const restored = quoteData as Record<string, unknown>;

    const sqlValue = (value: unknown): string | number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string' || typeof value === 'number') return value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      return JSON.stringify(value);
    };
    const createdBy = auth.session.name || auth.session.username || auth.session.role;
    const changeSummary = `从版本 ${sourceVersion} 恢复到当前版本`;

    const restoreVersion = db.transaction(() => {
      const maximum = db.prepare(`
        SELECT COALESCE(MAX(version), 0) AS maxVersion
        FROM quote_versions
        WHERE quote_id = ? AND quote_type = ?
      `).get(quote_id, quote_type) as { maxVersion: number };
      const nextVersion = maximum.maxVersion + 1;

      if (source === 'quotation') {
        const updated = db.prepare(
        `UPDATE quotation_records
         SET client_name = ?, project_name = ?, total_amount = ?, quote_data = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        ).run(
          restored.clientName ?? restored.client_name ?? '',
          restored.projectName ?? restored.project_name ?? '',
          restored.total ?? restored.totalAmount ?? restored.total_amount ?? 0,
          JSON.stringify(restored),
          quote_id,
        );
        if (updated.changes !== 1) throw new Error('报价不存在');
      } else {
        const commonMappings: Record<string, string> = {
        projectName: 'project_name', clientName: 'client_name', contactPerson: 'contact_person',
        contactPhone: 'contact_phone', subtotal: 'subtotal', tax: 'tax', total: 'total', status: 'status',
        };
        const sourceMappings = source === 'engineering'
          ? {
            constructionArea: 'construction_area', managementRate: 'management_rate',
            profitRate: 'profit_rate', regulatoryRate: 'regulatory_rate', taxRate: 'tax_rate',
            managementFee: 'management_fee', profit: 'profit', regulatoryFee: 'regulatory_fee',
            }
          : {
            region: 'region', serviceYears: 'service_years', engineerLevel: 'engineer_level',
            slaConfig: 'sla_config', subtotalBeforeDiscount: 'subtotal_before_discount',
            slaAdjustment: 'sla_adjustment', regionAdjustment: 'region_adjustment',
            subtotalAfterCoefficients: 'subtotal_after_coefficients', yearsDiscount: 'years_discount',
            bulkDiscount: 'bulk_discount', yearsDiscountAmount: 'years_discount_amount',
            bulkDiscountAmount: 'bulk_discount_amount',
            };
        const updateFields: string[] = [];
        const updateValues: Array<string | number | null> = [];
        for (const [jsField, dbField] of Object.entries({ ...commonMappings, ...sourceMappings })) {
          if (jsField in restored) {
            updateFields.push(`${dbField} = ?`);
            updateValues.push(sqlValue(restored[jsField]));
          }
        }
        updateFields.push('version = ?', 'updated_at = CURRENT_TIMESTAMP');
        updateValues.push(nextVersion, quote_id);
        const tableName = source === 'maintenance' ? 'maintenance_quotes' : 'engineering_quotes';
        const updated = db.prepare(
          `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE id = ?`,
        ).run(...updateValues);
        if (updated.changes !== 1) throw new Error('报价不存在');

        const detailField = source === 'maintenance' ? 'devices' : 'items';
        if (restored[detailField]) {
          db.prepare(`UPDATE ${tableName} SET ${detailField} = ? WHERE id = ?`)
            .run(JSON.stringify(restored[detailField]), quote_id);
        }
      }

      db.prepare(`
        INSERT INTO quote_versions
          (quote_id, quote_type, version, data, change_summary, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(quote_id, quote_type, nextVersion, JSON.stringify(quoteData), changeSummary, createdBy);
      return nextVersion;
    });
    const nextVersion = restoreVersion();

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
