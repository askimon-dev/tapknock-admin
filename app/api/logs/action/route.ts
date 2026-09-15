import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getPool } from '@/lib/db';
import {
  getContainerStatus,
  restartContainer,
  startContainer,
  stopContainer,
} from '@/lib/docker';

const SERVER_CONTAINER_MAP: Record<string, string> = {
  production: 'tapknock',
  prod: 'tapknock',
  staging: 'tapknock-staging',
  admin: 'tapknock-admin',
  postgres: 'tapknock-postgres',
  db: 'tapknock-postgres',
};

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const pool = getPool();
  try {
    const body = await req.json();
    const { server = 'production', action } = body;

    if (!action || !['restart', 'stop', 'start'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Must be restart, stop, or start.' },
        { status: 400 }
      );
    }

    const serverKey = (server || 'production').toLowerCase();
    const containerName = SERVER_CONTAINER_MAP[serverKey] || serverKey;

    let result: { ok: boolean; error?: string };
    if (action === 'restart') {
      result = await restartContainer(containerName, 5);
    } else if (action === 'stop') {
      result = await stopContainer(containerName, 5);
    } else {
      result = await startContainer(containerName);
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || `Failed to ${action} container` },
        { status: 500 }
      );
    }

    // Record action in admin audit logs
    try {
      const nowIso = new Date().toISOString();
      await pool.query(
        `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
         VALUES ($1, 'admin', $2, 'server_container', $3, $4, $5)`,
        [
          crypto.randomUUID(),
          `SERVER_${action.toUpperCase()}`,
          containerName,
          JSON.stringify({ server: serverKey, containerName, action, timestamp: nowIso }),
          nowIso,
        ]
      );
    } catch (auditErr) {
      console.warn('Could not record server action in audit log:', auditErr);
    }

    // Wait 500ms and get updated status
    await new Promise((r) => setTimeout(r, 500));
    const newStatus = await getContainerStatus(containerName);

    return NextResponse.json({
      ok: true,
      message: `Container ${containerName} (${serverKey}) ${action}ed successfully`,
      server: serverKey,
      containerName,
      status: newStatus,
    });
  } catch (err: any) {
    console.error('Error executing server log action:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
