import type { DatabaseClient } from '@/lib/database/client';

export interface DeviceImportRecord {
  category: string;
  name: string;
  brand: string;
  model: string;
  level: string;
  engineerLevel: string;
  annualFailureCount: number;
  inspectionLaborFee: number;
  visitServiceFee: number;
  trafficFee: number;
  faultHandlingFee: number;
  toolAmortization: number;
  consumableFee: number;
  sparePartReserve: number;
  sparePartFee: number;
  year1TotalPrice: number;
  year2TotalPrice: number;
  year3TotalPrice: number;
  urbanPrice: number;
  townPrice: number;
  ruralPrice: number;
  unit: string;
  note: string;
}

interface ExistingDeviceRow extends Record<string, unknown> {
  id: string | number | bigint;
  category: string;
  name: string;
  model: string | null;
}

export interface DeviceImportResult {
  imported: number;
  updated: number;
}

const IMPORT_BATCH_SIZE = 100;
const writableColumns = [
  'category', 'name', 'brand', 'model', 'level', 'engineer_level',
  'annual_failure_count', 'year_fault_rate', 'inspection_labor_fee', 'visit_service_fee',
  'traffic_fee', 'fault_handling_fee', 'tool_amortization', 'consumable_fee',
  'spare_part_reserve', 'spare_part_fee', 'year1_total_price',
  'year2_total_price', 'year3_total_price', 'urban_price', 'town_price',
  'rural_price', 'unit', 'note',
] as const;

function normalizedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function numericValue(value: unknown, rowNumber: number, columnName: string): number {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = typeof value === 'string'
    ? value.replace(/[¥￥,\s]/g, '')
    : value;
  const parsed = typeof normalized === 'number' ? normalized : Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`第 ${rowNumber} 行的${columnName}必须是非负数`);
  }
  return parsed;
}

export function parseDeviceRows(rows: readonly (readonly unknown[])[]): DeviceImportRecord[] {
  if (rows.length < 2) return [];
  const devices: DeviceImportRecord[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (row.every((value) => normalizedString(value) === '')) continue;
    const category = normalizedString(row[0]) || '未分类';
    const name = normalizedString(row[1]);
    if (!name) throw new Error(`第 ${index + 1} 行缺少设备名称`);
    devices.push({
      category,
      name,
      brand: normalizedString(row[2]),
      model: normalizedString(row[3]),
      level: normalizedString(row[4]),
      engineerLevel: normalizedString(row[5]) || '初级',
      annualFailureCount: numericValue(row[6], index + 1, '年故障次数'),
      inspectionLaborFee: numericValue(row[7], index + 1, '巡检人工费'),
      visitServiceFee: numericValue(row[8], index + 1, '上门服务费'),
      trafficFee: numericValue(row[9], index + 1, '交通费'),
      faultHandlingFee: numericValue(row[10], index + 1, '故障处理费'),
      toolAmortization: numericValue(row[11], index + 1, '工具仪表摊销'),
      consumableFee: numericValue(row[12], index + 1, '耗材费'),
      sparePartReserve: numericValue(row[13], index + 1, '备件风险准备金'),
      sparePartFee: numericValue(row[14], index + 1, '备件费'),
      year1TotalPrice: numericValue(row[15], index + 1, '第一年总价'),
      year2TotalPrice: numericValue(row[16], index + 1, '第二年总价'),
      year3TotalPrice: numericValue(row[17], index + 1, '第三年总价'),
      urbanPrice: numericValue(row[18], index + 1, '市区价格'),
      townPrice: numericValue(row[19], index + 1, '乡镇价格'),
      ruralPrice: numericValue(row[20], index + 1, '农村价格'),
      unit: normalizedString(row[21]) || '台',
      note: normalizedString(row[22]),
    });
  }

  const deduplicated = new Map<string, DeviceImportRecord>();
  for (const device of devices) {
    deduplicated.set(`${device.category}\0${device.name}\0${device.model}`, device);
  }
  return [...deduplicated.values()];
}

export function parseDelimitedDeviceText(content: string): DeviceImportRecord[] {
  const rows = content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split(line.includes('\t') ? '\t' : ','));
  return parseDeviceRows(rows);
}

function valuesSql(rowCount: number, columnCount: number, offset = 0): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => `(${
    Array.from({ length: columnCount }, (__, columnIndex) =>
      `$${offset + rowIndex * columnCount + columnIndex + 1}`
    ).join(', ')
  })`).join(', ');
}

