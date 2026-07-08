import { NextRequest, NextResponse } from 'next/server';
import { callAIModel, getActiveAIModelConfig } from '@/lib/ai-config';

interface EngineeringAIItem {
  name: string;
  itemType: 'selfConstruction' | 'intelligent';
  quantity: number;
  matchedItemId?: string;
  matchedItemName?: string;
  unitPrice?: number;
  confidence?: number;
}

interface EngineeringParseResult {
  success: boolean;
  items: EngineeringAIItem[];
  missingFields: string[];
  suggestions: string[];
  rawResponse?: string;
  error?: string;
  priceVersion?: string;
}

const SELF_CONSTRUCTION_KEYWORDS = [
  '自施工',
  '管线敷设',
  '光缆',
  '电缆',
  '设备安装',
  '机柜',
  '桥架',
  '管道',
  '打孔',
  '穿线',
  '布线',
  '接地',
  '调试',
  '测试',
];

const INTELLIGENT_KEYWORDS = [
  '智能化',
  '监控',
  '摄像头',
  '摄像机',
  '门禁',
  '考勤',
  '广播',
  '音响',
  '会议',
  '投影',
  '大屏',
  '拼接屏',
  'LED',
  '信息发布',
  '排队',
  '查询机',
  '充电桩',
  '停车',
  '道闸',
  '巡更',
  '对讲',
  '无线',
  'AP',
  'WIFI',
  '网络',
  '交换机',
  '服务器',
  '存储',
  'UPS',
  '精密空调',
  '动环',
  '机房',
  '综合布线',
  '光纤',
  'ONU',
  'OLT',
  'ONU',
  '光猫',
];

function classifyItemType(name: string): 'selfConstruction' | 'intelligent' {
  const lowerName = name.toLowerCase();

  for (const kw of INTELLIGENT_KEYWORDS) {
    if (lowerName.includes(kw.toLowerCase())) {
      return 'intelligent';
    }
  }

  for (const kw of SELF_CONSTRUCTION_KEYWORDS) {
    if (lowerName.includes(kw.toLowerCase())) {
      return 'selfConstruction';
    }
  }

  return 'intelligent';
}

