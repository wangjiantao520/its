import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARRIVAL_TIME_FACTORS,
  RESPONSE_TIME_FACTORS,
  SERVICE_TIME_FACTORS,
  calculateSLATotalFactor,
  normalizeSlaKey,
} from '../src/lib/device-quota-full';

test('normalizeSlaKey 归一化"内"与半角x 变体', () => {
  assert.equal(normalizeSlaKey('2小时'), '2小时');
  assert.equal(normalizeSlaKey('2小时内'), '2小时');
  assert.equal(normalizeSlaKey('8小时内'), '8小时');
  assert.equal(normalizeSlaKey('10分钟内'), '10分钟');
  assert.equal(normalizeSlaKey('30分钟内'), '30分钟');
  assert.equal(normalizeSlaKey('5x8'), '5×8');
  assert.equal(normalizeSlaKey('7x24'), '7×24');
});

test('factor 表兼容两种键写法', () => {
  assert.equal(ARRIVAL_TIME_FACTORS['2小时'], 1.2);
  assert.equal(ARRIVAL_TIME_FACTORS['2小时内'], 1.2);
  assert.equal(ARRIVAL_TIME_FACTORS['8小时内'], 1.0);
  assert.equal(RESPONSE_TIME_FACTORS['10分钟内'], 1.1);
  assert.equal(RESPONSE_TIME_FACTORS['30分钟内'], 1.0);
  assert.equal(SERVICE_TIME_FACTORS['5x8'], 1.0);
  assert.equal(SERVICE_TIME_FACTORS['7×8'], 1.2);
});

test('calculateSLATotalFactor 对任意键写法都不产生 NaN', () => {
  const base = {
    teamExperience: 1.2,
    securityLevel: 0.95,
    supportMode: 1.0,
    faultRecoveryTime: 1.0,
    arrivalTime: '2小时',
    responseTime: '10分钟',
    serviceTime: '5×8',
  };
  const variants: Array<Record<string, string | number>> = [
    { ...base },
    { ...base, arrivalTime: '2小时内' },
    { ...base, arrivalTime: '8小时内', responseTime: '30分钟内', serviceTime: '5x8' },
    { ...base, serviceTime: '7x24' },
    { ...base, responseTime: '10分钟内' },
  ];
  for (const variant of variants) {
    const factor = calculateSLATotalFactor(variant as never);
    assert.ok(Number.isFinite(factor), `factor 应为有限数，得到 ${factor}`);
    assert.ok(factor > 0, `factor 应为正数，得到 ${factor}`);
  }
});
