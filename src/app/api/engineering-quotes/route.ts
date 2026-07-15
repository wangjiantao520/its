import { NextRequest, NextResponse } from 'next/server';
import pool, { initDatabase } from '@/lib/db';
import { requireApiAuth } from '@/lib/api-auth-server';

// 初始化数据库
export async function GET(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    // 初始化数据库表
    await initDatabase();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const keyword = searchParams.get('keyword') || '';
    const status = searchParams.get('status') || '';

    // 构建查询条件
    let whereClause = '';
    const params: any[] = [];

    if (keyword) {
      whereClause += ' WHERE (project_name LIKE ? OR client_name LIKE ? OR quote_number LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      if (whereClause) {
        whereClause += ' AND status = ?';
      } else {
        whereClause += ' WHERE status = ?';
      }
      params.push(status);
    }

    if (auth.session.role !== 'admin') {
      whereClause += whereClause ? ' AND created_by = ?' : ' WHERE created_by = ?';
      params.push(String(auth.session.userId ?? -1));
    }

    const [rows] = await pool.execute(
      `SELECT * FROM engineering_quotes${whereClause} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM engineering_quotes${whereClause}`,
      params
    );
    const total = (countResult as any)[0].total;

    // 解析 items JSON 字符串
    const parsedRows = (rows as any[]).map(row => ({
      ...row,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    }));

    return NextResponse.json({
      success: true,
      data: parsedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取工程报价列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取工程报价列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      quoteNumber,
      projectName,
      clientName,
      contactPerson,
      contactPhone,
      constructionArea,
      managementRate,
      profitRate,
      regulatoryRate,
      taxRate,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      tax,
      total,
      items
    } = body;

    if (typeof quoteNumber !== 'string' || !quoteNumber.trim() || typeof projectName !== 'string' || !projectName.trim()) {
      return NextResponse.json({ success: false, error: '报价编号和项目名称不能为空' }, { status: 400 });
    }
    const numericValues = {
      constructionArea, managementRate, profitRate, regulatoryRate, taxRate,
      subtotal, managementFee, profit, regulatoryFee, tax, total,
    };
    for (const [field, value] of Object.entries(numericValues)) {
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        return NextResponse.json({ success: false, error: `${field} 必须是有效的非负数` }, { status: 400 });
      }
    }
    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: '报价明细格式无效' }, { status: 400 });
    }

    const [result] = await pool.execute(
      `INSERT INTO engineering_quotes 
       (quote_number, project_name, client_name, contact_person, contact_phone, 
        construction_area, management_rate, profit_rate, regulatory_rate, tax_rate,
        subtotal, management_fee, profit, regulatory_fee, tax, total, items, 
        created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quoteNumber,
        projectName,
        clientName,
        contactPerson,
        contactPhone,
        constructionArea,
        managementRate,
        profitRate,
        regulatoryRate,
        taxRate,
        subtotal,
        managementFee,
        profit,
        regulatoryFee,
        tax,
        total,
        JSON.stringify(items),
        String(auth.session.userId ?? auth.session.username ?? -1),
        auth.session.name || auth.session.username || auth.session.role,
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: (result as { insertId?: number | bigint }).insertId }
    });
  } catch (error) {
    console.error('创建工程报价失败:', error);
    return NextResponse.json(
      { success: false, error: '创建工程报价失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      id,
      quoteNumber,
      projectName,
      clientName,
      contactPerson,
      contactPhone,
      constructionArea,
      managementRate,
      profitRate,
      regulatoryRate,
      taxRate,
      subtotal,
      managementFee,
      profit,
      regulatoryFee,
      tax,
      total,
      items,
      status
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少报价ID' },
        { status: 400 }
      );
    }

    const [ownerRows] = await pool.execute('SELECT created_by FROM engineering_quotes WHERE id = ?', [id]);
    const owner = (ownerRows as Array<{ created_by: string | null }>)[0];
    if (!owner) {
      return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 });
    }
    if (auth.session.role !== 'admin' && owner.created_by !== String(auth.session.userId ?? -1)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    // 将 undefined 转为 null，避免 MySQL2 报错
    const safeValue = (v: any) => v === undefined ? null : v;

    const [result] = await pool.execute(
      `UPDATE engineering_quotes
       SET quote_number = ?, project_name = ?, client_name = ?, contact_person = ?, contact_phone = ?,
           construction_area = ?, management_rate = ?, profit_rate = ?, regulatory_rate = ?, tax_rate = ?,
           subtotal = ?, management_fee = ?, profit = ?, regulatory_fee = ?, tax = ?, total = ?,
           items = ?, status = ?
       WHERE id = ?`,
      [
        safeValue(quoteNumber),
        safeValue(projectName),
        safeValue(clientName),
        safeValue(contactPerson),
        safeValue(contactPhone),
        safeValue(constructionArea),
        safeValue(managementRate),
        safeValue(profitRate),
        safeValue(regulatoryRate),
        safeValue(taxRate),
        safeValue(subtotal),
        safeValue(managementFee),
        safeValue(profit),
        safeValue(regulatoryFee),
        safeValue(tax),
        safeValue(total),
        JSON.stringify(items),
        status || 'draft',
        id
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id }
    });
  } catch (error) {
    console.error('更新工程报价失败:', error);
    return NextResponse.json(
      { success: false, error: '更新工程报价失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireApiAuth(request, ['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { id } = body;

    const [result] = await pool.execute(
      'DELETE FROM engineering_quotes WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除工程报价失败:', error);
    return NextResponse.json(
      { success: false, error: '删除工程报价失败' },
      { status: 500 }
    );
  }
}
