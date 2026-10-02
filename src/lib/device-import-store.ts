import type { DatabaseClient } from './database/client';
import type { DeviceImportItem, ImportStatus } from './device-imports';

interface DeviceImportRow extends Record<string, unknown> {
  id: string | number | bigint;
  category: string;
  name: string;
  model: string;
  level: string;
  engineer_level: string;
  device_count: string | number;
  need_spare_part: boolean;
  contract_years: string | number;
  device_data: unknown;
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

function rowToItem(row: DeviceImportRow): DeviceImportItem {
  const snapshot = (typeof row.device_data === 'string' ? JSON.parse(row.device_data) : row.device_data ?? {}) as Partial<DeviceImportItem>;
  return {
    id: toSafeId(row.id),
    category: row.category,
    name: row.name,
    model: row.model,
    level: row.level as DeviceImportItem['level'],
    engineerLevel: row.engineer_level as DeviceImportItem['engineerLevel'],
    deviceCount: Number(row.device_count),
    needSparePart: row.need_spare_part,
    contractYears: Number(row.contract_years),
    ...snapshot,
    status: row.status as ImportStatus,
    submittedBy: row.submitted_by,
    submittedAt: toDate(row.submitted_at),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? toDate(row.reviewed_at) : undefined,
    reviewComment: row.review_comment ?? undefined,
  };
}

async function insertDeviceImportRecord(
  database: DatabaseClient,
  item: Partial<DeviceImportItem>,
  submittedBy: string,
): Promise<string> {
  const snapshot = { ...item, submittedBy };
  const result = await database.query<{ id: string | number | bigint }>(`
    INSERT INTO device_imports
      (category, name, model, level, engineer_level, device_count,
       need_spare_part, contract_years, device_data, status, submitted_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'pending', $10)
    RETURNING id
  `, [
    item.category ?? '', item.name ?? '', item.model ?? '', item.level ?? 'B',
    item.engineerLevel ?? '初级', item.deviceCount ?? 1, item.needSparePart ?? false,
    item.contractYears ?? 1, JSON.stringify(snapshot), submittedBy,
  ]);
  return toSafeId(result.rows[0].id);
}

export async function insertDeviceImportBatch(
  database: DatabaseClient,
  items: readonly Partial<DeviceImportItem>[],
  submittedBy: string,
): Promise<string[]> {
  return database.transaction(async (client) => {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(await insertDeviceImportRecord(client, item, submittedBy));
    }
    return ids;
  });
}

export async function listDeviceImports(
  database: DatabaseClient,
  options: { status?: ImportStatus; submittedBy?: string } = {},
): Promise<DeviceImportItem[]> {
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
  const result = await database.query<DeviceImportRow>(
    `SELECT * FROM device_imports ${where} ORDER BY submitted_at DESC, id DESC`,
    params,
  );
  return result.rows.map(rowToItem);
}

