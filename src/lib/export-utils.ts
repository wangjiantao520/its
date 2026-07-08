/**
 * 报价单导出工具函数
 */

export interface MaintenanceQuoteExportData {
  projectName: string;
  clientName: string;
  contactPerson: string;
  contactPhone: string;
  quoteNumber: string;
  quoteDate: string;
  engineerLevel: string;
  slaParams: {
    teamExperience: string;
    securityLevel: string;
    supportMethod: string;
    recoveryTime: string;
    arrivalTime: string;
    responseTime: string;
    serviceTime: string;
  };
  totalSlaCoefficient: number;
  region: string;
  regionCoefficient: number;
  years: number;
  yearsDiscount: number;
  equipmentCount: number;
  bulkDiscount: number;
  equipmentList: Array<{
    name: string;
    category: string;
    brand: string;
    model: string;
    quantity: number;
    maintenanceTier: string;
    ageRate: string;
    ageCoefficient: number;
    warrantyStatus: string;
    warrantyCoefficient: number;
    subtotalInspection: number;
    subtotalOnsite: number;
    subtotalRepair: number;
    subtotalTools: number;
    subtotalConsumables: number;
    subtotalSpareParts: number;
    subtotal: number;
  }>;
  summary: {
    totalInspection: number;
    totalOnsite: number;
    totalRepair: number;
    totalTools: number;
    totalConsumables: number;
    totalSpareParts: number;
    subtotalBeforeDiscount: number;
    slaAdjustment: number;
    regionAdjustment: number;
    subtotalAfterCoefficients: number;
    yearsDiscountAmount: number;
    bulkDiscountAmount: number;
    subtotal: number;
    tax: number;
    grandTotal: number;
    grandTotalRMB: string;
  };
}

export interface EngineeringQuoteExportData {
  projectName: string;
  clientName: string;
  contactPerson: string;
  contactPhone: string;
  quoteNumber: string;
  quoteDate: string;
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  rates: {
    managementRate: number;
    profitRate: number;
    regulatoryRate: number;
    taxRate: number;
  };
  summary: {
    subtotal: number;
    managementFee: number;
    profit: number;
    regulatoryFee: number;
    tax: number;
    grandTotal: number;
    grandTotalRMB: string;
  };
}

/**
 * 生成维保报价单HTML内容
 */
