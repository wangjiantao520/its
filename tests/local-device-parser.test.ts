import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDeviceDictionary,
  parseDevicesLocal,
} from '../src/lib/local-device-parser';

const SAMPLE_QUOTAS = [
  { id: '40', name: '二层交换机', category: '网络基础设备', cityPrice: 3500, maintenanceRate: 0.05, year1TotalPrice: 3675 },
  { id: '82', name: '应用服务器', category: '服务器&存储', cityPrice: 25000, maintenanceRate: 0.05, year1TotalPrice: 26250 },
  { id: '51', name: '监控摄像头', category: '视频监控系统', cityPrice: 800, maintenanceRate: 0.05, year1TotalPrice: 840 },
  { id: '33', name: '激光打印机', category: '打印复印扫描类', cityPrice: 2200, maintenanceRate: 0.05 },
];

test('buildDeviceDictionary 归一化设备名', () => {
  const dict = buildDeviceDictionary(SAMPLE_QUOTAS);
  assert.equal(dict.has('二层交换机'), true);
  assert.equal(dict.has('二层交换机'.toLowerCase()), true);
  assert.equal(dict.size, 4);
});

test('parseDevicesLocal 从文本识别设备与数量', () => {
  const text = '3台二层交换机\n2台应用服务器\n监控摄像头1台';
  const result = parseDevicesLocal(text, SAMPLE_QUOTAS);
  assert.ok(result.devices.length >= 3, `应识别至少 3 台设备，实际 ${result.devices.length}`);
  const switchDevice = result.devices.find(d => d.deviceName.includes('交换机'));
  assert.ok(switchDevice, '应识别二层交换机');
  assert.equal(switchDevice?.quantity, 3);
  assert.equal(switchDevice?.matchedDeviceId, '40');
  assert.equal(switchDevice?.matchedPrice, 3500);
  const server = result.devices.find(d => d.deviceName.includes('服务器'));
  assert.equal(server?.quantity, 2);
  assert.equal(server?.matchedDeviceId, '82');
});

test('parseDevicesLocal 识别型号与使用年限', () => {
  const text = '华为S5735交换机，使用2年';
  const result = parseDevicesLocal(text, SAMPLE_QUOTAS);
  const device = result.devices[0];
  assert.ok(device, '应识别设备');
  assert.ok(device?.brand, '应识别品牌华为');
  assert.equal(device?.useYears, 2);
});

test('parseDevicesLocal 无法识别时返回空与建议', () => {
  const result = parseDevicesLocal('今天天气不错', SAMPLE_QUOTAS);
  assert.equal(result.devices.length, 0);
  assert.ok(result.suggestions.length > 0);
});
