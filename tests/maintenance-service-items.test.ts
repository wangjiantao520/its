import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateServiceItems, type ServiceItem } from '../src/lib/maintenance-service-items';

function svc(partial: Partial<ServiceItem> & { name: string }): ServiceItem {
  return {
    id: partial.id ?? `svc-${partial.name}`,
    name: partial.name,
    description: partial.description ?? '',
    unit: partial.unit ?? '项',
    quantity: partial.quantity ?? 1,
    unitPrice: partial.unitPrice ?? 0,
    timesPerYear: partial.timesPerYear ?? 1,
    settledByActual: partial.settledByActual ?? false,
  };
}

test('calculateServiceItems 巡检类：单价×数量×年次数', () => {
  const items = [svc({ name: '例行巡检', unitPrice: 2200, quantity: 1, timesPerYear: 4 })];
  const calc = calculateServiceItems(items, 3);
  assert.equal(calc.results[0]?.yearCost, 8800);   // 2200×1×4
  assert.equal(calc.results[0]?.totalCost, 26400); // 8800×3
  assert.equal(calc.yearTotal, 8800);
  assert.equal(calc.total, 26400);
});

test('calculateServiceItems 精密空调类：次数=1，单价×数量', () => {
  const items = [svc({ name: '精密空调维护', unitPrice: 7420, quantity: 16, timesPerYear: 1 })];
  const calc = calculateServiceItems(items, 3);
  assert.equal(calc.results[0]?.yearCost, 118720); // 7420×16
  assert.equal(calc.results[0]?.totalCost, 356160); // ×3
});

test('calculateServiceItems 按实结算不计入固定总额', () => {
  const items = [svc({ name: '故障抢修', unitPrice: 3200, timesPerYear: 4, settledByActual: true })];
  const calc = calculateServiceItems(items, 3);
  assert.equal(calc.results[0]?.yearCost, 0);
  assert.equal(calc.results[0]?.totalCost, 0);
  assert.equal(calc.total, 0);
});

test('calculateServiceItems 多行合计与年限倍乘', () => {
  const items = [
    svc({ name: '例行巡检', unitPrice: 2200, timesPerYear: 4 }),
    svc({ name: '专项测试（季度）', unitPrice: 3600, timesPerYear: 4 }),
    svc({ name: '专项测试（半年）', unitPrice: 2800, timesPerYear: 2 }),
    svc({ name: '专项测试（年度）', unitPrice: 5800, timesPerYear: 1 }),
    svc({ name: '精密空调维护', unitPrice: 7420, quantity: 16, timesPerYear: 1 }),
  ];
  const calc = calculateServiceItems(items, 3);
  // 年费用：8800+14400+5600+5800+118720 = 153320（与原单第一部分小计一致）
  assert.equal(calc.yearTotal, 153320);
  // 3 年：459960（与原单一致）
  assert.equal(calc.total, 459960);
});

test('calculateServiceItems 非法年限/空列表边界', () => {
  assert.equal(calculateServiceItems([], 3).total, 0);
  const oneYear = calculateServiceItems([svc({ name: '巡检', unitPrice: 100, timesPerYear: 2 })], 1);
  assert.equal(oneYear.total, 200);
  const invalidYears = calculateServiceItems([svc({ name: '巡检', unitPrice: 100, timesPerYear: 2 })], 0);
  assert.equal(invalidYears.total, 200); // 年限降级为 1
});
