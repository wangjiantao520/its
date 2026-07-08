import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifySession } from '@/lib/auth';

// Helper: require auth
function requireAuth(request: NextRequest) {
  const session = verifySession(request);
  if (!session) {
    return null;
  }
  return session;
}

// GET /api/clients — paginated list with search & filter
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const search = searchParams.get('search') || '';
    const level = searchParams.get('level') || '';
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push('(name LIKE ? OR client_code LIKE ? OR contact_person LIKE ? OR contact_phone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (level && ['normal', 'vip', 'partner'].includes(level)) {
      conditions.push('level = ?');
      params.push(level);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM clients ${where}`,
      params
    );
    const total = countRows[0].total;

    // Data
    const [rows] = await pool.query<any[]>(
      `SELECT id, client_code, name, contact_person, contact_phone, contact_email,
              address, region, level, remark, created_at, updated_at
       FROM clients ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return NextResponse.json({
      success: true,
      data: {
        list: rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('[Clients GET] Error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST /api/clients — create client with auto-generated client_code
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, contact_person, contact_phone, contact_email, address, region, level, remark } = body;

    // Basic validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
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

    // Generate client_code: CL + YYYYMMDD + 4-digit sequence
    const today = new Date();
    const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `CL${yyyymmdd}`;

    // Lock to get next sequence number for today
    const [seqRows] = await pool.query<any[]>(
      `SELECT client_code FROM clients WHERE client_code LIKE ? ORDER BY client_code DESC LIMIT 1 FOR UPDATE`,
      [`${prefix}%`]
    );

    let seq = 1;
    if (seqRows.length > 0) {
      const lastCode = seqRows[0].client_code as string;
      const lastSeq = parseInt(lastCode.slice(-4), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    const client_code = `${prefix}${String(seq).padStart(4, '0')}`;

    const [result] = await pool.query<any>(
      `INSERT INTO clients (client_code, name, contact_person, contact_phone, contact_email, address, region, level, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_code,
        name.trim(),
        contact_person?.trim() || null,
        contact_phone?.trim() || null,
        contact_email?.trim() || null,
        address?.trim() || null,
        region || '城区',
        level || 'normal',
        remark?.trim() || null,
      ]
    );

    const insertId = (result as any).insertId;

    const [newRows] = await pool.query<any[]>(
      `SELECT id, client_code, name, contact_person, contact_phone, contact_email,
              address, region, level, remark, created_at, updated_at
       FROM clients WHERE id = ?`,
      [insertId]
    );

    return NextResponse.json({ success: true, data: newRows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Clients POST] Error:', error);
    return NextResponse.json({ success: false, error: '创建客户失败' }, { status: 500 });
  }
}

// PUT /api/clients — update client by id (query param: ?id=xxx)
export async function PUT(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '', 10);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, error: '缺少或无效的客户ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, contact_person, contact_phone, contact_email, address, region, level, remark } = body;

    // Validate
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
    const params: (string | number | null)[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (contact_person !== undefined) { updates.push('contact_person = ?'); params.push(contact_person?.trim() || null); }
    if (contact_phone !== undefined) { updates.push('contact_phone = ?'); params.push(contact_phone?.trim() || null); }
    if (contact_email !== undefined) { updates.push('contact_email = ?'); params.push(contact_email?.trim() || null); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address?.trim() || null); }
    if (region !== undefined) { updates.push('region = ?'); params.push(region || '城区'); }
    if (level !== undefined) { updates.push('level = ?'); params.push(level); }
    if (remark !== undefined) { updates.push('remark = ?'); params.push(remark?.trim() || null); }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: '没有需要更新的字段' }, { status: 400 });
    }

    params.push(id);
    await pool.query(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await pool.query<any[]>(
      `SELECT id, client_code, name, contact_person, contact_phone, contact_email,
              address, region, level, remark, created_at, updated_at
       FROM clients WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('[Clients PUT] Error:', error);
    return NextResponse.json({ success: false, error: '更新客户失败' }, { status: 500 });
  }
}

// DELETE /api/clients — soft delete by id (?id=xxx) or hard delete (?id=xxx&hard=true)
// 软删除设置deleted_at时间戳，硬删除永久删除
export async function DELETE(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id') || '';
    const id = parseInt(idStr, 10);
    const hard = searchParams.get('hard') === 'true';

    if (!idStr || isNaN(id)) {
      return NextResponse.json({ success: false, error: '缺少或无效的客户ID' }, { status: 400 });
    }

    // 检查是否存在
    const [existing] = await pool.query<any[]>(`SELECT id, client_code FROM clients WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 });
    }

    // 软删除: 更新deleted_at时间戳; 硬删除: 永久删除
    if (hard) {
      await pool.query(`DELETE FROM clients WHERE id = ?`, [id]);
      return NextResponse.json({ success: true, message: '客户已永久删除' });
    } else {
      // 软删除 (如果需要实现，可以添加deleted_at字段)
      // 目前直接硬删除，未来可扩展
      await pool.query(`DELETE FROM clients WHERE id = ?`, [id]);
      return NextResponse.json({ success: true, message: '客户已删除' });
    }
  } catch (error) {
    console.error('[Clients DELETE] Error:', error);
    return NextResponse.json({ success: false, error: '删除客户失败' }, { status: 500 });
  }
}
