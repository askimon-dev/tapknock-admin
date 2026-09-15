import { NextRequest, NextResponse } from 'next/server';
import { queryTarget } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dbTarget = (searchParams.get('database') === 'staging' ? 'staging' : 'production') as 'production' | 'staging';
    const tableName = searchParams.get('table');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;
    const sort = searchParams.get('sort');
    const order = (searchParams.get('order') || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const search = searchParams.get('search')?.trim();

    if (!tableName) {
      return NextResponse.json({ error: 'missing_table', message: 'Table name is required' }, { status: 400 });
    }

    // 1. Verify table exists in public schema (prevents SQL injection)
    const tableCheck = await queryTarget(
      dbTarget,
      `SELECT relname FROM pg_stat_user_tables WHERE relname = $1;`,
      [tableName]
    );
    if (tableCheck.length === 0) {
      return NextResponse.json({ error: 'table_not_found', message: `Table "${tableName}" not found` }, { status: 404 });
    }

    // 2. Fetch table column definitions
    const colsSql = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    const colDefs = await queryTarget(dbTarget, colsSql, [tableName]);
    const validCols = colDefs.map((c: any) => c.column_name);
    const colTypes: Record<string, string> = {};
    for (const c of colDefs) {
      colTypes[c.column_name] = c.data_type;
    }

    // 3. Build search condition if search query provided
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      const searchTerms: string[] = [];
      for (const col of colDefs) {
        // Search text, varchar, character, integer, etc. by casting to text
        params.push(`%${search}%`);
        searchTerms.push(`"${col.column_name}"::text ILIKE $${params.length}`);
      }
      if (searchTerms.length > 0) {
        conditions.push(`(${searchTerms.join(' OR ')})`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 4. Count total matching rows
    const countSql = `SELECT count(*)::int AS total FROM "${tableName}" ${whereClause};`;
    const countRes = await queryTarget(dbTarget, countSql, params);
    const total = countRes[0]?.total || 0;

    // 5. Build order clause
    let orderClause = '';
    if (sort && validCols.includes(sort)) {
      orderClause = `ORDER BY "${sort}" ${order}`;
    } else if (validCols.includes('created_at')) {
      orderClause = `ORDER BY "created_at" DESC`;
    } else if (validCols.includes('id')) {
      orderClause = `ORDER BY "id" ASC`;
    }

    // 6. Fetch paginated data
    const dataParams = [...params, limit, offset];
    const dataSql = `
      SELECT * FROM "${tableName}"
      ${whereClause}
      ${orderClause}
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
    `;

    const rows = await queryTarget(dbTarget, dataSql, dataParams);

    return NextResponse.json({
      database: dbTarget,
      table: tableName,
      columns: validCols,
      columnTypes: colTypes,
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error('Database data route error:', error);
    return NextResponse.json(
      { error: 'data_failed', message: error.message || 'Failed to fetch table data' },
      { status: 500 }
    );
  }
}
