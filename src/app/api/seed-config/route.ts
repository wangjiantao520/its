import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';

interface CountRow extends Record<string, unknown> {
  count: string | number | bigint;
}

interface DeviceTypeRow extends Record<string, unknown> {
  device_type: string;
}

interface LevelNameRow extends Record<string, unknown> {
  level_name: string;
}

const maintenanceRates = [
  { deviceType: '网络设备', rate: 0.06, description: '交换机、路由器、防火墙等网络基础设施' },
  { deviceType: '服务器', rate: 0.05, description: '物理服务器、虚拟化主机' },
  { deviceType: '存储设备', rate: 0.06, description: 'SAN存储、NAS存储、备份存储' },
  { deviceType: '安全设备', rate: 0.08, description: '防火墙、WAF、入侵检测等' },
  { deviceType: '安防设备', rate: 0.02, description: '摄像机、录像机、门禁等' },
  { deviceType: '软件产品', rate: 0.12, description: '操作系统、数据库、中间件、云平台License' },
  { deviceType: '商密设备', rate: 0.07, description: '密码机、签名验签服务器、密钥管理系统' },
] as const;

const slaConfigs = [
  { levelName: '7*24小时特别保障', inspectionFrequency: '每月1次', responseTime: '15分钟内响应', fixTime: '4小时内修复', onSiteTime: '2小时内到场', description: '最高级别服务，适用于核心业务系统' },
  { levelName: '7*24小时标准保障', inspectionFrequency: '每季度1次', responseTime: '30分钟内响应', fixTime: '8小时内修复', onSiteTime: '4小时内到场', description: '标准级别服务，适用于重要业务系统' },
  { levelName: '5*8小时常规保障', inspectionFrequency: '每半年1次', responseTime: '2小时内响应', fixTime: '24小时内修复', onSiteTime: '次工作日到场', description: '基础级别服务，适用于一般业务系统' },
] as const;

function count(value: string | number | bigint): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('seed count exceeds safe integer range');
  return Number(parsed);
}

function placeholders(rows: number, columns: number): string {
  return Array.from({ length: rows }, (_, row) => `(${
    Array.from({ length: columns }, (__, column) => `$${row * columns + column + 1}`).join(', ')
  })`).join(', ');
}

async function seedConfig(database: DatabaseClient) {
  return await database.transaction(async (transaction) => {
    const existingRates = await transaction.query<DeviceTypeRow>(
      'SELECT device_type FROM maintenance_rate_config',
    );
    const existingRateTypes = new Set(existingRates.rows.map(({ device_type }) => device_type));
    const pendingRates = maintenanceRates.filter(({ deviceType }) => !existingRateTypes.has(deviceType));
    let rateImported = 0;
    if (pendingRates.length > 0) {
      const rates = await transaction.query(`
        INSERT INTO maintenance_rate_config (id, device_type, rate, maintenance_rate, description, sort_order)
        VALUES ${placeholders(pendingRates.length, 6)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, pendingRates.flatMap((rate) => {
        const index = maintenanceRates.indexOf(rate);
        return [-10_001 - index, rate.deviceType, rate.rate, rate.rate, rate.description, index];
      }));
      rateImported = rates.rowCount;
    }

    const existingSlas = await transaction.query<LevelNameRow>('SELECT level_name FROM sla_config');
    const existingSlaLevels = new Set(existingSlas.rows.map(({ level_name }) => level_name));
    const pendingSlas = slaConfigs.filter(({ levelName }) => !existingSlaLevels.has(levelName));
    let slaImported = 0;
    if (pendingSlas.length > 0) {
      const slas = await transaction.query(`
        INSERT INTO sla_config
          (id, level_name, inspection_frequency, response_time, fix_time, on_site_time, description, sort_order)
        VALUES ${placeholders(pendingSlas.length, 8)}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, pendingSlas.flatMap((sla) => {
        const index = slaConfigs.indexOf(sla);
        return [
          -20_001 - index, sla.levelName, sla.inspectionFrequency, sla.responseTime,
          sla.fixTime, sla.onSiteTime, sla.description, index,
        ];
      }));
      slaImported = slas.rowCount;
    }
    const rateCount = await transaction.query<CountRow>('SELECT COUNT(*) AS count FROM maintenance_rate_config');
    const slaCount = await transaction.query<CountRow>('SELECT COUNT(*) AS count FROM sla_config');
    return {
      rateImported,
      slaImported,
      rateCount: count(rateCount.rows[0]?.count ?? 0),
      slaCount: count(slaCount.rows[0]?.count ?? 0),
    };
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const data = await seedConfig(getDatabase());
    const inserted = data.rateImported + data.slaImported;
    return NextResponse.json({
      success: true,
      message: inserted === 0
        ? `配置已存在：维保费率 ${data.rateCount} 条，SLA配置 ${data.slaCount} 条`
        : `成功导入：维保费率 ${data.rateImported} 条，SLA配置 ${data.slaImported} 条`,
      data: inserted === 0
        ? { rateCount: data.rateCount, slaCount: data.slaCount }
        : { rateImported: data.rateImported, slaImported: data.slaImported },
    });
  } catch (error) {
    console.error('导入配置数据失败:', error);
    return NextResponse.json({ success: false, error: '导入失败' }, { status: 500 });
  }
}
