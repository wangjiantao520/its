import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool } from '@/lib/db';

// 维保费率配置数据
const maintenanceRates = [
  { device_type: '网络设备', rate: 0.06, description: '交换机、路由器、防火墙等网络基础设施' },
  { device_type: '服务器', rate: 0.05, description: '物理服务器、虚拟化主机' },
  { device_type: '存储设备', rate: 0.06, description: 'SAN存储、NAS存储、备份存储' },
  { device_type: '安全设备', rate: 0.08, description: '防火墙、WAF、入侵检测等' },
  { device_type: '安防设备', rate: 0.02, description: '摄像机、录像机、门禁等' },
  { device_type: '软件产品', rate: 0.12, description: '操作系统、数据库、中间件、云平台License' },
  { device_type: '商密设备', rate: 0.07, description: '密码机、签名验签服务器、密钥管理系统' },
];

// SLA配置数据
const slaConfigs = [
  { 
    level_name: '7*24小时特别保障', 
    inspection_frequency: '每月1次',
    response_time: '15分钟内响应',
    fix_time: '4小时内修复',
    on_site_time: '2小时内到场',
    description: '最高级别服务，适用于核心业务系统'
  },
  { 
    level_name: '7*24小时标准保障', 
    inspection_frequency: '每季度1次',
    response_time: '30分钟内响应',
    fix_time: '8小时内修复',
    on_site_time: '4小时内到场',
    description: '标准级别服务，适用于重要业务系统'
  },
  { 
    level_name: '5*8小时常规保障', 
    inspection_frequency: '每半年1次',
    response_time: '2小时内响应',
    fix_time: '24小时内修复',
    on_site_time: '次工作日到场',
    description: '基础级别服务，适用于一般业务系统'
  },
];

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    // 检查是否已导入
    const [rateCheck] = await pool.execute('SELECT COUNT(*) as count FROM maintenance_rate_config');
    const rateCount = (rateCheck as any[])[0]?.count || 0;

    const [slaCheck] = await pool.execute('SELECT COUNT(*) as count FROM sla_config');
    const slaCount = (slaCheck as any[])[0]?.count || 0;

    if (rateCount > 0 && slaCount > 0) {
      return NextResponse.json({
        success: true,
        message: `配置已存在：维保费率 ${rateCount} 条，SLA配置 ${slaCount} 条`,
        data: { rateCount, slaCount }
      });
    }

    let rateImported = 0;
    let slaImported = 0;

    // 导入维保费率配置
    if (rateCount === 0) {
      for (const rate of maintenanceRates) {
        await pool.execute(
          `INSERT INTO maintenance_rate_config (device_type, rate, description, sort_order)
           VALUES (?, ?, ?, ?)`,
          [rate.device_type, rate.rate, rate.description, rateImported]
        );
        rateImported++;
      }
    }

    // 导入SLA配置
    if (slaCount === 0) {
      for (const sla of slaConfigs) {
        await pool.execute(
          `INSERT INTO sla_config (level_name, inspection_frequency, response_time, fix_time, on_site_time, description, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [sla.level_name, sla.inspection_frequency, sla.response_time, sla.fix_time, sla.on_site_time, sla.description, slaImported]
        );
        slaImported++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功导入：维保费率 ${rateImported} 条，SLA配置 ${slaImported} 条`,
      data: { rateImported, slaImported }
    });
  } catch (error) {
    console.error('导入配置数据失败:', error);
    return NextResponse.json(
      { success: false, error: '导入失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
