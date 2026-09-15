import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (!['clone_prod_to_staging', 'promote_staging_to_prod', 'create_snapshot'].includes(action)) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Supported actions: clone_prod_to_staging, promote_staging_to_prod, create_snapshot' },
        { status: 400 }
      );
    }

    if (action === 'create_snapshot') {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      // Create admin audit log entry for snapshot
      await query(
        `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `audit-${Date.now()}`,
          'admin',
          'db_snapshot',
          'database',
          'tapknock',
          `Manual database snapshot point created at ${ts}`,
          new Date().toISOString(),
        ]
      );
      return NextResponse.json({ ok: true, message: 'Snapshot point registered in audit logs' });
    }

    if (action === 'clone_prod_to_staging') {
      // 1. Terminate connections to tapknock_staging
      await query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = 'tapknock_staging' AND pid <> pg_backend_pid();
      `);

      // 2. Drop and recreate tapknock_staging from tapknock template
      await query('DROP DATABASE IF EXISTS tapknock_staging;');
      await query('CREATE DATABASE tapknock_staging WITH TEMPLATE tapknock OWNER tapknock;');

      await query(
        `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `audit-${Date.now()}`,
          'admin',
          'clone_prod_to_staging',
          'database',
          'tapknock_staging',
          'Production database cloned to staging environment',
          new Date().toISOString(),
        ]
      );

      return NextResponse.json({ ok: true, message: 'Successfully cloned production database to staging' });
    }

    if (action === 'promote_staging_to_prod') {
      // 1. Terminate connections to tapknock
      await query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = 'tapknock' AND pid <> pg_backend_pid();
      `);

      // 2. Clone staging to temp, swap databases with safety
      await query('DROP DATABASE IF EXISTS tapknock_temp_backup;');
      await query('CREATE DATABASE tapknock_temp_backup WITH TEMPLATE tapknock OWNER tapknock;');

      // 3. Drop production and recreate from tapknock_staging template
      await query('DROP DATABASE IF EXISTS tapknock;');
      await query('CREATE DATABASE tapknock WITH TEMPLATE tapknock_staging OWNER tapknock;');

      await query(
        `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `audit-${Date.now()}`,
          'admin',
          'promote_staging_to_prod',
          'database',
          'tapknock',
          'Staging database promoted to production (recovery backup kept at tapknock_temp_backup)',
          new Date().toISOString(),
        ]
      );

      return NextResponse.json({
        ok: true,
        message: 'Successfully promoted staging database to production. Previous production preserved in tapknock_temp_backup.',
      });
    }

    return NextResponse.json({ error: 'unhandled_action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'db_operation_failed', message: err.message }, { status: 500 });
  }
}
