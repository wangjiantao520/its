import assert from 'node:assert/strict';
import test from 'node:test';

import { splitRequirementRows } from '../src/lib/requirement-splitter';

const QUOTAS = [
  { id: '40', name: '二层交换机', category: '网络基础设备', cityPrice: 3500 },
  { id: '82', name: '应用服务器', category: '服务器&存储', cityPrice: 25000 },
  { id: '51', name: '监控摄像头', category: '视频监控系统', cityPrice: 800 },
];

test('splitRequirementRows 拆出工程材料与维保设备', () => {
  // 模拟金监局机房改造表的行（数组结构：名称/规格/位置/单位/数量/单价/.../总价）
  const rows: unknown[][] = [
    ['防静电活动地板', '600*600*35', '10楼', 'm2', 68, 220, '', '', '', 15857.6],
    ['配线架', '六类24位非屏蔽RJ45配线架', '10楼', '个/块', 15, 104.798, '', '', '', 1666.29],
    ['跳线', '六类非屏蔽RJ45网络跳线(1米)', '10楼', '条', 40, 4.148, '', '', '', 175.88],
    ['应用服务器', '机架式', '10楼', '台', 2, 0, '', '', '', 0],
    ['二层交换机', '24口', '10楼', '台', 1, 0, '', '', '', 0],
  ];

  const result = splitRequirementRows(rows, QUOTAS);

  // 工程材料：地板/配线架/跳线（未命中设备库）
  assert.equal(result.engineeringItems.length, 3);
  assert.equal(result.engineeringItems[0]?.customName, '防静电活动地板');
  assert.equal(result.engineeringItems[0]?.customPrice, 220);
  assert.equal(result.engineeringItems[0]?.quantity, 68);
  assert.equal(result.engineeringItems[0]?.location, '10楼');
  assert.equal(result.engineeringItems[1]?.customName, '配线架');
  assert.equal(result.engineeringItems[1]?.quantity, 15);

  // 维保设备：应用服务器/二层交换机（命中设备库）
  assert.equal(result.maintenanceDevices.length, 2);
  const server = result.maintenanceDevices.find((d) => d.deviceName.includes('服务器'));
  assert.ok(server);
  assert.equal(server?.matchedDeviceId, '82');
  assert.equal(server?.quantity, 2);
  const sw = result.maintenanceDevices.find((d) => d.deviceName.includes('交换机'));
  assert.equal(sw?.matchedDeviceId, '40');
});

test('splitRequirementRows 跳过合计/空行', () => {
  const rows: unknown[][] = [
    ['合计', '', '', '', '', '', '', '', '', 55854.89],
    ['', '', '', '', '', '', '', '', '', ''],
    ['配线架', '六类24位', '8楼', '个', 4, 104.798, '', '', '', 444.34],
  ];
  const result = splitRequirementRows(rows, QUOTAS);
  assert.equal(result.engineeringItems.length, 1);
  assert.equal(result.engineeringItems[0]?.customName, '配线架');
  assert.equal(result.engineeringItems[0]?.quantity, 4);
});
