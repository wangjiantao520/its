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
  },

  // 设备清单识别
  device_recognition: async (params) => {
    const text = String(params.text || params.keyword || '').trim();
    if (!text) return '请提供需要识别的设备清单描述，例如"2台服务器、5台台式电脑"。';

    const DEVICE_ALIASES: Array<[RegExp, string]> = [
      [/服务器|机房设备|机架式服务器|塔式服务器|刀片服务器/, '服务器'],
      [/台式计算机|台式机|台式电脑|\bpc\b/, '台式电脑'],
      [/便携式计算机|笔记本|笔记本电脑/, '笔记本电脑'],
      [/激光打印机|喷墨打印机|打印机/, '打印机'],
      [/复印机/, '复印机'],
      [/扫描仪/, '扫描仪'],
      [/装订机/, '装订机'],
      [/网络交换机|交换机/, '网络交换机'],
      [/路由器|无线路由/, '路由器'],
      [/防火墙/, '防火墙'],
      [/无线AP|ap|无线接入点/, '无线AP'],
      [/网络摄像头|摄像头|监控摄像头|NVR|硬盘录像机|监控/, '网络摄像头'],
      [/会议平板|触控一体机/, '会议平板'],
      [/视频会议终端|会议终端/, '视频会议终端'],
    ];

    const qtyMatch = text.match(/(\d+)\s*[台套个]?/g);
    const items: Array<{ name: string; quantity: number }> = [];
    let lastIndex = 0;
    for (const [regex, name] of DEVICE_ALIASES) {
      const match = text.match(regex);
      if (!match) continue;
      const index = text.indexOf(match[0]);
      const qtyMatchNear = text.slice(Math.max(0, index - 6), index + 6).match(/(\d+)\s*[台套个]?/);
      const quantity = qtyMatchNear ? parseInt(qtyMatchNear[1], 10) : 1;
      items.push({ name, quantity });
      if (index > lastIndex) lastIndex = index;
    }

    if (items.length === 0) {
      return `未能从描述中识别出设备。请按"数量+设备名称"的格式描述，例如"2台服务器、5台台式电脑、1台打印机"。`;
    }

    const list = items.map((item) => `| ${item.name} | ${item.quantity} 台 |`).join('\n');
    return `识别到以下设备清单：\n\n| 设备名称 | 数量 |\n|---------|------|\n${list}\n\n如需查询各设备定额和维保费率，请告诉我，例如"查询服务器的定额"或"查询网络设备的维保费率"。`;
  },

  // 公式解释
  formula_explanation: async () => {
    return `## 报价与维保取费公式说明

### 维保报价

**硬件维保费** = 设备原值 × 行业标准年费率（已含不驻场调整系数）

- 年费率按设备类别确定，例如网络设备、服务器、办公设备费率不同
- 多年期报价（1/2/3年）：年费 × 年限，多年期可享折扣（3年约95%、5年约90%）

### 成本与利润

- **维保成本** = 维保报价 × 成本率（默认 **65%**）
- **维保利润** = 维保报价 ×（1 − 成本率）= 维保报价 × **35%**
- 成本构成：人力成本、备件成本、管理成本、厂商支持

### 工程报价

- 基于自施工定额和智能化定额，含设备费、辅材费、人工费、机械费等
- 人工费按工程师等级（初级404 / 中级543 / 高级700 元/天）

### 调整系数

| 因素 | 说明 |
|------|------|
| **SLA 总系数** | = 团队经验 × 安全等级 × 支持方式 × 故障恢复 × 到场 × 响应 × 服务时间 |
| **地区系数** | 城区 1.0 / 市区县城郊区 0.95 / 乡镇 0.9 / 农村 0.85 |
| **批量折扣** | ≥50台 ×0.9 |
| **税率** | 增值税 13% |

### 免维保项

- 随机器永久授权的软件模块**不计入**维保取费基数`;
  },

  // 报告生成
  report_generation: async (params) => {
    const keyword = String(params.keyword || params.client_name || params.project_name || '').trim();
    try {
      const database = getDatabase();
      const where = keyword
        ? 'WHERE client_name ILIKE $1 OR project_name ILIKE $1'
        : '';
      const values = keyword ? [`%${keyword}%`] : [];
      const quotes = await database.query<Record<string, unknown>>(
        `SELECT id, client_name, project_name, total_amount, status, created_at
         FROM quotation_records ${where}
         ORDER BY created_at DESC
         LIMIT 10`,
        values,
      );
      const rows = quotes.rows;
      if (!rows || rows.length === 0) {
        return keyword
          ? `未找到与"${keyword}"相关的报价记录，无法生成报告。`
          : '当前暂无报价记录，无法生成报告。';
      }
      let totalAmount = 0;
      const statusCount: Record<string, number> = {};
      const list = rows.map((q) => {
        const amount = Number(q.total_amount || 0);
        totalAmount += amount;
        const status = String(q.status || 'draft');
        statusCount[status] = (statusCount[status] || 0) + 1;
        return `| WB${String(q.id).padStart(4, '0')} | ${q.client_name || '-'} | ${q.project_name || '-'} | ¥${amount.toLocaleString()} | ${status} | ${new Date(String(q.created_at)).toLocaleDateString('zh-CN')} |`;
      }).join('\n');
      const statusSummary = Object.entries(statusCount)
        .map(([status, count]) => `${status} ${count} 条`).join('，');
      return `## 报价汇总报告\n\n${keyword ? `**筛选条件**：${keyword}\n\n` : ''}共查询到 **${rows.length}** 条报价记录，合计金额 **¥${totalAmount.toLocaleString()}**。\n\n| 报价单号 | 客户 | 项目 | 金额 | 状态 | 日期 |\n|---------|------|------|------|------|------|\n${list}\n\n**状态分布**：${statusSummary || '无'}\n\n> 如需某条报价的详细清单，请告诉我报价单号。`;
    } catch (error) {
      console.error('报告生成失败:', error);
      return '生成报告时遇到错误，请稍后重试。';
    }
  },

  // 问题诊断
  problem_diagnosis: async () => {
    return `## 常见问题排查指南

### 1. 无法登录
- 确认使用的是**管理员入口**还是 **ITS成员入口**
- 成员账号为区县名称（如福鼎、市区），或管理员在成员管理页创建的账号
- 密码错误时点击"忘记密码"联系管理员重置

### 2. 页面一直"加载中"
- 刷新页面重试
- 确认网络正常，服务未中断
- 若持续出现，检查是否登录会话过期，重新登录

### 3. 新建报价保存失败
- 客户名称必填
- 设备名称不能为空，数量和金额必须是有效非负数
- 若仍失败，记录报错信息并反馈管理员

### 4. 数据不显示 / 看板为空
- 确认当前账号有数据权限（成员只能看到自己的报价）
- 管理员可在报价列表按用户筛选
- 刷新数据看板

### 5. AI 助手无回复或报错
- 确认系统已配置有效的 AI 模型（管理员在"AI配置中心"→"AI模型配置"测试连通）
- 智能体需处于"启用"状态，相关技能处于"启用"状态
- 网络代理/防火墙可能阻断模型服务调用

### 6. 仍无法解决
- 将问题现象、报错信息、操作步骤反馈给系统管理员`;
  }
};
