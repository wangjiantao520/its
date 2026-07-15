import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { pool } from '@/lib/db';

// 云数据中心维保设备数据（47条）
const maintenanceDevices = [
  // 内网设备 - 网络系统（6条）
  { category: '内网-网络系统', name: '内网核心交换机', brand: 'H3C', model: 'S12500R-48C6D', specification: '48口万兆+6口100G', unit: '台', original_price: 280000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-网络系统', name: '内网汇聚交换机', brand: 'H3C', model: 'S6520X-24ST-SI', specification: '24口万兆', unit: '台', original_price: 85000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-网络系统', name: '内网接入交换机', brand: 'H3C', model: 'S5130S-28S-EI', specification: '28口千兆', unit: '台', original_price: 12000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-网络系统', name: '内网路由器', brand: 'H3C', model: 'MSR3600-28-SI', specification: '28口', unit: '台', original_price: 45000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-网络系统', name: '内网防火墙', brand: 'H3C', model: 'F5000-AI-2T40', specification: '2T40', unit: '台', original_price: 120000, maintenance_rate: 0.08, network_type: '内网' },
  { category: '内网-网络系统', name: '内网负载均衡', brand: 'F5', model: 'BIG-IP i2000', specification: 'i2000', unit: '台', original_price: 180000, maintenance_rate: 0.08, network_type: '内网' },

  // 内网设备 - 计算资源池（8条）
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD', unit: '台', original_price: 85000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/512G/2*480G SSD+6*1.2T SAS', unit: '台', original_price: 125000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*960G SSD', unit: '台', original_price: 95000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD+2*1.2T SAS', unit: '台', original_price: 105000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD+4*1.2T SAS', unit: '台', original_price: 115000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD+8*1.2T SAS', unit: '台', original_price: 135000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/512G/2*960G SSD', unit: '台', original_price: 130000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-计算资源池', name: '内网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD', unit: '台', original_price: 80000, maintenance_rate: 0.05, network_type: '内网' },

  // 内网设备 - 数据库节点（2条）
  { category: '内网-数据库节点', name: '内网数据库服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/512G/2*480G SSD+4*1.2T SAS', unit: '台', original_price: 145000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-数据库节点', name: '内网数据库服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/512G/2*960G SSD', unit: '台', original_price: 135000, maintenance_rate: 0.05, network_type: '内网' },

  // 内网设备 - 云管理平台（2条）
  { category: '内网-云管理平台', name: '内网云平台管理服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD', unit: '台', original_price: 85000, maintenance_rate: 0.05, network_type: '内网' },
  { category: '内网-云管理平台', name: '内网云平台License', brand: 'H3C', model: 'CloudOS License', specification: '50节点授权', unit: '套', original_price: 200000, maintenance_rate: 0.12, network_type: '内网' },

  // 内网设备 - 存储系统（3条）
  { category: '内网-存储系统', name: '内网存储', brand: 'H3C', model: 'UniStor CF2268', specification: '960G SSD*2+1.2T SAS*4', unit: '台', original_price: 95000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-存储系统', name: '内网存储', brand: 'H3C', model: 'UniStor CF2268', specification: '960G SSD*2+1.2T SAS*8', unit: '台', original_price: 125000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-存储系统', name: '内网光纤交换机', brand: 'H3C', model: 'UniStor CN3360', specification: '24口', unit: '台', original_price: 65000, maintenance_rate: 0.06, network_type: '内网' },

  // 内网设备 - 备份系统（2条）
  { category: '内网-备份系统', name: '内网备份一体机', brand: 'H3C', model: 'UniStor BS2000', specification: '960G SSD*2+8T SATA*8', unit: '台', original_price: 180000, maintenance_rate: 0.06, network_type: '内网' },
  { category: '内网-备份系统', name: '内网备份License', brand: 'H3C', model: 'Backup License', specification: '50TB容量授权', unit: '套', original_price: 150000, maintenance_rate: 0.12, network_type: '内网' },

  // 内网设备 - 安全平台（2条）
  { category: '内网-安全平台', name: '内网安全态势感知平台', brand: 'H3C', model: 'SecCenter SSC', specification: '50节点授权', unit: '套', original_price: 120000, maintenance_rate: 0.12, network_type: '内网' },
  { category: '内网-安全平台', name: '内网日志审计', brand: 'H3C', model: 'LogAudit 1000', specification: '100EPS', unit: '套', original_price: 80000, maintenance_rate: 0.12, network_type: '内网' },

  // 内网设备 - 安防改造（4条）
  { category: '内网-安防改造', name: '内网摄像机', brand: '海康威视', model: 'DS-2CD7A87', specification: '800万像素球机', unit: '台', original_price: 3500, maintenance_rate: 0.02, network_type: '内网' },
  { category: '内网-安防改造', name: '内网摄像机', brand: '海康威视', model: 'DS-2CD3T87', specification: '800万像素枪机', unit: '台', original_price: 1800, maintenance_rate: 0.02, network_type: '内网' },
  { category: '内网-安防改造', name: '内网录像机', brand: '海康威视', model: 'DS-9600N-I8', specification: '64路', unit: '台', original_price: 12000, maintenance_rate: 0.02, network_type: '内网' },
  { category: '内网-安防改造', name: '内网门禁系统', brand: '海康威视', model: 'DS-K1T341AMF', specification: '人脸识别', unit: '套', original_price: 8500, maintenance_rate: 0.02, network_type: '内网' },

  // 内网设备 - 商密设备（4条）
  { category: '内网-商密设备', name: '内网服务器密码机', brand: '江南天安', model: 'T6Q-GJ-16', specification: '16E', unit: '台', original_price: 180000, maintenance_rate: 0.07, network_type: '内网' },
  { category: '内网-商密设备', name: '内网签名验签服务器', brand: '江南天安', model: 'T8000-S', specification: '2000TPS', unit: '台', original_price: 220000, maintenance_rate: 0.07, network_type: '内网' },
  { category: '内网-商密设备', name: '内网密钥管理系统', brand: '江南天安', model: 'T9000-KMS', specification: '1000密钥', unit: '套', original_price: 150000, maintenance_rate: 0.07, network_type: '内网' },
  { category: '内网-商密设备', name: '内网加密卡', brand: '江南天安', model: 'EC-200', specification: 'PCIe', unit: '张', original_price: 25000, maintenance_rate: 0.07, network_type: '内网' },

  // 内网设备 - 其他（2条）
  { category: '内网-其他', name: '内网堡垒机', brand: 'H3C', model: 'SecBlade ACG', specification: '100用户', unit: '台', original_price: 85000, maintenance_rate: 0.08, network_type: '内网' },
  { category: '内网-其他', name: '内网网闸', brand: 'H3C', model: 'GAP2000', specification: '千兆', unit: '台', original_price: 120000, maintenance_rate: 0.08, network_type: '内网' },

  // 外网设备 - 网络系统（4条）
  { category: '外网-网络系统', name: '外网核心交换机', brand: 'H3C', model: 'S12500R-48C6D', specification: '48口万兆+6口100G', unit: '台', original_price: 280000, maintenance_rate: 0.06, network_type: '外网' },
  { category: '外网-网络系统', name: '外网汇聚交换机', brand: 'H3C', model: 'S6520X-24ST-SI', specification: '24口万兆', unit: '台', original_price: 85000, maintenance_rate: 0.06, network_type: '外网' },
  { category: '外网-网络系统', name: '外网接入交换机', brand: 'H3C', model: 'S5130S-28S-EI', specification: '28口千兆', unit: '台', original_price: 12000, maintenance_rate: 0.06, network_type: '外网' },
  { category: '外网-网络系统', name: '外网防火墙', brand: 'H3C', model: 'F5000-AI-2T40', specification: '2T40', unit: '台', original_price: 120000, maintenance_rate: 0.08, network_type: '外网' },

  // 外网设备 - 计算资源池（4条）
  { category: '外网-计算资源池', name: '外网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD', unit: '台', original_price: 85000, maintenance_rate: 0.05, network_type: '外网' },
  { category: '外网-计算资源池', name: '外网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/512G/2*480G SSD+4*1.2T SAS', unit: '台', original_price: 115000, maintenance_rate: 0.05, network_type: '外网' },
  { category: '外网-计算资源池', name: '外网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*960G SSD', unit: '台', original_price: 95000, maintenance_rate: 0.05, network_type: '外网' },
  { category: '外网-计算资源池', name: '外网服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD+2*1.2T SAS', unit: '台', original_price: 105000, maintenance_rate: 0.05, network_type: '外网' },

  // 外网设备 - 数据库节点（1条）
  { category: '外网-数据库节点', name: '外网数据库服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/512G/2*480G SSD+4*1.2T SAS', unit: '台', original_price: 145000, maintenance_rate: 0.05, network_type: '外网' },

  // 外网设备 - 云管理平台（2条）
  { category: '外网-云管理平台', name: '外网云平台管理服务器', brand: 'H3C', model: 'UniServer R4900 G3', specification: '2*Intel 6248R/256G/2*480G SSD', unit: '台', original_price: 85000, maintenance_rate: 0.05, network_type: '外网' },
  { category: '外网-云管理平台', name: '外网云平台License', brand: 'H3C', model: 'CloudOS License', specification: '30节点授权', unit: '套', original_price: 120000, maintenance_rate: 0.12, network_type: '外网' },

  // 外网设备 - 存储系统（2条）
  { category: '外网-存储系统', name: '外网存储', brand: 'H3C', model: 'UniStor CF2268', specification: '960G SSD*2+1.2T SAS*4', unit: '台', original_price: 95000, maintenance_rate: 0.06, network_type: '外网' },
  { category: '外网-存储系统', name: '外网光纤交换机', brand: 'H3C', model: 'UniStor CN3360', specification: '24口', unit: '台', original_price: 65000, maintenance_rate: 0.06, network_type: '外网' },

  // 外网设备 - 安全平台（2条）
  { category: '外网-安全平台', name: '外网安全态势感知平台', brand: 'H3C', model: 'SecCenter SSC', specification: '30节点授权', unit: '套', original_price: 80000, maintenance_rate: 0.12, network_type: '外网' },
  { category: '外网-安全平台', name: '外网日志审计', brand: 'H3C', model: 'LogAudit 1000', specification: '50EPS', unit: '套', original_price: 50000, maintenance_rate: 0.12, network_type: '外网' },
];

