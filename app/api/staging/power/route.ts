import { NextRequest, NextResponse } from 'next/server';
import { getContainerStatus, startContainer, stopContainer } from '@/lib/docker';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json({ error: 'invalid_action', message: 'Action must be start, stop, or restart' }, { status: 400 });
    }

    const containerName = 'tapknock-staging';
    let result: { ok: boolean; error?: string };

    if (action === 'start') {
      result = await startContainer(containerName);
    } else if (action === 'stop') {
      result = await stopContainer(containerName, 5);
    } else {
      await stopContainer(containerName, 3);
      result = await startContainer(containerName);
    }

    if (!result.ok) {
      return NextResponse.json({ error: 'docker_action_failed', message: result.error }, { status: 500 });
    }

    // Record in admin audit logs
    try {
      await query(
        `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `audit-${Date.now()}`,
          'admin',
          `staging_${action}`,
          'container',
          containerName,
          `Staging container ${action} triggered via Admin Panel`,
          new Date().toISOString(),
        ]
      );
    } catch {}

    const updated = await getContainerStatus(containerName);
    return NextResponse.json({ ok: true, action, container: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'power_action_failed', message: err.message }, { status: 500 });
  }
}