function buildEngineeringPrompt(
  text: string,
  selfConstructionItems: Array<{ id: string; name: string; price: number; unit: string }>,
  intelligentItems: Array<{ id: string; name: string; price: number; unit: string }>,
  priceTable: Record<string, { min: number; max: number }>,
): string {
  return `你是一个专业的工程报价AI助手。用户会描述工程需求，你需要识别出需要的工序和项目。

【重要规则】
1. 仔细分析用户输入，识别每个工序/项目的名称和数量
2. 区分两类项目：
   - **自施工工序**：管线敷设、设备安装、桥架、穿线、接地、调试等施工类项目
   - **智能化项目**：监控、门禁、广播、会议、网络、机房、充电桩等智能化系统
3. 如果用户使用了模糊词汇，尝试匹配到最接近的标准项目
4. 如果信息不足，列出缺失的字段

【自施工定额库】（节选）
${JSON.stringify(selfConstructionItems.slice(0, 30), null, 2)}

【智能化项目定额库】（节选）
${JSON.stringify(intelligentItems.slice(0, 30), null, 2)}

【价格参考表】
${JSON.stringify(priceTable, null, 2)}

【用户输入】
${text}

【输出格式】严格按照以下JSON格式输出，不要输出其他内容：
{
  "items": [
    {
      "name": "工序/项目名称（用户原文）",
      "itemType": "selfConstruction 或 intelligent",
      "quantity": 数量（数字，默认1）,
      "matchedItemId": "匹配到的定额库ID（如有）",
      "matchedItemName": "匹配到的标准名称（如有）",
      "unitPrice": 估算单价（数字）,
      "confidence": 匹配置信度 0-1
    }
  ],
  "missingFields": ["缺失字段列表，如：项目详细位置、特殊工艺要求等"],
  "suggestions": ["建议列表，如：补充线缆长度、补充设备型号等"]
}

只输出JSON，不要解释。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, learningContext, priceVersion } = body as {
      text: string;
      learningContext?: string;
      priceVersion?: string;
    };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          items: [],
          missingFields: ['用户需求'],
          suggestions: ['请输入工程需求描述'],
          error: '请输入工程需求',
        } as EngineeringParseResult,
        { status: 400 },
      );
    }

    const config = await getActiveAIModelConfig();
    if (!config || !config.api_key) {
      return NextResponse.json(
        {
          success: false,
          items: [],
          missingFields: ['API配置'],
          suggestions: ['请在"系统管理 → AI模型配置"中配置模型并激活，或在 .env 中配置 DEEPSEEK_API_KEY'],
          error: 'AI服务未配置',
        } as EngineeringParseResult,
        { status: 400 },
      );
    }

    // 动态加载定额库
    const quotaModule = await import('@/lib/self-construction-quota');
    const selfConstructionItems = quotaModule.SELF_CONSTRUCTION_QUOTA as Array<{
      id: string;
      name: string;
      price: number;
      unit: string;
    }>;
    const intelligentItems = quotaModule.INTELLIGENT_PROJECT_QUOTA as Array<{
      id: string;
      name: string;
      price: number;
      unit: string;
    }>;

    // 加载价格表
    let priceTable: Record<string, { min: number; max: number }> = {};
    try {
      const baseUrl = request.nextUrl.origin;
      const priceRes = await fetch(`${baseUrl}/api/price-sync`, { cache: 'no-store' });
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        priceTable = priceData.priceTable || {};
      }
    } catch (e) {
      console.warn('[Engineering AI] 价格表加载失败，使用默认值', e);
    }

    const prompt = buildEngineeringPrompt(text, selfConstructionItems, intelligentItems, priceTable);

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      {
        role: 'system',
        content:
          '你是一个专业的工程报价AI助手。严格输出JSON，不要输出任何其他内容。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    if (learningContext) {
      messages[0].content += `\n\n【历史学习数据（供参考）】\n${learningContext}`;
    }

    const aiResponse = await callAIModel(messages, {
      temperature: 0.2,
      maxTokens: 4000,
    });

    if (!aiResponse.success || !aiResponse.content) {
      return NextResponse.json({
        success: false,
        items: [],
        missingFields: [],
        suggestions: ['AI服务未配置或调用失败，请检查系统设置中的AI模型配置'],
        error: aiResponse.error || 'AI调用失败',
        rawResponse: aiResponse.content?.substring(0, 500),
      });
    }

    const responseContent = aiResponse.content;

    let parsed: {
      items?: Array<{
        name: string;
        itemType: 'selfConstruction' | 'intelligent';
        quantity: number;
        matchedItemId?: string;
        matchedItemName?: string;
        unitPrice?: number;
        confidence?: number;
      }>;
      missingFields?: string[];
      suggestions?: string[];
    };

    try {
      // 尝试提取 JSON
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('响应中未找到JSON');
      }
    } catch (parseError) {
      console.error('[Engineering AI] JSON解析失败:', parseError, responseContent);
      return NextResponse.json(
        {
          success: false,
          items: [],
          missingFields: ['AI响应格式'],
          suggestions: ['请重试，或简化输入内容'],
          error: 'AI响应解析失败',
          rawResponse: responseContent.substring(0, 500),
        },
        { status: 200 },
      );
    }

    // 兜底分类：AI没有指定 itemType 时，按关键字分类
    const items: EngineeringAIItem[] = (parsed.items || []).map((item) => {
      const type =
        item.itemType === 'selfConstruction' || item.itemType === 'intelligent'
          ? item.itemType
          : classifyItemType(item.name);

      // 兜底匹配定额库
      let matchedItemId = item.matchedItemId;
      let matchedItemName = item.matchedItemName;
      let unitPrice = item.unitPrice;

      if (!matchedItemId) {
        const lib = type === 'selfConstruction' ? selfConstructionItems : intelligentItems;
        const found = lib.find(
          (libItem) => libItem.name.includes(item.name) || item.name.includes(libItem.name),
        );
        if (found) {
          matchedItemId = found.id;
          matchedItemName = found.name;
          unitPrice = unitPrice ?? found.price;
        }
      }

      return {
        name: item.name,
        itemType: type,
        quantity: item.quantity || 1,
        matchedItemId,
        matchedItemName,
        unitPrice,
        confidence: item.confidence ?? 0.5,
      };
    });

    return NextResponse.json({
      success: true,
      items,
      missingFields: parsed.missingFields || [],
      suggestions: parsed.suggestions || [],
      priceVersion,
    } as EngineeringParseResult);
  } catch (error) {
    console.error('[Engineering AI Parse] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        items: [],
        missingFields: ['系统错误'],
        suggestions: ['请稍后重试'],
        error: error instanceof Error ? error.message : '未知错误',
      } as EngineeringParseResult,
      { status: 500 },
    );
  }
}