export function generateMaintenanceQuoteHTML(data: MaintenanceQuoteExportData): string {
  const equipmentTableRows = data.equipmentList.map((eq, index) => `
    <tr>
      <td style="border: 1px solid #333; padding: 8px; text-align: center;">${index + 1}</td>
      <td style="border: 1px solid #333; padding: 8px;">${eq.name}</td>
      <td style="border: 1px solid #333; padding: 8px;">${eq.brand}</td>
      <td style="border: 1px solid #333; padding: 8px;">${eq.model}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: center;">${eq.quantity}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: center;">${eq.maintenanceTier}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${eq.subtotal.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>设备维保报价单</title>
  <style>
    body { font-family: 'SimSun', serif; font-size: 12pt; line-height: 1.6; }
    .title { text-align: center; font-size: 24pt; font-weight: bold; margin-bottom: 30px; }
    .subtitle { text-align: center; font-size: 18pt; font-weight: bold; margin: 20px 0; page-break-after: avoid; }
    .info-table { width: 100%; margin-bottom: 20px; margin-left: auto; margin-right: auto; }
    .info-table td { padding: 5px 10px; }
    .label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 15px auto; }
    th { background-color: #f0f0f0; font-weight: bold; }
    .summary { font-size: 14pt; font-weight: bold; margin: 20px 0; }
    .total { font-size: 16pt; color: #c53030; font-weight: bold; }
    .footer { margin-top: 50px; text-align: right; }
    .signature { margin-top: 80px; display: flex; justify-content: space-between; }
    /* 分页控制：避免表格、段落、列表跨页断裂 */
    table { page-break-inside: avoid; }
    .subtitle { page-break-after: avoid; }
    .summary { page-break-inside: avoid; }
    ol { page-break-inside: avoid; }
    .signature { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="title">设备维保服务报价单</div>

  <table class="info-table">
    <tr>
      <td class="label">报价单号：</td>
      <td>${data.quoteNumber}</td>
      <td class="label">报价日期：</td>
      <td>${data.quoteDate}</td>
    </tr>
    <tr>
      <td class="label">项目名称：</td>
      <td colspan="3">${data.projectName}</td>
    </tr>
    <tr>
      <td class="label">客户单位：</td>
      <td>${data.clientName}</td>
      <td class="label">联系人：</td>
      <td>${data.contactPerson}</td>
    </tr>
    <tr>
      <td class="label">联系电话：</td>
      <td>${data.contactPhone}</td>
      <td class="label">工程师等级：</td>
      <td>${data.engineerLevel}</td>
    </tr>
  </table>

  <div class="subtitle">一、SLA服务等级参数</div>
  <table class="info-table">
    <tr>
      <td class="label">运维团队经验：</td>
      <td>${data.slaParams.teamExperience}</td>
      <td class="label">安全等级：</td>
      <td>${data.slaParams.securityLevel}</td>
    </tr>
    <tr>
      <td class="label">支持方式：</td>
      <td>${data.slaParams.supportMethod}</td>
      <td class="label">故障恢复时间：</td>
      <td>${data.slaParams.recoveryTime}</td>
    </tr>
    <tr>
      <td class="label">到场时间：</td>
      <td>${data.slaParams.arrivalTime}</td>
      <td class="label">响应时间：</td>
      <td>${data.slaParams.responseTime}</td>
    </tr>
    <tr>
      <td class="label">服务时间：</td>
      <td>${data.slaParams.serviceTime}</td>
      <td class="label">SLA总系数：</td>
      <td>${data.totalSlaCoefficient.toFixed(2)}</td>
    </tr>
  </table>

  <div class="subtitle">二、服务区域及期限</div>
  <table class="info-table">
    <tr>
      <td class="label">服务区域：</td>
      <td>${data.region}（系数：${data.regionCoefficient}）</td>
      <td class="label">服务期限：</td>
      <td>${data.years}年（折扣：${(data.yearsDiscount * 100).toFixed(0)}%）</td>
    </tr>
    <tr>
      <td class="label">设备数量：</td>
      <td>${data.equipmentCount}台（${data.equipmentCount >= 50 ? '享受9折批量优惠' : '无批量优惠'}）</td>
      <td class="label">批量折扣：</td>
      <td>${(data.bulkDiscount * 100).toFixed(0)}%</td>
    </tr>
  </table>

  <div class="subtitle">三、维保设备清单</div>
  <table>
    <thead>
      <tr>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">序号</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">设备名称</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">品牌</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">型号</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">数量</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">维保分档</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">小计（元）</th>
      </tr>
    </thead>
    <tbody>
      ${equipmentTableRows}
    </tbody>
  </table>

  <div class="subtitle">四、费用明细</div>
  <table>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0; font-weight: bold;">费用项目</td>
      <td style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0; font-weight: bold; text-align: right;">金额（元）</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">巡检费</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.totalInspection.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">上门费</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.totalOnsite.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">故障处理费</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.totalRepair.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">工具仪表摊销</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.totalTools.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">耗材费</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.totalConsumables.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">备件风险准备金</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.totalSpareParts.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; font-weight: bold;">小计（折扣前）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">¥${data.summary.subtotalBeforeDiscount.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">SLA系数调整</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">×${data.totalSlaCoefficient.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">地区系数调整</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">×${data.regionCoefficient.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; font-weight: bold;">小计（系数调整后）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">¥${data.summary.subtotalAfterCoefficients.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">多年期折扣</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">-¥${data.summary.yearsDiscountAmount.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">批量折扣</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">-¥${data.summary.bulkDiscountAmount.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; font-weight: bold;">不含税小计</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">¥${data.summary.subtotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">增值税（13%）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.tax.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; font-weight: bold; font-size: 14pt;">报价总计</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold; font-size: 14pt; color: #c53030;">¥${data.summary.grandTotal.toFixed(2)}</td>
    </tr>
  </table>

  <div class="summary total">大写金额：${data.summary.grandTotalRMB}</div>

  <div class="subtitle">五、服务说明</div>
  <ol>
    <li>本报价单有效期为30天，自报价之日起计算。</li>
    <li>服务内容以双方最终签订的维保服务合同为准。</li>
    <li>如需增加或减少维保设备，价格将相应调整。</li>
    <li>备件更换费用根据实际发生情况另行结算。</li>
  </ol>

  <div class="signature">
    <div>
      <p>报价方（盖章）：</p>
      <p style="margin-top: 60px;">日期：________年______月______日</p>
    </div>
    <div>
      <p>客户确认（盖章）：</p>
      <p style="margin-top: 60px;">日期：________年______月______日</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * 生成工程报价单HTML内容
 */
export function generateEngineeringQuoteHTML(data: EngineeringQuoteExportData): string {
  const itemsTableRows = data.items.map((item, index) => `
    <tr>
      <td style="border: 1px solid #333; padding: 8px; text-align: center;">${index + 1}</td>
      <td style="border: 1px solid #333; padding: 8px;">${item.name}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: center;">${item.unit}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: center;">${item.quantity}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${item.unitPrice.toFixed(2)}</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>工程报价单</title>
  <style>
    body { font-family: 'SimSun', serif; font-size: 12pt; line-height: 1.6; }
    .title { text-align: center; font-size: 24pt; font-weight: bold; margin-bottom: 30px; }
    .subtitle { text-align: center; font-size: 18pt; font-weight: bold; margin: 20px 0; page-break-after: avoid; }
    .info-table { width: 100%; margin-bottom: 20px; margin-left: auto; margin-right: auto; }
    .info-table td { padding: 5px 10px; }
    .label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 15px auto; }
    th { background-color: #f0f0f0; font-weight: bold; }
    .summary { font-size: 14pt; font-weight: bold; margin: 20px 0; }
    .total { font-size: 16pt; color: #c53030; font-weight: bold; }
    .footer { margin-top: 50px; text-align: right; }
    .signature { margin-top: 80px; display: flex; justify-content: space-between; }
    /* 分页控制：避免表格、段落、列表跨页断裂 */
    table { page-break-inside: avoid; }
    .subtitle { page-break-after: avoid; }
    .summary { page-break-inside: avoid; }
    ol { page-break-inside: avoid; }
    .signature { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="title">工程报价单</div>

  <table class="info-table">
    <tr>
      <td class="label">报价单号：</td>
      <td>${data.quoteNumber}</td>
      <td class="label">报价日期：</td>
      <td>${data.quoteDate}</td>
    </tr>
    <tr>
      <td class="label">项目名称：</td>
      <td colspan="3">${data.projectName}</td>
    </tr>
    <tr>
      <td class="label">客户单位：</td>
      <td>${data.clientName}</td>
      <td class="label">联系人：</td>
      <td>${data.contactPerson}</td>
    </tr>
    <tr>
      <td class="label">联系电话：</td>
      <td colspan="3">${data.contactPhone}</td>
    </tr>
  </table>

  <div class="subtitle">报价明细</div>
  <table>
    <thead>
      <tr>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">序号</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">项目名称</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">单位</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">数量</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">单价（元）</th>
        <th style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0;">金额（元）</th>
      </tr>
    </thead>
    <tbody>
      ${itemsTableRows}
    </tbody>
  </table>

  <div class="subtitle">费用汇总</div>
  <table>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0; font-weight: bold;">费用项目</td>
      <td style="border: 1px solid #333; padding: 8px; background-color: #f0f0f0; font-weight: bold; text-align: right;">金额（元）</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">直接工程费小计</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.subtotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">管理费（${data.rates.managementRate}%）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.managementFee.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">利润（${data.rates.profitRate}%）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.profit.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">规费（${data.rates.regulatoryRate}%）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.regulatoryFee.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; font-weight: bold;">不含税小计</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">¥${(data.summary.subtotal + data.summary.managementFee + data.summary.profit + data.summary.regulatoryFee).toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px;">增值税（${data.rates.taxRate}%）</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right;">¥${data.summary.tax.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #333; padding: 8px; font-weight: bold; font-size: 14pt;">报价总计</td>
      <td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold; font-size: 14pt; color: #c53030;">¥${data.summary.grandTotal.toFixed(2)}</td>
    </tr>
  </table>

  <div class="summary total">大写金额：${data.summary.grandTotalRMB}</div>

  <div class="subtitle">报价说明</div>
  <ol>
    <li>本报价单有效期为30天，自报价之日起计算。</li>
    <li>具体施工内容以双方最终签订的工程合同为准。</li>
    <li>如遇材料价格大幅波动，报价将相应调整。</li>
    <li>本报价不含设备及主材采购费用，如需包含请另行说明。</li>
  </ol>

  <div class="signature">
    <div>
      <p>报价方（盖章）：</p>
      <p style="margin-top: 60px;">日期：________年______月______日</p>
    </div>
    <div>
      <p>客户确认（盖章）：</p>
      <p style="margin-top: 60px;">日期：________年______月______日</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * 检查CSS文本是否包含 html2canvas 不支持的颜色函数（lab(), oklch() 等）
 */
function hasUnsupportedColorFunctions(cssText: string): boolean {
  return /(?:^|[^-])lab\s*\(/i.test(cssText) || /oklch\s*\(/i.test(cssText);
}

/**
 * 临时禁用主页面中包含不兼容颜色函数的样式表，返回恢复函数
 */
function disableIncompatibleStylesheets(): () => void {
  const disabledSheets: { el: HTMLStyleElement | HTMLLinkElement; wasDisabled: boolean }[] = [];
  const allElements = Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'));

  for (const el of allElements) {
    if (el.tagName === 'STYLE') {
      if (el.textContent && hasUnsupportedColorFunctions(el.textContent)) {
        disabledSheets.push({ el, wasDisabled: el.disabled });
        el.disabled = true;
      }
    } else if (el.tagName === 'LINK') {
      try {
        const sheet = el.sheet;
        if (sheet) {
          const rules = Array.from(sheet.cssRules || []);
          const hasUnsupported = rules.some((rule) => hasUnsupportedColorFunctions(rule.cssText));
          if (hasUnsupported) {
            disabledSheets.push({ el, wasDisabled: el.disabled });
            el.disabled = true;
          }
        }
      } catch {
        // 跨域样式表无法访问 cssRules，检查 href
        const href = (el as HTMLLinkElement).href || '';
        if (/tailwind|tw-animate|globals/i.test(href)) {
          disabledSheets.push({ el, wasDisabled: el.disabled });
          el.disabled = true;
        }
      }
    }
  }

  // 返回恢复函数
  return () => {
    disabledSheets.forEach(({ el, wasDisabled }) => {
      el.disabled = wasDisabled;
    });
  };
}

/**
 * 下载HTML为PDF文档
 */
export async function downloadAsPDF(html: string, filename: string): Promise<void> {
  // 动态导入 html2pdf.js，避免 SSR 问题
  const html2pdf = (await import('html2pdf.js')).default;

  // 从完整HTML文档中提取body内容（避免嵌套html/body标签）
  let bodyContent = html;
  let styleContent = '';
  
  // 尝试解析HTML文档结构
  const htmlMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (htmlMatch) {
    bodyContent = htmlMatch[1];
  }
  
  // 提取style标签内容
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (styleMatches) {
    styleContent = styleMatches.join('\n');
  }

  // 创建iframe来隔离渲染环境，避免主页面样式（oklch等）影响PDF渲染
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '840px'; // A4宽度 + 边距
  iframe.style.height = '1200px';
  iframe.style.border = 'none';
  iframe.style.opacity = '1'; // 必须为1，html2canvas需要
  iframe.style.visibility = 'visible'; // 必须visible
  iframe.style.zIndex = '-1';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  // 等待iframe加载完成
  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = () => reject(new Error('iframe加载失败'));
    // 设置iframe内容
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      reject(new Error('无法访问iframe文档'));
      return;
    }
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'SimSun', 'Microsoft YaHei', 'Noto Sans SC', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000000;
      background-color: #ffffff;
      margin: 0;
      padding: 20px;
      width: 794px;
    }
    /* 确保表格和文字正常显示 */
    table { width: 100%; border-collapse: collapse; margin: 15px auto; page-break-inside: avoid; }
    th { background-color: #f0f0f0; font-weight: bold; }
    td, th { border: 1px solid #333; padding: 8px; }
    .title { text-align: center; font-size: 24pt; font-weight: bold; margin-bottom: 30px; }
    .subtitle { text-align: center; font-size: 18pt; font-weight: bold; margin: 20px 0; page-break-after: avoid; }
    .info-table { width: 100%; margin-bottom: 20px; margin-left: auto; margin-right: auto; }
    .info-table td { padding: 5px 10px; }
    .label { font-weight: bold; }
    .summary { font-size: 14pt; font-weight: bold; margin: 20px 0; page-break-inside: avoid; }
    .total { font-size: 16pt; color: #c53030; font-weight: bold; }
    .footer { margin-top: 50px; text-align: right; }
    .signature { margin-top: 80px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    /* 分页控制：避免元素跨页断裂 */
    tr { page-break-inside: avoid; }
    ol { page-break-inside: avoid; }
  </style>
  ${styleContent}
</head>
<body>
  ${bodyContent}
</body>
</html>`);
    iframeDoc.close();
    // 给一点时间让内容渲染
    setTimeout(resolve, 200);
  });

  const iframeBody = iframe.contentDocument?.body;
  if (!iframeBody) {
    document.body.removeChild(iframe);
    throw new Error('无法访问iframe内容');
  }

  // 关键：在调用 html2canvas 前，临时禁用主页面中所有包含 lab()/oklch() 的样式表
  // html2canvas 会遍历主页面所有样式表，遇到不兼容的颜色函数会报错
  const restoreStylesheets = disableIncompatibleStylesheets();

  const options = {
    margin: [10, 10, 10, 10], // 上、左、下、右边距（mm）
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: 840,
      windowWidth: 840,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
    pagebreak: { mode: ['css', 'legacy'] },
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any).set(options as any).from(iframeBody).save();
  } finally {
    // 恢复被禁用的样式表
    restoreStylesheets();
    // 清理iframe
    document.body.removeChild(iframe);
  }
}

/**
 * 下载HTML为Word文档
 */
export function downloadAsWord(html: string, filename: string): void {
  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword'
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 数字金额转中文大写
 */
export function convertToChineseCurrency(num: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  if (num === 0) return '零元整';

  let result = '';
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  // 处理整数部分
  if (intPart > 0) {
    const intStr = intPart.toString();
    const len = intStr.length;
    let zeroFlag = false;

    for (let i = 0; i < len; i++) {
      const digit = parseInt(intStr[i]);
      const pos = len - 1 - i;
      const unitIndex = pos % 4;
      const bigUnitIndex = Math.floor(pos / 4);

      if (digit === 0) {
        zeroFlag = true;
        if (unitIndex === 0 && bigUnitIndex > 0) {
          result += bigUnits[bigUnitIndex];
        }
      } else {
        if (zeroFlag) {
          result += '零';
          zeroFlag = false;
        }
        result += digits[digit] + units[unitIndex];
        if (unitIndex === 0 && bigUnitIndex > 0) {
          result += bigUnits[bigUnitIndex];
        }
      }
    }
    result += '元';
  }

  // 处理小数部分
  if (decPart > 0) {
    const jiao = Math.floor(decPart / 10);
    const fen = decPart % 10;

    if (jiao > 0) {
      result += digits[jiao] + '角';
    } else if (intPart > 0) {
      result += '零';
    }

    if (fen > 0) {
      result += digits[fen] + '分';
    }
  } else {
    result += '整';
  }

  return result;
}
