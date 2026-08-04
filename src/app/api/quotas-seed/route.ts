import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import {
  INTELLIGENT_PROJECT_QUOTA,
  SELF_CONSTRUCTION_QUOTA,
} from '@/lib/self-construction-quota';

const SEED_BATCH_SIZE = 100;

function placeholders(rows: number, columns: number): string {
  return Array.from({ length: rows }, (_, row) => `(${
    Array.from({ length: columns }, (__, column) => `$${row * columns + column + 1}`).join(', ')
  })`).join(', ');
}

async function seedQuotas(database: DatabaseClient): Promise<{
  selfInserted: number;
  intelligentInserted: number;
}> {
  return await database.transaction(async (transaction) => {
    let selfInserted = 0;
    for (let offset = 0; offset < SELF_CONSTRUCTION_QUOTA.length; offset += SEED_BATCH_SIZE) {
      const batch = SELF_CONSTRUCTION_QUOTA.slice(offset, offset + SEED_BATCH_SIZE);
      const inserted = await transaction.query(`
        INSERT INTO self_construction_quotas
          (id, item_id, category, name, unit, quantity, price, remark, sort_order)
        VALUES ${placeholders(batch.length, 9)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, batch.flatMap((item, index) => [
        item.id, item.id, item.category, item.name, item.unit, item.quantity,
        item.price, item.remark || '', offset + index,
      ]));
      selfInserted += inserted.rowCount;
    }

    let intelligentInserted = 0;
    for (let offset = 0; offset < INTELLIGENT_PROJECT_QUOTA.length; offset += SEED_BATCH_SIZE) {
      const batch = INTELLIGENT_PROJECT_QUOTA.slice(offset, offset + SEED_BATCH_SIZE);
      const inserted = await transaction.query(`
        INSERT INTO intelligent_project_quotas
          (id, item_id, serial_number, category, name, brand_model, description,
           deductible_tax_rate, unit, price, remark, sort_order)
        VALUES ${placeholders(batch.length, 12)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, batch.flatMap((item, index) => [
        item.id, item.id, item.serialNumber, item.category, item.name,
        item.brandModel || '', item.description || '', item.deductibleTaxRate,
        item.unit, item.price, item.remark || '', offset + index,
      ]));
      intelligentInserted += inserted.rowCount;
    }
    return { selfInserted, intelligentInserted };
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const data = await seedQuotas(getDatabase());
    return NextResponse.json({
      success: true,
      message: `初始化完成：自施工 ${data.selfInserted} 条，智能化 ${data.intelligentInserted} 条`,
      data,
    });
  } catch (error) {
    console.error('初始化定额数据失败:', error);
    return NextResponse.json(
      { success: false, error: '初始化定额数据失败' },
      { status: 500 },
    );
  }
}
