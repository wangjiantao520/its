import type { DatabaseClient } from './database/client';
import type { DeviceSuggestionItem, DeviceSuggestionPriceData, SuggestionStatus } from './device-suggestions';

interface SuggestionRow extends Record<string, unknown> {
  id: string | number | bigint;
  source: string;
  quote_id: string;
  quote_number: string;
  project_name: string;
  category: string;
  name: string;
  brand: string;
  model: string;
  specification: string;
  maintenance_tier: string;
  level: string;
  engineer_level: string;
  temp_unit_price: string | number;
  quantity: string | number;
  location: string;
  comment: string;
  price_data: unknown;
  status: string;
  submitted_by: string;
  submitted_at: Date | string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  review_comment: string | null;
}

function toSafeId(value: string | number | bigint): string {
  return String(value);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function rowToItem(row: SuggestionRow): DeviceSuggestionItem {
  return {
    id: toSafeId(row.id),
    source: row.source as DeviceSuggestionItem['source'],
    quoteId: row.quote_id,
    quoteNumber: row.quote_number,
    projectName: row.project_name,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    specification: row.specification,
    maintenanceTier: row.maintenance_tier,
    level: row.level,
    engineerLevel: row.engineer_level,
    tempUnitPrice: Number(row.temp_unit_price),
    quantity: Number(row.quantity),
    location: row.location,
    comment: row.comment,
    status: row.status as SuggestionStatus,
    submittedBy: row.submitted_by,
    submittedAt: toDate(row.submitted_at),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? toDate(row.reviewed_at) : undefined,
    reviewComment: row.review_comment ?? undefined,
  };
}

export async function insertDeviceSuggestion(
  database: DatabaseClient,
  item: Partial<DeviceSuggestionItem>,
  submittedBy: string,
): Promise<string> {
  const result = await database.query<{ id: string | number | bigint }>(`
    INSERT INTO device_suggestions
      (source, quote_id, quote_number, project_name, category, name, brand, model,
       specification, maintenance_tier, level, engineer_level, temp_unit_price,
       quantity, location, comment, status, submitted_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending', $17)
    RETURNING id
  `, [
    item.source ?? 'engineering', item.quoteId ?? '', item.quoteNumber ?? '',
    item.projectName ?? '', item.category ?? '', item.name ?? '', item.brand ?? '',
    item.model ?? '', item.specification ?? '', item.maintenanceTier ?? 'C档',
    item.level ?? 'B', item.engineerLevel ?? '初级', item.tempUnitPrice ?? 0,
    item.quantity ?? 1, item.location ?? '', item.comment ?? '', submittedBy,
  ]);
  return toSafeId(result.rows[0].id);
}

export async function listDeviceSuggestions(
  database: DatabaseClient,
  options: { status?: SuggestionStatus; submittedBy?: string } = {},
): Promise<DeviceSuggestionItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }
  if (options.submittedBy) {
    params.push(options.submittedBy);
    conditions.push(`submitted_by = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await database.query<SuggestionRow>(
    `SELECT * FROM device_suggestions ${where} ORDER BY submitted_at DESC, id DESC`,
    params,
  );
  return result.rows.map(rowToItem);
}

// 审批批准时，把补录设备写入 device_quotas（列与 device-params/route.ts 的 INSERT 一致）
async function insertIntoDeviceQuotas(
  client: DatabaseClient,
  price: DeviceSuggestionPriceData,
): Promise<void> {
  await client.query(`
    INSERT INTO device_quotas
      (category, name, brand, model, specification, maintenance_tier,
       annual_fault_count, a_gear_fault_count, b_gear_fault_count, c_gear_fault_count,
       d_gear_fault_count, e_gear_fault_count, fault_processing_days, inspection_days,
       on_site_count, inspection_labor_fee, visit_service_fee, traffic_fee,
       fault_handling_fee, tool_amortization, consumable_fee, spare_part_reserve, spare_part_fee)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23)
  `, [
    price.category, price.name, price.brand, price.model, price.specification, price.maintenanceTier,
    price.annualFaultCount ?? 0, price.aGearFaultCount ?? 0, price.bGearFaultCount ?? 0,
    price.cGearFaultCount ?? 0, price.dGearFaultCount ?? 0, price.eGearFaultCount ?? 0,
    price.faultProcessingDays ?? 0, price.inspectionDays ?? 0, price.onSiteCount ?? 0,
    price.inspectionLaborFee ?? 0, price.visitServiceFee ?? 0, price.trafficFee ?? 0,
    price.faultHandlingFee ?? 0, price.toolAmortization ?? 0, price.consumableFee ?? 0,
    price.sparePartReserve ?? 0, price.sparePartFee ?? 0,
  ]);
}

export async function reviewDeviceSuggestion(
  database: DatabaseClient,
  options: {
    id: string;
    action: 'approve' | 'reject';
    priceData?: DeviceSuggestionPriceData;
    reviewedBy: string;
    comment?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  return database.transaction(async (client) => {
    const existing = await client.query<SuggestionRow>(
      'SELECT status FROM device_suggestions WHERE id = $1',
      [options.id],
    );
    if (!existing.rows[0]) return { ok: false, error: '补录请求不存在' };
    if (existing.rows[0].status !== 'pending') return { ok: false, error: '该补录请求已审核' };

    if (options.action === 'approve') {
      if (!options.priceData) return { ok: false, error: '批准时必须提供价格体系' };
      await insertIntoDeviceQuotas(client, options.priceData);
      await client.query(
        `UPDATE device_suggestions
         SET status = 'approved', price_data = $1, reviewed_by = $2,
             reviewed_at = now(), review_comment = $3
         WHERE id = $4`,
        [JSON.stringify(options.priceData), options.reviewedBy, options.comment ?? null, options.id],
      );
    } else {
      await client.query(
        `UPDATE device_suggestions
         SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), review_comment = $2
         WHERE id = $3`,
        [options.reviewedBy, options.comment ?? null, options.id],
      );
    }
    return { ok: true };
  });
}
