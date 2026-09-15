import { NextRequest, NextResponse } from 'next/server';
import { queryTarget } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dbTarget = (searchParams.get('database') === 'staging' ? 'staging' : 'production') as 'production' | 'staging';

    const sql = `
      SELECT 
        t.relname AS name,
        COALESCE(t.n_live_tup, 0)::int AS row_estimate,
        pg_size_pretty(pg_total_relation_size(t.relid)) AS size,
        pg_total_relation_size(t.relid)::bigint AS size_bytes,
        (
          SELECT count(*)::int 
          FROM information_schema.columns c 
          WHERE c.table_name = t.relname AND c.table_schema = 'public'
        ) AS column_count
      FROM pg_stat_user_tables t
      ORDER BY t.relname ASC;
    `;

    const tables = await queryTarget(dbTarget, sql);

    // Calculate exact row count and primary key for each table
    for (const t of tables) {
      try {
        const exact = await queryTarget(dbTarget, `SELECT count(*)::int AS cnt FROM "${t.name}"`);
        t.exact_rows = exact[0]?.cnt ?? t.row_estimate;
      } catch {
        t.exact_rows = t.row_estimate;
      }

      try {
        const pkRes = await queryTarget(
          dbTarget,
          `
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = $1
            AND tc.table_schema = 'public'
          LIMIT 1;
        `,
          [t.name]
        );
        t.primary_key = pkRes[0]?.column_name || null;
      } catch {
        t.primary_key = null;
      }
    }

    return NextResponse.json({
      database: dbTarget,
      tables,
    });
  } catch (error: any) {
    console.error('Database tables route error:', error);
    return NextResponse.json(
      { error: 'tables_failed', message: error.message || 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}
