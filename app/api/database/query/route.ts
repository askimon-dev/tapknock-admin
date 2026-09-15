import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

const DESTRUCTIVE_REGEX = /\b(DROP|TRUNCATE|ALTER|DELETE|UPDATE|REVOKE|GRANT)\b/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dbTarget = (body.database === 'staging' ? 'staging' : 'production') as 'production' | 'staging';
    const rawSql = (body.sql || '').trim();
    const confirmDangerous = Boolean(body.confirmDangerous);

    if (!rawSql) {
      return NextResponse.json({ error: 'empty_query', message: 'SQL query text cannot be empty' }, { status: 400 });
    }

    const isDestructive = DESTRUCTIVE_REGEX.test(rawSql);

    // Require explicit confirmation for destructive queries on production
    if (dbTarget === 'production' && isDestructive && !confirmDangerous) {
      return NextResponse.json({
        requiresConfirmation: true,
        message: 'Destructive query detected on the LIVE PRODUCTION database. Please review and confirm execution.',
        sql: rawSql,
      }, { status: 403 });
    }

    const pool = getDbPool(dbTarget);
    const start = performance.now();
    const res = await pool.query(rawSql);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    // Handle multiple queries or single query
    const results = Array.isArray(res) ? res[res.length - 1] : res;
    const columns = results.fields ? results.fields.map((f: any) => f.name) : [];
    const rows = results.rows || [];
    const rowCount = results.rowCount ?? rows.length;
    const command = results.command || 'QUERY';

    // If query modified data, record audit log on production database
    if (isDestructive) {
      try {
        const prodPool = getDbPool('production');
        await prodPool.query(
          `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `audit-sql-${Date.now()}`,
            'admin',
            'execute_sql',
            'database',
            dbTarget === 'staging' ? 'tapknock_staging' : 'tapknock',
            JSON.stringify({ sql: rawSql.slice(0, 500), rowsAffected: rowCount, durationMs }),
            new Date().toISOString(),
          ]
        );
      } catch (auditErr) {
        console.warn('Failed to record audit log for SQL execution:', auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      database: dbTarget,
      command,
      columns,
      rows,
      rowCount,
      durationMs,
    });
  } catch (error: any) {
    console.error('Database query execution error:', error);
    return NextResponse.json(
      {
        error: 'query_execution_error',
        message: error.message || 'Error executing query',
        position: error.position ? parseInt(error.position, 10) : undefined,
        detail: error.detail || undefined,
        hint: error.hint || undefined,
        code: error.code || undefined,
      },
      { status: 400 }
    );
  }
}
