// 意图识别（增强版）
export function detectIntent(message: string): { skill: string; params: Record<string, unknown> } | null {
  const lowerMsg = message.toLowerCase();

  // 设备清单识别（优先级最高，避免被定额查询/报价计算拦截）
  if (lowerMsg.includes('识别设备') || lowerMsg.includes('识别一下') || lowerMsg.includes('提取设备')
    || lowerMsg.includes('设备清单') || lowerMsg.includes('解析设备') || lowerMsg.includes('清单里有哪些')
    || (lowerMsg.includes('识别') && (lowerMsg.includes('设备') || lowerMsg.includes('清单')))) {
    return { skill: 'device_recognition', params: { text: message } };
  }

  // 报告生成（在报价历史之前，避免"生成报价报告"被历史查询拦截）
  if (lowerMsg.includes('生成报告') || lowerMsg.includes('报价报告') || lowerMsg.includes('汇总报告')
    || (lowerMsg.includes('报告') && (lowerMsg.includes('生成') || lowerMsg.includes('汇总') || lowerMsg.includes('统计')))) {
    const keyword = message.replace(/.*?(报告|汇总|统计).*?/, '').trim() || '';
    return { skill: 'report_generation', params: { keyword } };
  }

  // 公式解释（在报价计算之前，避免"怎么算"被报价计算拦截）
  if (lowerMsg.includes('公式') || lowerMsg.includes('怎么算') || lowerMsg.includes('如何计算')
    || lowerMsg.includes('取费') || lowerMsg.includes('计算规则') || lowerMsg.includes('费率说明')
    || lowerMsg.includes('收费依据') || lowerMsg.includes('为什么这么算')) {
    return { skill: 'formula_explanation', params: {} };
  }

  // 问题诊断
  if (lowerMsg.includes('报错') || lowerMsg.includes('故障') || lowerMsg.includes('排查')
    || lowerMsg.includes('诊断') || lowerMsg.includes('不工作') || lowerMsg.includes('登录不了')
    || lowerMsg.includes('加载不出来') || lowerMsg.includes('有问题') || lowerMsg.includes('怎么解决')) {
    return { skill: 'problem_diagnosis', params: {} };
  }

  // 报价计算（优先级最高，避免被定额查询拦截）
  if (lowerMsg.includes('计算') && (lowerMsg.includes('报价') || lowerMsg.includes('维保'))) {
    const params: Record<string, unknown> = {};

    // 尝试提取数量
    const qtyMatch = message.match(/(\d+)\s*[台套个]/);
    if (qtyMatch) params.quantity = parseInt(qtyMatch[1]);

    // 尝试提取年限
    const yearMatch = message.match(/(\d+)\s*年/);
    if (yearMatch) params.years = parseInt(yearMatch[1]);

    // 尝试提取价格
    const priceMatch = message.match(/(\d+(?:\.\d+)?)\s*万/);
    if (priceMatch) params.original_price = parseFloat(priceMatch[1]) * 10000;

    // 尝试提取设备名称
    const nameMatch = message.match(/(?:计算|报价).*?([\u4e00-\u9fa5]{2,})/);
    if (nameMatch) params.device_name = nameMatch[1];

    return { skill: 'quote_calculation', params };
  }

  // 报价历史查询
  if (lowerMsg.includes('报价记录') || lowerMsg.includes('历史报价') || (lowerMsg.includes('报价单') && (lowerMsg.includes('查看') || lowerMsg.includes('列表')))) {
    const keyword = message.replace(/.*?(报价记录|历史报价|报价单).*?/, '').trim() || '';
    return { skill: 'quote_history', params: { keyword } };
  }

  // 定额查询
  if (lowerMsg.includes('定额') || lowerMsg.includes('单价') || (lowerMsg.includes('价格') && lowerMsg.includes('查询'))) {
    let keyword = message
      .replace(/查询|定额|单价|价格|设备|的|一下|帮我|请|给我|看看|有哪些|什么|多少|怎么|如何/gi, '')
      .trim();
    keyword = keyword || '交换机';
    return { skill: 'quota_query', params: { keyword } };
  }

  // 维保费率查询
  if (lowerMsg.includes('费率') || lowerMsg.includes('维保率')) {
    let category = message
      .replace(/查询|费率|维保率|维保|设备|的|一下|帮我|请|给我|看看|有哪些|什么|多少/gi, '')
      .trim();
    category = category || '网络';
    return { skill: 'maintenance_rate_query', params: { category } };
  }

  // 系统介绍
  if (lowerMsg.includes('功能') || lowerMsg.includes('介绍') || lowerMsg.includes('帮助') || lowerMsg.includes('怎么用')
    || lowerMsg.includes('使用') || lowerMsg.includes('如何用') || lowerMsg.includes('怎么使用') || lowerMsg.includes('操作')) {
    return { skill: 'system_guide', params: {} };
  }

  return null;
}
