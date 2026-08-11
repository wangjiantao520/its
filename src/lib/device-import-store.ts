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

export async function insertDeviceImport(
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

export async function updateDeviceImportStatus(
  database: DatabaseClient,
  id: string,
  status: ImportStatus,
  reviewedBy: string,
  reviewComment?: string,
): Promise<boolean> {
  const result = await database.query<{ id: string | number | bigint }>(
    `UPDATE device_imports
     SET status = $1, reviewed_by = $2, reviewed_at = now(), review_comment = $3
     WHERE id = $4 RETURNING id`,
    [status, reviewedBy, reviewComment ?? null, id],
  );
  return result.rows.length > 0;
}
