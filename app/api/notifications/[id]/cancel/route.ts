import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const notifId = params.id;
    if (!notifId) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const existing = await queryOne<{ status: string }>(
      'SELECT status FROM push_notifications WHERE id = $1',
      [notifId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (existing.status !== 'scheduled') {
      return NextResponse.json({ error: 'cannot_cancel', message: 'Only scheduled notifications can be cancelled' }, { status: 400 });
    }

    await query(
      "UPDATE push_notifications SET status = 'cancelled' WHERE id = $1",
      [notifId]
    );

    await query(
      'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        crypto.randomUUID(),
        'admin',
        'CANCEL_SCHEDULED_NOTIFICATION',
        'push_notification',
        notifId,
        JSON.stringify({ status: 'cancelled' }),
        new Date().toISOString(),
      ]
    );

    return NextResponse.json({ ok: true, message: 'Scheduled notification cancelled' });
  } catch (err: any) {
    return NextResponse.json({ error: 'cancel_failed', message: err.message }, { status: 500 });
  }
}