export async function reviewDeviceImport(
  database: DatabaseClient,
  options: {
    id: string;
    action: 'approve' | 'reject';
    reviewedBy: string;
    cityPrice?: number;
    replaceExisting?: boolean;
    reviewComment?: string;
  },
): Promise<{ ok: true; quotaId?: string; quotaAction?: 'created' | 'updated' } | { ok: false; error: string }> {
  return database.transaction(async (client) => {
    const result = await client.query<DeviceImportRow>(
      'SELECT * FROM device_imports WHERE id = $1 FOR UPDATE',
      [options.id],
    );
    const row = result.rows[0];
    if (!row) return { ok: false, error: '记录不存在' };
    if (row.status !== 'pending') return { ok: false, error: '该申请已审核，请刷新列表' };

    if (options.action === 'reject') {
      await client.query(
        `UPDATE device_imports
         SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), review_comment = $2
         WHERE id = $3`,
        [options.reviewedBy, options.reviewComment ?? null, options.id],
      );
      return { ok: true };
    }

    if (options.cityPrice === undefined || !Number.isFinite(options.cityPrice) || options.cityPrice <= 0) {
      return { ok: false, error: '城区基准年价必须大于 0，申请仍保持待审核' };
    }

    const snapshot = (typeof row.device_data === 'string' ? JSON.parse(row.device_data) : row.device_data ?? {}) as Partial<DeviceImportItem>;
    const duplicateKey = JSON.stringify([row.category, row.name, row.model ?? '']);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [duplicateKey]);
    const existing = await client.query<{ id: string | number | bigint; is_active: boolean }>(
      `SELECT id, is_active FROM device_quotas
       WHERE category = $1 AND name = $2 AND COALESCE(model, '') = $3
       ORDER BY id FOR UPDATE`,
      [row.category, row.name, row.model ?? ''],
    );
    if (existing.rows.length > 1) {
      return { ok: false, error: '定额库中已有多条同分类、同名称、同型号记录，请先整理重复项；申请仍保持待审核' };
    }
    if (existing.rows.length === 1 && options.replaceExisting !== true) {
      return { ok: false, error: '定额库已存在相同设备，请在审核页确认更新后重试；申请仍保持待审核' };
    }

    const annualFaultCount = snapshot.faultServiceCount ?? snapshot.baseFaultCount ?? 0;
    const quotaData = {
      category: row.category,
      name: row.name,
      model: row.model ?? '',
      maintenance_tier: snapshot.levelName || `${row.level}档`,
      level: snapshot.deviceGrade ?? row.level,
      engineer_level: row.engineer_level,
      annual_fault_count: annualFaultCount,
      annual_failure_count: annualFaultCount,
      year_fault_rate: 0,
      inspection_labor_fee: snapshot.inspectionLaborFee ?? 0,
      inspection_person_count: snapshot.inspectionPersonCount ?? 1,
      inspection_duration: snapshot.inspectionDuration ?? 0,
      inspection_times_per_year: snapshot.inspectionTimesPerYear ?? 0,
      inspection_content: snapshot.inspectionContent ?? '',
      visit_service_fee: snapshot.onSiteFeeAnnual ?? 0,
      visit_person_count: 1,
      visit_duration: 0,
      visit_frequency: 0,
      traffic_fee: snapshot.trafficFee ?? 0,
      single_trip_duration: snapshot.singleTripDuration ?? 0,
      connection_duration: snapshot.connectionDuration ?? 0,
      on_site_connection_labor_fee: snapshot.onSiteConnectionLaborFee ?? 0,
      in_warranty_factor: snapshot.inWarrantyFactor ?? 1,
      base_fault_count: snapshot.baseFaultCount ?? 0,
      depreciation_factor: snapshot.depreciationFactor ?? 1,
      fault_service_count: snapshot.faultServiceCount ?? annualFaultCount,
      fault_handler_count: snapshot.faultHandlerCount ?? 1,
      fault_handling_duration: snapshot.faultHandlingDuration ?? 0,
      fault_handling_fee: snapshot.faultHandlingFeeTotal ?? 0,
      fault_handling_labor_fee: snapshot.faultHandlingLaborFee ?? 0,
      fault_handling_material_fee: 0,
      tool_amortization: snapshot.toolAmortization ?? 0,
      tool_details: snapshot.toolDetails ?? '',
      consumable_fee: snapshot.consumableFee ?? 0,
      consumable_details: snapshot.consumableDetails ?? '',
      spare_part_reserve: snapshot.sparePartReserve ?? 0,
      spare_part_fee: snapshot.sparePartFee ?? 0,
      spare_part_basis: snapshot.sparePartBasis ?? '',
      city_price: options.cityPrice,
      fault_handling_fee_total: snapshot.faultHandlingFeeTotal ?? 0,
      core_maintenance_content: snapshot.coreMaintenanceContent ?? '',
      sort_order: snapshot.serialNumber ?? 0,
      is_active: snapshot.isActive ?? true,
      unit: snapshot.unit || '台',
      year1_total_price: snapshot.year1TotalPrice ?? 0,
      year2_total_price: snapshot.year2TotalPrice ?? 0,
      year3_total_price: snapshot.year3TotalPrice ?? 0,
      urban_price: snapshot.urbanPrice ?? 0,
      town_price: snapshot.townPrice ?? 0,
      rural_price: snapshot.ruralPrice ?? 0,
      fault_handling_fee_detail: snapshot.faultHandlingFeeDetail === undefined ? '' : String(snapshot.faultHandlingFeeDetail),
    };
    const quotaColumns = Object.keys(quotaData) as (keyof typeof quotaData)[];
    const quotaValues = quotaColumns.map((column) => quotaData[column]);

    let quotaId: string;
    let quotaAction: 'created' | 'updated';
    if (existing.rows[0]) {
      const mutableColumns = quotaColumns.filter((column) =>
        column !== 'category' && column !== 'name' && column !== 'model'
      );
      if (snapshot.isActive === undefined) quotaData.is_active = existing.rows[0].is_active;
      const assignments = mutableColumns.map((column, index) => `${column} = $${index + 1}`).join(', ');
      const params = [
        ...mutableColumns.map((column) => quotaData[column]),
        existing.rows[0].id,
      ];
      const updated = await client.query<{ id: string | number | bigint }>(
        `UPDATE device_quotas SET ${assignments}, updated_at = now() WHERE id = $${params.length} RETURNING id`,
        params,
      );
      quotaId = String(updated.rows[0]?.id ?? existing.rows[0].id);
      quotaAction = 'updated';
    } else {
      const placeholders = quotaColumns.map((_, index) => `$${index + 1}`).join(', ');
      const inserted = await client.query<{ id: string | number | bigint }>(
        `INSERT INTO device_quotas (${quotaColumns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
        quotaValues,
      );
      quotaId = String(inserted.rows[0]?.id ?? '');
      quotaAction = 'created';
    }

    await client.query(
      `UPDATE device_imports
       SET status = 'approved', reviewed_by = $1, reviewed_at = now(), review_comment = $2,
           device_data = jsonb_set(
             jsonb_set(COALESCE(device_data, '{}'::jsonb), '{cityPrice}', to_jsonb($3::numeric), true),
             '{approvedQuotaId}', to_jsonb($4::text), true)
       WHERE id = $5`,
      [options.reviewedBy, options.reviewComment ?? null, options.cityPrice, quotaId, options.id],
    );
    return { ok: true, quotaId, quotaAction };
  });
}