export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    // 检查是否已导入
    const [existing] = await pool.execute('SELECT COUNT(*) as count FROM maintenance_device_quotas');
    const count = (existing as any[])[0]?.count || 0;

    if (count > 0) {
      return NextResponse.json({
        success: true,
        message: `数据库中已有 ${count} 条维保设备数据`,
        data: { count }
      });
    }

    // 导入数据
    let imported = 0;
    for (const device of maintenanceDevices) {
      const id = `maint_${Date.now()}_${imported}`;
      const annual_fee = device.original_price * device.maintenance_rate;
      
      await pool.execute(
        `INSERT INTO maintenance_device_quotas 
         (id, category, name, brand, model, specification, unit, quantity, original_price, maintenance_rate, annual_fee, network_type, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          device.category,
          device.name,
          device.brand,
          device.model,
          device.specification,
          device.unit,
          1, // quantity 默认为1
          device.original_price,
          device.maintenance_rate,
          annual_fee,
          device.network_type,
          imported
        ]
      );
      imported++;
    }

    return NextResponse.json({
      success: true,
      message: `成功导入 ${imported} 条维保设备数据`,
      data: { imported }
    });
  } catch (error) {
    console.error('导入维保设备数据失败:', error);
    return NextResponse.json(
      { success: false, error: '导入失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
