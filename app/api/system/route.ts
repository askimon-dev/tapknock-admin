import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchLiveBackendStats } from '@/lib/tapknock-api';

export async function GET() {
  try {
    // 1. Table row counts
    const tableStats = await query<{ table_name: string; count: string }>(`
      SELECT 'accounts' AS table_name, count(*) FROM accounts
      UNION ALL SELECT 'doors', count(*) FROM doors
      UNION ALL SELECT 'codes', count(*) FROM codes
      UNION ALL SELECT 'rings', count(*) FROM rings
      UNION ALL SELECT 'sessions', count(*) FROM sessions
      UNION ALL SELECT 'household', count(*) FROM household
      UNION ALL SELECT 'blocklist', count(*) FROM blocklist
      UNION ALL SELECT 'push_notifications', count(*) FROM push_notifications
      UNION ALL SELECT 'admin_audit_logs', count(*) FROM admin_audit_logs;
    `);

    // 2. PostgreSQL database info
    const dbSize = await query<{ size: string }>(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
    );
    const dbVersion = await query<{ version: string }>("SELECT version()");

    // 3. Admin audit logs
    const auditLogs = await query(
      'SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50'
    );

    // 4. Live backend status
    const liveBackend = await fetchLiveBackendStats();

    return NextResponse.json({
      db: {
        size: dbSize[0]?.size ?? 'Unknown',
        version: dbVersion[0]?.version?.split(' on ')[0] ?? 'PostgreSQL 16',
        tables: tableStats.map((t) => ({ name: t.table_name, count: parseInt(t.count, 10) })),
      },
      audit_logs: auditLogs,
      live_backend: liveBackend,
      server_time: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'system_stats_error', message: err.message }, { status: 500 });
  }
}
