import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/api-auth-server';
import { callAIModel } from '@/lib/ai-config';
import { serializeDatabaseId } from '@/lib/assistant-db';
import { getDatabase, type DatabaseClient } from '@/lib/database/client';
import { validateBody } from '@/lib/api-validate';

const SYSTEM_PROMPT = `你是专业的IT设备识别助手，帮助用户从设备清单中提取设备信息并进行标准化分类。

## 你的能力
1. 从设备清单文本中提取设备名称、型号、数量等信息
2. 将设备归类到标准设备类型
3. 提供标准化的设备名称供系统匹配

## 输出格式（必须返回合法JSON）
{
  "devices": [
    {
      "rawText": "原始描述文本",
      "deviceName": "标准化设备名称（台式电脑|笔记本电脑|打印机|复印机|扫描仪|装订机|服务器|网络设备|监控设备|其他）",
      "model": "型号（如有）",
      "brand": "品牌（如有）",
      "quantity": 数量（数字）,
      "category": "设备类别（办公设备|网络设备|服务器|监控设备|其他）",
      "confidence": 识别置信度（0-1之间）,
      "warnings": ["警告信息（如有）"]
    }
  ],
  "summary": {
    "totalCount": 设备总数,
    "categories": ["类别列表"]
  },
  "suggestions": ["处理建议"]
}

## 设备类型识别规则
- 台式电脑、台式机、PC、计算机 -> "台式电脑"
- 笔记本、笔记本电脑、手提电脑 -> "笔记本电脑"
- 打印机、一体机、激光打印机、喷墨打印机 -> "打印机"
- 复印机、数码复合机 -> "复印机"
- 装订机、电动装订机 -> "装订机"
- 扫描仪 -> "扫描仪"
- 服务器、机架服务器、刀片服务器 -> "服务器"
- 交换机、路由器、防火墙、核心交换机 -> "网络设备"
- 摄像头、NVR、监控主机 -> "监控设备"

## 设备类别规则
- 台式电脑、笔记本电脑、打印机、复印机、扫描仪、装订机 -> "办公设备"
- 服务器 -> "服务器"
- 交换机、路由器、防火墙 -> "网络设备"
- 摄像头、监控 -> "监控设备"

## 重要规则
1. 必须返回合法的JSON格式，不要有额外文本
2. devices数组必须包含所有识别到的设备
3. confidence表示识别置信度，0-1之间
4. 如果无法识别设备类型，使用"其他"

现在分析用户提供的设备清单：`;

function parseAIResponse(content: string): unknown {
  try {
    let jsonStr = content;

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        return JSON.parse(objMatch[0]);
      }
    }

    throw new Error('无法解析 JSON');
  } catch (error) {
    console.error('解析 AI 返回失败:', error);
    throw error;
  }
}

interface ParsedDevice {
  rawText: string;
  deviceName: string;
  model?: string;
  brand?: string;
  quantity: number;
  category: string;
  confidence: number;
  warnings?: string[];
}

const requestSchema = z.object({ text: z.string().trim().min(1).max(100_000) });
const parsedDeviceSchema = z.object({
  rawText: z.string().default(''),
  deviceName: z.string().trim().min(1),
  model: z.string().optional(),
  brand: z.string().optional(),
  quantity: z.coerce.number().int().positive().default(1),
  category: z.string().default('其他'),
  confidence: z.coerce.number().min(0).max(1).default(0),
  warnings: z.array(z.string()).optional(),
});
const parsedResponseSchema = z.object({
  devices: z.array(parsedDeviceSchema),
  suggestions: z.array(z.string()).optional().default([]),
});

interface MatchedDevice extends ParsedDevice {
  matched: boolean;
  matchedDeviceId?: string;
  matchedDeviceName?: string;
  matchedPrice?: number;
  matchedMaintenanceRate?: number;
  matchedYear1Price?: number;
  matchedYear2Price?: number;
  matchedYear3Price?: number;
  candidates?: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    matchScore: number;
  }>;
}

function calculateMatchScore(deviceName: string, targetName: string): number {
  const name = deviceName.toLowerCase();
  const target = targetName.toLowerCase();

  if (name === target) return 1.0;

  if (name.includes(target) || target.includes(name)) {
    const shorter = Math.min(name.length, target.length);
    const longer = Math.max(name.length, target.length);
    return shorter / longer * 0.9;
  }

  const words1 = name.split(/[\s\-_]+/).filter(w => w.length > 1);
  const words2 = target.split(/[\s\-_]+/).filter(w => w.length > 1);
  
  const common = words1.filter(w => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];
  
  if (common.length === 0) return 0;
  
  return common.length / union.length * 0.8;
}

interface QuotaRow extends Record<string, unknown> {
  id: string | number | bigint;
  name: string;
  category: string;
  city_price: string | number;
  maintenance_rate: string | number;
  year1_total_price: string | number;
  year2_total_price: string | number;
  year3_total_price: string | number;
}

function quotaNumber(value: string | number): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

