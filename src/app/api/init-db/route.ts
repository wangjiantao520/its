import { NextRequest, NextResponse } from 'next/server';

import { requireApiAuth } from '@/lib/api-auth-server';
import { getDatabase } from '@/lib/database/client';

interface MigrationRow extends Record<string, unknown> {
  version: string | number | bigint;
}

function migrationVersion(value: string | number | bigint): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed < BigInt(0) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('schema migration version exceeds the supported range');
  }
  return Number(parsed);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const database = getDatabase();
    await database.healthCheck();
    const appliedResult = await database.query<MigrationRow>(
      'SELECT version FROM "schema_migrations" ORDER BY version',
    );
    const appliedVersions = appliedResult.rows.map(({ version }) => migrationVersion(version));

    return NextResponse.json({
      success: true,
      message: `数据库连接正常，已应用 ${appliedVersions.length} 个迁移`,
      data: {
        healthy: true,
        appliedVersions,
      },
    });
  } catch (error) {
    console.error('数据库状态检查失败:', error);
    return NextResponse.json({
      success: false,
      message: '数据库连接或迁移状态检查失败',
    }, { status: 500 });
  }
}