function deviceParams(device: DeviceImportRecord): unknown[] {
  return [
    device.category, device.name, device.brand, device.model, device.level,
    device.engineerLevel, device.annualFailureCount, device.annualFailureCount,
    device.inspectionLaborFee,
    device.visitServiceFee, device.trafficFee, device.faultHandlingFee,
    device.toolAmortization, device.consumableFee, device.sparePartReserve,
    device.sparePartFee, device.year1TotalPrice, device.year2TotalPrice,
    device.year3TotalPrice, device.urbanPrice, device.townPrice,
    device.ruralPrice, device.unit, device.note,
  ];
}

async function importBatch(
  database: DatabaseClient,
  devices: readonly DeviceImportRecord[],
): Promise<DeviceImportResult> {
  const lookupParams = devices.flatMap(({ category, name, model }) => [category, name, model]);
  const lookup = await database.query<ExistingDeviceRow>(`
    WITH extras(category, name, model) AS (VALUES ${valuesSql(devices.length, 3)})
    SELECT quotas.id, quotas.category, quotas.name, quotas.model
    FROM device_quotas AS quotas
    INNER JOIN extras
      ON extras.category = quotas.category
     AND extras.name = quotas.name
     AND extras.model = COALESCE(quotas.model, '')
  `, lookupParams);
  const deviceKey = ({ category, name, model }: Pick<DeviceImportRecord, 'category' | 'name' | 'model'>) =>
    `${category}\0${name}\0${model}`;
  const ids = new Map(lookup.rows.map((row) => [
    `${row.category}\0${row.name}\0${row.model ?? ''}`,
    row.id,
  ]));
  const existing = devices.filter((device) => ids.has(deviceKey(device)));
  const fresh = devices.filter((device) => !ids.has(deviceKey(device)));

  let updated = 0;
  if (existing.length > 0) {
    const params = existing.flatMap((device) => [
      ids.get(deviceKey(device)),
      ...deviceParams(device),
    ]);
    const update = await database.query(`
      WITH extras(id, ${writableColumns.join(', ')}) AS (
        VALUES ${valuesSql(existing.length, writableColumns.length + 1)}
      )
      UPDATE device_quotas AS quotas SET
        category = extras.category, name = extras.name, brand = extras.brand,
        model = extras.model, level = extras.level, engineer_level = extras.engineer_level,
        annual_failure_count = extras.annual_failure_count::double precision,
        year_fault_rate = extras.year_fault_rate::double precision,
        inspection_labor_fee = extras.inspection_labor_fee::numeric,
        visit_service_fee = extras.visit_service_fee::numeric,
        traffic_fee = extras.traffic_fee::numeric,
        fault_handling_fee = extras.fault_handling_fee::numeric,
        tool_amortization = extras.tool_amortization::numeric,
        consumable_fee = extras.consumable_fee::numeric,
        spare_part_reserve = extras.spare_part_reserve::numeric,
        spare_part_fee = extras.spare_part_fee::numeric,
        year1_total_price = extras.year1_total_price::numeric,
        year2_total_price = extras.year2_total_price::numeric,
        year3_total_price = extras.year3_total_price::numeric,
        urban_price = extras.urban_price::numeric,
        town_price = extras.town_price::numeric,
        rural_price = extras.rural_price::numeric,
        unit = extras.unit, note = extras.note, updated_at = CURRENT_TIMESTAMP
      FROM extras WHERE quotas.id = extras.id::bigint
      RETURNING quotas.id
    `, params);
    updated = update.rowCount;
  }

  let imported = 0;
  if (fresh.length > 0) {
    const insert = await database.query(`
      INSERT INTO device_quotas (
        category, name, brand, model, level, engineer_level,
        annual_failure_count, year_fault_rate, inspection_labor_fee, visit_service_fee,
        traffic_fee, fault_handling_fee, tool_amortization, consumable_fee,
        spare_part_reserve, spare_part_fee, year1_total_price,
        year2_total_price, year3_total_price, urban_price, town_price,
        rural_price, unit, note
      )
      VALUES ${valuesSql(fresh.length, writableColumns.length)}
      RETURNING id
    `, fresh.flatMap(deviceParams));
    imported = insert.rowCount;
  }

  return { imported, updated };
}

export async function importDevices(
  database: DatabaseClient,
  devices: readonly DeviceImportRecord[],
): Promise<DeviceImportResult> {
  return await database.transaction(async (transaction) => {
    let imported = 0;
    let updated = 0;
    for (let offset = 0; offset < devices.length; offset += IMPORT_BATCH_SIZE) {
      const batch = await importBatch(transaction, devices.slice(offset, offset + IMPORT_BATCH_SIZE));
      imported += batch.imported;
      updated += batch.updated;
    }
    return { imported, updated };
  });
}
