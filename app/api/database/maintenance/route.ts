import { NextRequest, NextResponse } from 'next/server';
import { queryTarget } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dbTarget = (searchParams.get('database') === 'staging' ? 'staging' : 'production') as 'production' | 'staging';

    // 1. Active sessions & queries in PostgreSQL
    const activitiesSql = `
      SELECT 
        pid,
        usename,
        client_addr::text AS client_ip,
        application_name,
        state,
        query_start::text AS query_start,
        ROUND(EXTRACT(EPOCH FROM (now() - query_start))::numeric, 2)::float AS duration_seconds,
        query
      FROM pg_stat_activity
      WHERE datname = (SELECT current_database())
        AND pid <> pg_backend_pid()
      ORDER BY query_start ASC NULLS LAST;
    `;
    const activities = await queryTarget(dbTarget, activitiesSql);

    // 2. Active locks
    const locksSql = `
      SELECT 
        l.pid,
        l.locktype,
        l.mode,
        l.granted,
        c.relname AS table_name,
        a.query
      FROM pg_locks l
      LEFT JOIN pg_class c ON l.relation = c.oid
      LEFT JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE a.datname = (SELECT current_database())
        AND l.pid <> pg_backend_pid()
      LIMIT 20;
    `;
    const locks = await queryTarget(dbTarget, locksSql).catch(() => []);

    // 3. Database cache hit ratio & dead tuples
    const bloatSql = `
      SELECT 
        relname AS table_name,
        n_live_tup::int AS live_tuples,
        n_dead_tup::int AS dead_tuples,
        last_vacuum::text AS last_vacuum,
        last_autovacuum::text AS last_autovacuum,
        last_analyze::text AS last_analyze,
        last_autoanalyze::text AS last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY n_dead_tup DESC;
    `;
    const vacuumStats = await queryTarget(dbTarget, bloatSql);

    return NextResponse.json({
      database: dbTarget,
      activities,
      locks,
      vacuumStats,
    });
  } catch (error: any) {
    console.error('Database maintenance GET error:', error);
    return NextResponse.json(
      { error: 'maintenance_fetch_failed', message: error.message || 'Failed to fetch diagnostics' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dbTarget = (body.database === 'staging' ? 'staging' : 'production') as 'production' | 'staging';
    const action = body.action as string;
    const table = body.table as string | undefined;

    if (action === 'vacuum') {
      if (table) {
        await queryTarget(dbTarget, `VACUUM ANALYZE "${table}";`);
        return NextResponse.json({ success: true, message: `Successfully ran VACUUM ANALYZE on table ${table}` });
      } else {
        await queryTarget(dbTarget, `VACUUM ANALYZE;`);
        return NextResponse.json({ success: true, message: 'Successfully ran database-wide VACUUM ANALYZE' });
      }
    }

    if (action === 'analyze') {
      if (table) {
        await queryTarget(dbTarget, `ANALYZE "${table}";`);
        return NextResponse.json({ success: true, message: `Successfully analyzed table ${table}` });
      } else {
        await queryTarget(dbTarget, `ANALYZE;`);
        return NextResponse.json({ success: true, message: 'Successfully analyzed all tables' });
      }
    }

    if (action === 'terminate_pid') {
      const pid = parseInt(body.pid, 10);
      if (!pid || isNaN(pid)) {
        return NextResponse.json({ error: 'invalid_pid', message: 'Valid integer PID required' }, { status: 400 });
      }
      const res = await queryTarget(dbTarget, `SELECT pg_terminate_backend($1) AS terminated;`, [pid]);
      return NextResponse.json({
        success: true,
        message: res[0]?.terminated ? `Process ${pid} terminated` : `Could not terminate process ${pid}`,
      });
    }

    if (action === 'reset_stats') {
      await queryTarget(dbTarget, `SELECT pg_stat_reset();`);
      return NextResponse.json({ success: true, message: 'PostgreSQL statistics reset' });
    }

    return NextResponse.json({ error: 'unsupported_action', message: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    console.error('Database maintenance POST error:', error);
    return NextResponse.json(
      { error: 'maintenance_action_failed', message: error.message || 'Action failed' },
      { status: 500 }
    );
  }
}
