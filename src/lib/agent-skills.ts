import { getDatabase } from './database/client';

// 技能执行器
export const skillExecutors: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
  // 设备定额查询
  quota_query: async (params) => {
    const keyword = (params.keyword as string) || '';
    const devices = await getDatabase().query<Record<string, unknown>>(
      `SELECT name, category, model, original_price, maintenance_rate
       FROM maintenance_device_quotas
       WHERE name ILIKE $1 OR category ILIKE $1 OR model ILIKE $1
       LIMIT 20`,
      [`%${keyword}%`],
    );
    const deviceList = devices.rows;
    if (!deviceList || deviceList.length === 0) {
      return `未找到与"${keyword}"相关的设备定额信息。`;
    }
    const list = deviceList.map((d) =>
      `| ${d.name} | ${d.category || '-'} | ${d.model || '-'} | ¥${Number(d.original_price || 0).toLocaleString()} | ${d.maintenance_rate ? `${(Number(d.maintenance_rate) * 100).toFixed(1)}%` : '-'} |`
    ).join('\n');
    return `查询到以下与"${keyword}"相关的设备定额信息：\n\n| 设备名称 | 类别 | 型号 | 中标单价 | 维保费率 |\n|---------|------|------|---------|---------|\n${list}`;
  },

  // 维保费率查询
  maintenance_rate_query: async (params) => {
    const category = (params.category as string) || '';
    const rates = await getDatabase().query<Record<string, unknown>>(
      `SELECT DISTINCT category, maintenance_rate
       FROM maintenance_device_quotas
       WHERE category ILIKE $1
       LIMIT 20`,
      [`%${category}%`],
    );
    const rateList = rates.rows;
    if (!rateList || rateList.length === 0) {
      return `未找到与"${category}"相关的维保费率配置。`;
    }
    const list = rateList.map((r) =>
      `| ${r.category} | ${(Number(r.maintenance_rate) * 100).toFixed(1)}% |`
    ).join('\n');
    return `查询到以下维保费率配置：\n\n| 设备类别 | 年维保费率 |\n|---------|------------|\n${list}`;
  },

  // 维保报价计算
  quote_calculation: async (params) => {
    const deviceName = (params.device_name as string) || '';
    const originalPrice = Number(params.original_price) || 0;
    const maintenanceRate = Number(params.maintenance_rate) || 0.05;
    const quantity = Number(params.quantity) || 1;
    const years = Number(params.years) || 1;

    if (!deviceName || originalPrice <= 0) {
      return '请提供设备名称和原值进行报价计算。';
    }

    const annualFee = originalPrice * maintenanceRate * quantity;
    const totalFee = annualFee * years;
    const cost = totalFee * 0.65;
    const profit = totalFee - cost;

    return `报价计算结果：

| 项目 | 数值 |
|------|------|
| 设备名称 | ${deviceName} |
| 设备单价 | ¥${originalPrice.toLocaleString()} |
| 数量 | ${quantity} 台 |
| 年维保费率 | ${(maintenanceRate * 100).toFixed(1)}% |
| 合同年限 | ${years} 年 |

**费用汇总**

| 费用项 | 金额 |
|--------|------|
| 年维保费用 | ¥${annualFee.toLocaleString()} |
| ${years}年维保总价 | ¥${totalFee.toLocaleString()} |
| 维保成本（65%） | ¥${cost.toLocaleString()} |
| 维保利润（35%） | ¥${profit.toLocaleString()} |

> 报价依据：基于2020年同类政务信息化项目政府采购中标价格，费率已含不驻场调整系数。`;
  },

  // 报价历史查询
  quote_history: async (params) => {
    const keyword = (params.keyword as string) || '';
    const quotes = await getDatabase().query<Record<string, unknown>>(
      `SELECT id, client_name, project_name, total_amount, status, created_at
       FROM quotation_records
       WHERE client_name ILIKE $1 OR project_name ILIKE $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [`%${keyword}%`],
    );
    const quoteList = quotes.rows;
    if (!quoteList || quoteList.length === 0) {
      return `未找到与"${keyword}"相关的报价记录。`;
    }
    const list = quoteList.map((q) =>
      `| WB${String(q.id).padStart(4, '0')} | ${q.client_name || '-'} | ${q.project_name || '-'} | ¥${Number(q.total_amount || 0).toLocaleString()} | ${q.status || '-'} |`
    ).join('\n');
    return `查询到以下报价记录：\n\n| 报价单号 | 客户名称 | 项目名称 | 总金额 | 状态 |\n|---------|---------|---------|-------|------|\n${list}`;
  },

  // 系统功能介绍
  system_guide: async () => {
    return `## ITS智能报价系统功能介绍

### 核心功能

| 模块 | 说明 |
|------|------|
| **工程报价** | 基于自施工定额和智能化定额进行工程报价，包含设备费、辅材费、人工费等 |
| **维保报价** | 基于设备维保定额库进行维保报价，支持多年限、成本测算 |
| **报价管理** | 报价单列表、详情查看、版本管理、审批流程 |
| **AI助手** | 智能设备识别、报价计算、定额查询、需求解析 |
| **设备导入** | 支持Excel批量导入设备清单 |
| **数据看板** | 报价统计、数据分析、可视化图表 |

### 维保报价取费逻辑

- **硬件维保费** = 设备原值 × 行业标准年费率（已含不驻场调整系数）
- **软件维保费** = 软件原值 × 软件维保费率
- **免维保项**：随机器永久授权的软件模块不计入维保取费基数

### 你可以问我

- "帮我查询交换机的定额"
- "计算一台服务器的维保报价"
- "查询网络设备的维保费率"
- "查看最近的报价记录"
- "如何使用这个系统"`;
  }
};
