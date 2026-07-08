import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

function requireAuth(request: NextRequest) {
  const session = verifySession(request);
  if (!session) return null;
  return session;
}

<<<<<<< HEAD
=======
type RouteContext = {
  params: Promise<{ id: string }>;
};

>>>>>>> dev-0602-zwj
// GET /api/clients/[id] — get client by id with quote history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
<<<<<<< HEAD
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
=======
    const id = parseInt((await context.params).id, 10);
>>>>>>> dev-0602-zwj
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '无效的客户ID' }, { status: 400 });
    }

    // Client detail
    const [clients] = await pool.query<any[]>(
      `SELECT id, client_code, name, contact_person, contact_phone, contact_email,
              address, region, level, remark, created_at, updated_at
       FROM clients WHERE id = ?`,
      [id]
    );

    if (clients.length === 0) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 });
    }

    const client = clients[0];

    // Maintenance quote history
    const [maintenanceQuotes] = await pool.query<any[]>(
      `SELECT id, quote_number, version, project_name, total, status,
              service_years, engineer_level, created_at, updated_at
       FROM maintenance_quotes
       WHERE client_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    // Engineering quote history
    const [engineeringQuotes] = await pool.query<any[]>(
      `SELECT id, quote_number, version, project_name, total, status,
              construction_area, created_at, updated_at
       FROM engineering_quotes
       WHERE client_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...client,
        quotes: {
          maintenance: maintenanceQuotes,
          engineering: engineeringQuotes,
        },
      },
    });
  } catch (error) {
    console.error('[Clients/[id] GET] Error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// PUT /api/clients/[id] — update client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
<<<<<<< HEAD
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
=======
    const id = parseInt((await context.params).id, 10);
>>>>>>> dev-0602-zwj
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '无效的客户ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, contact_person, contact_phone, contact_email, address, region, level, remark } = body;

    // Validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }

    if (contact_phone && typeof contact_phone === 'string' && contact_phone.length > 20) {
      return NextResponse.json({ success: false, error: '联系电话长度不能超过20位' }, { status: 400 });
    }

    if (contact_email && typeof contact_email === 'string' && contact_email.length > 100) {
      return NextResponse.json({ success: false, error: '邮箱长度不能超过100位' }, { status: 400 });
    }

    if (level && !['normal', 'vip', 'partner'].includes(level)) {
      return NextResponse.json({ success: false, error: '无效的客户级别' }, { status: 400 });
    }

    // Check existence
    const [existing] = await pool.query<any[]>(`SELECT id FROM clients WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 });
    }

    // Build dynamic update
    const updates: string[] = [];
    const queryParams: (string | number | null)[] = [];

    if (name !== undefined) { updates.push('name = ?'); queryParams.push(name.trim()); }
    if (contact_person !== undefined) { updates.push('contact_person = ?'); queryParams.push(contact_person?.trim() || null); }
    if (contact_phone !== undefined) { updates.push('contact_phone = ?'); queryParams.push(contact_phone?.trim() || null); }
    if (contact_email !== undefined) { updates.push('contact_email = ?'); queryParams.push(contact_email?.trim() || null); }
    if (address !== undefined) { updates.push('address = ?'); queryParams.push(address?.trim() || null); }
    if (region !== undefined) { updates.push('region = ?'); queryParams.push(region || '城区'); }
    if (level !== undefined) { updates.push('level = ?'); queryParams.push(level); }
    if (remark !== undefined) { updates.push('remark = ?'); queryParams.push(remark?.trim() || null); }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: '没有需要更新的字段' }, { status: 400 });
    }

    queryParams.push(id);
    await pool.query(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      queryParams
    );

    const [updated] = await pool.query<any[]>(
      `SELECT id, client_code, name, contact_person, contact_phone, contact_email,
              address, region, level, remark, created_at, updated_at
       FROM clients WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('[Clients/[id] PUT] Error:', error);
    return NextResponse.json({ success: false, error: '更新客户失败' }, { status: 500 });
  }
}

// DELETE /api/clients/[id] — delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
<<<<<<< HEAD
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
=======
    const id = parseInt((await context.params).id, 10);
>>>>>>> dev-0602-zwj
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: '无效的客户ID' }, { status: 400 });
    }

    const [existing] = await pool.query<any[]>(
      `SELECT id, client_code FROM clients WHERE id = ?`,
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 });
    }

    await pool.query(`DELETE FROM clients WHERE id = ?`, [id]);

    return NextResponse.json({
      success: true,
      message: '客户已删除',
    });
  } catch (error) {
    console.error('[Clients/[id] DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '删除客户失败' }, { status: 500 });
  }
}
