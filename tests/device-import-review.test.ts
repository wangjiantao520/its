import assert from 'node:assert/strict';
import test from 'node:test';

import type { DatabaseClient, QueryResult } from '../src/lib/database/client';
import { reviewDeviceImport } from '../src/lib/device-import-store';
import { reviewDeviceSuggestion } from '../src/lib/device-suggestion-store';
import type { DeviceSuggestionPriceData } from '../src/lib/device-suggestions';

type TestRow = Record<string, unknown>;
type ImportRow = TestRow & {
  id: string;
  category: string;
  name: string;
  model: string;
  level: string;
  engineer_level: string;
  device_count: number;
  need_spare_part: boolean;
  contract_years: number;
  device_data: Record<string, unknown>;
  status: string;
  submitted_by: string;
  submitted_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_comment: string | null;
};

class DeviceImportReviewDatabase implements DatabaseClient {
  readonly statements: Array<{ text: string; params: readonly unknown[] }> = [];
  importRow: ImportRow = {
    id: '51', category: '网络设备', name: '接入交换机', model: 'S-24P',
    level: 'B', engineer_level: '中级', device_count: 12, need_spare_part: true,
    contract_years: 1,
    device_data: {
      inspectionLaborFee: 80, inspectionPersonCount: 2, inspectionDuration: 60,
      inspectionTimesPerYear: 4, inspectionContent: '年度巡检', onSiteFeeAnnual: 120,
      trafficFee: 35, singleTripDuration: 30, connectionDuration: 15,
      faultHandlingFeeTotal: 210, faultHandlingLaborFee: 150, toolAmortization: 20,
      consumableFee: 12, sparePartReserve: 30, sparePartFee: 10,
      cityPrice: 500, year1TotalPrice: 500, urbanPrice: 550, townPrice: 750,
      ruralPrice: 1000, unit: '台', isActive: true, serialNumber: 4,
      coreMaintenanceContent: '巡檢及故障處理',
    },
    status: 'pending', submitted_by: '成员甲', submitted_at: new Date(),
    reviewed_by: null, reviewed_at: null, review_comment: null,
  };
  existingQuotas: Array<{ id: number; is_active: boolean }> = [];
  transactionCalls = 0;
  nextQuotaId = 801;

  private result<Row extends TestRow>(rows: unknown[] = []): QueryResult<Row> {
    return { rows: rows as Row[], rowCount: rows.length };
  }

