import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';
import { asQuoteSource, canAccessQuote } from '@/lib/quote-access';

interface VersionRow extends Record<string, unknown> {
  id: string | number | bigint; quote_id: string | number | bigint; quote_type: string;
  version: number; data: unknown; created_at: Date | string; created_by: string | null;
}
type Difference = { path: string; old: unknown; new: unknown; type: 'added' | 'removed' | 'changed' };

function asRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function deepDiff(oldObject: Record<string, unknown>, newObject: Record<string, unknown>, prefix = ''): Difference[] {
  const differences: Difference[] = [];
  for (const key of new Set([...Object.keys(oldObject), ...Object.keys(newObject)])) {
    const path = prefix ? `${prefix}.${key}` : key;
    const oldValue = oldObject[key]; const newValue = newObject[key];
    if (oldValue !== null && newValue !== null && typeof oldValue === 'object' && typeof newValue === 'object' && !Array.isArray(oldValue) && !Array.isArray(newValue)) {
      differences.push(...deepDiff(asRecord(oldValue), asRecord(newValue), path));
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      differences.push({ path, old: oldValue ?? null, new: newValue ?? null, type: oldValue === undefined || oldValue === null ? 'added' : newValue === undefined || newValue === null ? 'removed' : 'changed' });
    }
  }
  return differences;
}
function arrayComparison(oldValue: unknown, newValue: unknown, key: string) {
  const oldItems = Array.isArray(oldValue) ? oldValue : []; const newItems = Array.isArray(newValue) ? newValue : [];
  const added: unknown[] = []; const removed: unknown[] = []; const changed: Array<{ index: number; changes: Difference[] }> = [];
  for (let index = 0; index < Math.max(oldItems.length, newItems.length); index += 1) {
    if (index >= oldItems.length) added.push({ index, item: newItems[index] });
    else if (index >= newItems.length) removed.push({ index, item: oldItems[index] });
    else { const changes = deepDiff(asRecord(oldItems[index]), asRecord(newItems[index]), `${key}[${index}]`); if (changes.length) changed.push({ index, changes }); }
  }
  return { added, removed, changed };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const raw = await request.json() as unknown;
    const body = asRecord(raw);
    const versionIdA = Number(body.versionIdA); const versionIdB = Number(body.versionIdB);
    if (![versionIdA, versionIdB].every((id) => Number.isSafeInteger(id) && id > 0)) return NextResponse.json({ success: false, error: '缺少必需参数: versionIdA, versionIdB' }, { status: 400 });
    const database = getDatabase();
    const [resultA, resultB] = await Promise.all([
      database.query<VersionRow>('SELECT id, quote_id, quote_type, version, data, created_at, created_by FROM quote_versions WHERE id=$1', [versionIdA]),
      database.query<VersionRow>('SELECT id, quote_id, quote_type, version, data, created_at, created_by FROM quote_versions WHERE id=$1', [versionIdB]),
    ]);
    const versionA = resultA.rows[0]; const versionB = resultB.rows[0];
    if (!versionA) return NextResponse.json({ success: false, error: `版本 A (ID: ${versionIdA}) 不存在` }, { status: 404 });
    if (!versionB) return NextResponse.json({ success: false, error: `版本 B (ID: ${versionIdB}) 不存在` }, { status: 404 });
    const sourceA = asQuoteSource(versionA.quote_type); const sourceB = asQuoteSource(versionB.quote_type);
    if (!sourceA || !sourceB || !await canAccessQuote(database, auth.session, sourceA, Number(versionA.quote_id)) || !await canAccessQuote(database, auth.session, sourceB, Number(versionB.quote_id))) {
      return NextResponse.json({ success: false, error: '版本不存在或无权访问' }, { status: 404 });
    }
    const dataA = asRecord(versionA.data); const dataB = asRecord(versionB.data);
    const topLevelChanges = deepDiff(dataA, dataB);
    const itemsComparison = dataA.items || dataB.items ? arrayComparison(dataA.items, dataB.items, 'items') : null;
    const devicesComparison = dataA.devices || dataB.devices ? arrayComparison(dataA.devices, dataB.devices, 'devices') : null;
    return NextResponse.json({ success: true, data: {
      versionA: { id: String(versionA.id), version: versionA.version, createdAt: versionA.created_at, createdBy: versionA.created_by },
      versionB: { id: String(versionB.id), version: versionB.version, createdAt: versionB.created_at, createdBy: versionB.created_by },
      stats: { totalChanges: topLevelChanges.length, addedCount: topLevelChanges.filter((item) => item.type === 'added').length, removedCount: topLevelChanges.filter((item) => item.type === 'removed').length, changedCount: topLevelChanges.filter((item) => item.type === 'changed').length,
        itemsAdded: itemsComparison?.added.length ?? 0, itemsRemoved: itemsComparison?.removed.length ?? 0, itemsChanged: itemsComparison?.changed.length ?? 0,
        devicesAdded: devicesComparison?.added.length ?? 0, devicesRemoved: devicesComparison?.removed.length ?? 0, devicesChanged: devicesComparison?.changed.length ?? 0 },
      topLevelChanges, itemsComparison, devicesComparison,
    } });
  } catch (error) {
    console.error('比较版本失败:', error);
    return NextResponse.json({ success: false, error: '比较版本失败' }, { status: 500 });
  }
}
