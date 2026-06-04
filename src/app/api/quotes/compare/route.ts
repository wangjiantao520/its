import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

// 认证中间件
function requireAuth(request: NextRequest) {
  const session = verifySession(request);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    };
  }
  return { authorized: true, session };
}

// 比较两个值的差异
function diffValues(
  path: string,
  oldVal: any,
  newVal: any
): { path: string; old: any; new: any; type: 'added' | 'removed' | 'changed' } | null {
  if (oldVal === newVal) return null;

  // 处理 undefined/null
  if (oldVal === undefined && newVal !== undefined) {
    return { path, old: null, new: newVal, type: 'added' };
  }
  if (newVal === undefined && oldVal !== undefined) {
    return { path, old: oldVal, new: null, type: 'removed' };
  }
  if (oldVal === null && newVal !== null) {
    return { path, old: null, new: newVal, type: 'added' };
  }
  if (newVal === null && oldVal !== null) {
    return { path, old: oldVal, new: null, type: 'removed' };
  }

  return { path, old: oldVal, new: newVal, type: 'changed' };
}

// 深度比较两个对象
function deepDiff(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  prefix = ''
): Array<{ path: string; old: any; new: any; type: 'added' | 'removed' | 'changed' }> {
  const differences: Array<{ path: string; old: any; new: any; type: 'added' | 'removed' | 'changed' }> = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];

    // 如果两边都是对象或数组，递归比较
    if (
      oldVal !== null &&
      newVal !== null &&
      typeof oldVal === 'object' &&
      typeof newVal === 'object' &&
      !Array.isArray(oldVal) &&
      !Array.isArray(newVal)
    ) {
      differences.push(...deepDiff(oldVal, newVal, path));
    } else {
      const diff = diffValues(path, oldVal, newVal);
      if (diff) {
        differences.push(diff);
      }
    }
  }

  return differences;
}

// 比较数组项
function compareArrays(
  oldArr: any[],
  newArr: any[],
  itemsKey: string
): {
  added: any[];
  removed: any[];
  changed: Array<{ index: number; changes: Array<{ path: string; old: any; new: any; type: string }> }>;
} {
  const result = {
    added: [] as any[],
    removed: [] as any[],
    changed: [] as Array<{ index: number; changes: Array<{ path: string; old: any; new: any; type: string }> }>
  };

  // 简单比较：基于数组索引对应比较
  const maxLen = Math.max(oldArr.length, newArr.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldArr.length) {
      result.added.push({ index: i, item: newArr[i] });
    } else if (i >= newArr.length) {
      result.removed.push({ index: i, item: oldArr[i] });
    } else {
      const itemDiff = deepDiff(oldArr[i] || {}, newArr[i] || {}, `${itemsKey}[${i}]`);
      if (itemDiff.length > 0) {
        result.changed.push({ index: i, changes: itemDiff });
      }
    }
  }

  return result;
}

// POST - 比较两个版本
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { versionIdA, versionIdB } = body;

    if (!versionIdA || !versionIdB) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数: versionIdA, versionIdB' },
        { status: 400 }
      );
    }

    const [versionA, versionB] = await Promise.all([
      pool.query(
        'SELECT id, quote_id, quote_type, version, data, created_at, created_by FROM quote_versions WHERE id = ?',
        [parseInt(versionIdA)]
      ),
      pool.query(
        'SELECT id, quote_id, quote_type, version, data, created_at, created_by FROM quote_versions WHERE id = ?',
        [parseInt(versionIdB)]
      )
    ]);

    if ((versionA[0] as any).length === 0) {
      return NextResponse.json(
        { success: false, error: `版本 A (ID: ${versionIdA}) 不存在` },
        { status: 404 }
      );
    }

    if ((versionB[0] as any).length === 0) {
      return NextResponse.json(
        { success: false, error: `版本 B (ID: ${versionIdB}) 不存在` },
        { status: 404 }
      );
    }

    const vA = (versionA[0] as any)[0];
    const vB = (versionB[0] as any)[0];

    // 解析 JSON 数据
    const dataA = typeof vA.data === 'string' ? JSON.parse(vA.data) : vA.data;
    const dataB = typeof vB.data === 'string' ? JSON.parse(vB.data) : vB.data;

    // 比较顶层字段
    const topLevelChanges = deepDiff(dataA, dataB);

    // 比较 items 数组
    let itemsComparison = null;
    if (dataA.items && dataB.items) {
      itemsComparison = compareArrays(dataA.items, dataB.items, 'items');
    }

    // 比较 devices 数组
    let devicesComparison = null;
    if (dataA.devices && dataB.devices) {
      devicesComparison = compareArrays(dataA.devices, dataB.devices, 'devices');
    }

    // 计算统计摘要
    const stats = {
      totalChanges: topLevelChanges.length,
      addedCount: topLevelChanges.filter(c => c.type === 'added').length,
      removedCount: topLevelChanges.filter(c => c.type === 'removed').length,
      changedCount: topLevelChanges.filter(c => c.type === 'changed').length,
      itemsAdded: itemsComparison?.added.length || 0,
      itemsRemoved: itemsComparison?.removed.length || 0,
      itemsChanged: itemsComparison?.changed.length || 0,
      devicesAdded: devicesComparison?.added.length || 0,
      devicesRemoved: devicesComparison?.removed.length || 0,
      devicesChanged: devicesComparison?.changed.length || 0
    };

    return NextResponse.json({
      success: true,
      data: {
        versionA: {
          id: vA.id,
          version: vA.version,
          createdAt: vA.created_at,
          createdBy: vA.created_by
        },
        versionB: {
          id: vB.id,
          version: vB.version,
          createdAt: vB.created_at,
          createdBy: vB.created_by
        },
        stats,
        topLevelChanges,
        itemsComparison,
        devicesComparison
      }
    });
  } catch (error) {
    console.error('比较版本失败:', error);
    return NextResponse.json(
      { success: false, error: '比较版本失败' },
      { status: 500 }
    );
  }
}