  async query<Row extends TestRow>(text: string, params: readonly unknown[] = []): Promise<QueryResult<Row>> {
    this.statements.push({ text, params });
    if (text.startsWith('SELECT * FROM device_imports')) {
      return this.result<Row>(this.importRow.status === 'missing' ? [] : [{ ...this.importRow }]);
    }
    if (text.startsWith('SELECT pg_advisory_xact_lock')) return this.result<Row>();
    if (text.startsWith('SELECT id, is_active FROM device_quotas')) {
      return this.result<Row>(this.existingQuotas);
    }
    if (text.startsWith('INSERT INTO device_quotas')) {
      const id = this.nextQuotaId++;
      this.existingQuotas = [{ id, is_active: true }];
      return this.result<Row>([{ id }]);
    }
    if (text.startsWith('UPDATE device_quotas SET')) {
      const id = Number(params.at(-1));
      return this.result<Row>([{ id }]);
    }
    if (text.startsWith('UPDATE device_imports')) {
      if (text.includes("status = 'rejected'")) {
        this.importRow.status = 'rejected';
        this.importRow.reviewed_by = String(params[0]);
        this.importRow.review_comment = params[1] === null ? null : String(params[1]);
      } else {
        this.importRow.status = 'approved';
        this.importRow.reviewed_by = String(params[0]);
        this.importRow.review_comment = params[1] === null ? null : String(params[1]);
        this.importRow.device_data = {
          ...this.importRow.device_data,
          cityPrice: Number(params[2]),
          approvedQuotaId: String(params[3]),
        };
      }
      return this.result<Row>([{ id: this.importRow.id }]);
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    return work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('device import approval writes a priced maintenance quota and links it atomically', async () => {
  const database = new DeviceImportReviewDatabase();
  const result = await reviewDeviceImport(database, {
    id: '51', action: 'approve', reviewedBy: '管理员', cityPrice: 620.5,
  });

  assert.deepEqual(result, { ok: true, quotaId: '801', quotaAction: 'created' });
  assert.equal(database.transactionCalls, 1);
  assert.equal(database.importRow.status, 'approved');
  assert.equal(database.importRow.device_data.cityPrice, 620.5);
  assert.equal(database.importRow.device_data.approvedQuotaId, '801');

  const insert = database.statements.find((statement) => statement.text.trimStart().startsWith('INSERT INTO device_quotas'));
  assert.ok(insert);
  const columns = insert.text.match(/INSERT INTO device_quotas \(([^)]+)\)/)?.[1]?.split(',').map((value) => value.trim());
  assert.ok(columns);
  assert.equal(insert.params[columns.indexOf('city_price')], 620.5);
  assert.equal(insert.params[columns.indexOf('name')], '接入交换机');
  assert.equal(insert.params[columns.indexOf('inspection_labor_fee')], 80);
});

test('device import approval requires explicit confirmation before replacing an existing quota', async () => {
  const database = new DeviceImportReviewDatabase();
  database.existingQuotas = [{ id: 88, is_active: false }];

  const result = await reviewDeviceImport(database, {
    id: '51', action: 'approve', reviewedBy: '管理员', cityPrice: 630,
  });

  assert.deepEqual(result, {
    ok: false,
    error: '定额库已存在相同设备，请在审核页确认更新后重试；申请仍保持待审核',
  });
  assert.equal(database.importRow.status, 'pending');
  assert.equal(database.statements.some((statement) => statement.text.startsWith('UPDATE device_imports')), false);
});

test('confirmed update changes the existing quota but preserves its active state when the request omits one', async () => {
  const database = new DeviceImportReviewDatabase();
  database.existingQuotas = [{ id: 88, is_active: false }];
  delete database.importRow.device_data.isActive;

  const result = await reviewDeviceImport(database, {
    id: '51', action: 'approve', reviewedBy: '管理员', cityPrice: 630, replaceExisting: true,
  });

  assert.deepEqual(result, { ok: true, quotaId: '88', quotaAction: 'updated' });
  const update = database.statements.find((statement) => statement.text.startsWith('UPDATE device_quotas SET'));
  assert.ok(update);
  const setPart = update.text.split(' SET ')[1]?.split(' WHERE ')[0] ?? '';
  const updateColumns = setPart.split(', ').map((assignment) => assignment.split(' = ')[0]);
  assert.equal(update.params[updateColumns.indexOf('is_active')], false);
  assert.equal(database.importRow.status, 'approved');
});

test('device import rejection changes only the request status and does not write a quota', async () => {
  const database = new DeviceImportReviewDatabase();
  const result = await reviewDeviceImport(database, {
    id: '51', action: 'reject', reviewedBy: '管理员', reviewComment: '资料不完整',
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(database.importRow.status, 'rejected');
  assert.equal(database.statements.some((statement) => statement.text.includes('device_quotas')), false);
});

test('device import approval refuses missing price, duplicate quota rows, and already-reviewed requests', async () => {
  const noPrice = new DeviceImportReviewDatabase();
  assert.deepEqual(await reviewDeviceImport(noPrice, {
    id: '51', action: 'approve', reviewedBy: '管理员', cityPrice: 0,
  }), { ok: false, error: '城区基准年价必须大于 0，申请仍保持待审核' });
  assert.equal(noPrice.statements.some((statement) => statement.text.startsWith('INSERT INTO device_quotas')), false);

  const duplicate = new DeviceImportReviewDatabase();
  duplicate.existingQuotas = [{ id: 88, is_active: true }, { id: 89, is_active: true }];
  const duplicateResult = await reviewDeviceImport(duplicate, {
    id: '51', action: 'approve', reviewedBy: '管理员', cityPrice: 630, replaceExisting: true,
  });
  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicate.importRow.status, 'pending');

  const reviewed = new DeviceImportReviewDatabase();
  reviewed.importRow.status = 'approved';
  assert.deepEqual(await reviewDeviceImport(reviewed, {
    id: '51', action: 'reject', reviewedBy: '管理员',
  }), { ok: false, error: '该申请已审核，请刷新列表' });
});

class DeviceSuggestionApprovalDatabase implements DatabaseClient {
  readonly statements: Array<{ text: string; params: readonly unknown[] }> = [];
  status = 'pending';
  existingQuotas: Array<{ id: number }> = [];

  private result<Row extends TestRow>(rows: unknown[] = []): QueryResult<Row> {
    return { rows: rows as Row[], rowCount: rows.length };
  }

  async query<Row extends TestRow>(text: string, params: readonly unknown[] = []): Promise<QueryResult<Row>> {
    this.statements.push({ text, params });
    const normalizedText = text.trimStart();
    if (normalizedText.includes('SELECT status FROM device_suggestions')) {
      return this.result<Row>([{ status: this.status }]);
    }
    if (normalizedText.startsWith('SELECT pg_advisory_xact_lock')) return this.result<Row>();
    if (normalizedText.startsWith('SELECT id FROM device_quotas')) return this.result<Row>(this.existingQuotas);
    if (normalizedText.startsWith('INSERT INTO device_quotas')) return this.result<Row>([{ id: 902 }]);
    if (normalizedText.includes("SET status = 'approved'")) {
      this.status = 'approved';
      return this.result<Row>();
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async transaction<T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return work(this);
  }

  async healthCheck(): Promise<void> {}
  async close(): Promise<void> {}
}

test('device suggestion approval stores the validated city price used by maintenance quotes', async () => {
  const database = new DeviceSuggestionApprovalDatabase();
  const priceData: DeviceSuggestionPriceData = {
    category: '网络设备', name: '汇聚交换机', brand: '厂商', model: 'S-48',
    specification: '48口', maintenanceTier: 'C档', level: 'C', engineerLevel: '中级',
    annualFaultCount: 1, aGearFaultCount: 0, bGearFaultCount: 0, cGearFaultCount: 1,
    dGearFaultCount: 0, eGearFaultCount: 0, faultProcessingDays: 1, inspectionDays: 1,
    onSiteCount: 1, inspectionLaborFee: 50, visitServiceFee: 80, trafficFee: 20,
    faultHandlingFee: 90, toolAmortization: 10, consumableFee: 5,
    sparePartReserve: 15, sparePartFee: 0, cityPrice: 675.25,
  };

  const result = await reviewDeviceSuggestion(database, {
    id: '77', action: 'approve', priceData, reviewedBy: '管理员',
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(database.status, 'approved');
  const insert = database.statements.find((statement) => statement.text.trimStart().startsWith('INSERT INTO device_quotas'));
  assert.ok(insert);
  const columns = insert.text.match(/INSERT INTO device_quotas\s*\(([^)]+)\)/)?.[1]?.split(',').map((value) => value.trim());
  assert.ok(columns);
  assert.equal(insert.params[columns.indexOf('city_price')], 675.25);
  assert.equal(insert.params[columns.indexOf('level')], 'C');
  assert.deepEqual(database.statements.find((statement) => statement.text.includes('pg_advisory_xact_lock'))?.params,
    [JSON.stringify(['网络设备', '汇聚交换机', 'S-48'])]);
});

test('device suggestion approval refuses a duplicate maintenance quota without changing the request', async () => {
  const database = new DeviceSuggestionApprovalDatabase();
  database.existingQuotas = [{ id: 903 }];
  const result = await reviewDeviceSuggestion(database, {
    id: '77', action: 'approve', reviewedBy: '管理员',
    priceData: {
      category: '网络设备', name: '汇聚交换机', brand: '', model: 'S-48', specification: '',
      maintenanceTier: 'C档', level: 'C', engineerLevel: '中级', cityPrice: 675.25,
      annualFaultCount: 0, aGearFaultCount: 0, bGearFaultCount: 0, cGearFaultCount: 0,
      dGearFaultCount: 0, eGearFaultCount: 0, faultProcessingDays: 0, inspectionDays: 0,
      onSiteCount: 0, inspectionLaborFee: 0, visitServiceFee: 0, trafficFee: 0,
      faultHandlingFee: 0, toolAmortization: 0, consumableFee: 0,
      sparePartReserve: 0, sparePartFee: 0,
    },
  });

  assert.deepEqual(result, {
    ok: false,
    error: '定额库已存在相同分类、名称和型号的设备，请在设备定额列表中维护现有记录',
  });
  assert.equal(database.status, 'pending');
  assert.equal(database.statements.some((statement) => statement.text.trimStart().startsWith('INSERT INTO device_quotas')), false);
});