async function matchDeviceToQuota(database: DatabaseClient, device: ParsedDevice): Promise<MatchedDevice> {
  const matchedDevice: MatchedDevice = { ...device, matched: false };

  const matched = await database.query<QuotaRow>(`
    SELECT id, name, category, city_price, 
           year1_total_price, year2_total_price, year3_total_price,
           0 as maintenance_rate
    FROM device_quotas 
    WHERE is_active=true AND (name ILIKE $1 OR category ILIKE $2)
    ORDER BY city_price DESC
    LIMIT 100
  `, [`%${device.deviceName}%`, `%${device.category}%`]);
  const allQuotas = matched.rows;

  if (allQuotas.length === 0) {
    const alternatives = await database.query<QuotaRow>(`
      SELECT id, name, category, city_price, 
             year1_total_price, year2_total_price, year3_total_price,
             0 as maintenance_rate
      FROM device_quotas 
      WHERE is_active=true
      ORDER BY city_price DESC
      LIMIT 20
    `);

    const scored = alternatives.rows.map(q => ({
      id: String(serializeDatabaseId(q.id)),
      name: q.name,
      category: q.category,
      price: quotaNumber(q.city_price),
      matchScore: calculateMatchScore(device.deviceName, q.name)
    })).filter(q => q.matchScore > 0.1).sort((a, b) => b.matchScore - a.matchScore);

    matchedDevice.candidates = scored.slice(0, 5);
    return matchedDevice;
  }

  const scoredQuotas = allQuotas.map(q => ({
    ...q,
    matchScore: calculateMatchScore(device.deviceName, q.name)
  })).sort((a, b) => b.matchScore - a.matchScore);

  if (scoredQuotas.length > 0 && scoredQuotas[0].matchScore > 0.3) {
    const bestMatch = scoredQuotas[0];
    matchedDevice.matched = true;
    matchedDevice.matchedDeviceId = String(bestMatch.id);
    matchedDevice.matchedDeviceName = bestMatch.name;
    matchedDevice.matchedPrice = quotaNumber(bestMatch.city_price);
    matchedDevice.matchedMaintenanceRate = quotaNumber(bestMatch.maintenance_rate);
    matchedDevice.matchedYear1Price = quotaNumber(bestMatch.year1_total_price);
    matchedDevice.matchedYear2Price = quotaNumber(bestMatch.year2_total_price);
    matchedDevice.matchedYear3Price = quotaNumber(bestMatch.year3_total_price);

    if (scoredQuotas.length > 1) {
      matchedDevice.candidates = scoredQuotas.slice(1, 4).map(q => ({
        id: String(q.id),
        name: q.name,
        category: q.category,
        price: quotaNumber(q.city_price),
        matchScore: q.matchScore
      }));
    }
  } else {
    matchedDevice.candidates = scoredQuotas.slice(0, 5).map(q => ({
      id: String(q.id),
      name: q.name,
      category: q.category,
      price: quotaNumber(q.city_price),
      matchScore: q.matchScore
    }));
  }

  return matchedDevice;
}

async function callDeepSeekAPI(userMessage: string): Promise<string> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  const result = await callAIModel(messages, { temperature: 0.3, maxTokens: 3000 });
  if (!result.success || !result.content) {
    throw new Error(result.error || 'AI 调用失败');
  }
  return result.content;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const parsedBody = await validateBody(request, requestSchema);
  if (!parsedBody.ok) return parsedBody.response;
  try {
    const { text } = parsedBody.data;

    const aiResponse = await callDeepSeekAPI(text);
    const parsedResult = parsedResponseSchema.safeParse(parseAIResponse(aiResponse));
    if (!parsedResult.success) {
      return NextResponse.json(
        { success: false, error: 'AI 返回格式错误', devices: [], suggestions: [] },
        { status: 500 }
      );
    }

    const database = getDatabase();
    const matchedDevices = await Promise.all(
      parsedResult.data.devices.map((device) => matchDeviceToQuota(database, device)),
    );

    const totalCount = matchedDevices.reduce((sum: number, d: MatchedDevice) => sum + (d.quantity || 1), 0);
    const matchedCount = matchedDevices.filter((d: MatchedDevice) => d.matched).length;
    const unmatchedCount = matchedDevices.filter((d: MatchedDevice) => !d.matched).length;

    return NextResponse.json({
      success: true,
      devices: matchedDevices,
      summary: {
        totalDevices: matchedDevices.length,
        totalCount,
        matchedCount,
        unmatchedCount,
        categories: [...new Set(matchedDevices.map((d: MatchedDevice) => d.category))]
      },
      suggestions: parsedResult.data.suggestions
    });

  } catch (error: unknown) {
    console.error('[AI] 设备匹配失败:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('未找到可用的AI模型配置')) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI服务未配置',
          devices: [],
          suggestions: ['请在 .env 中配置 DEEPSEEK_API_KEY']
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'AI服务暂时不可用',
        devices: [],
        suggestions: ['AI服务暂时不可用，请稍后重试']
      },
      { status: 500 }
    );
  }
}
