import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendInternalPush } from '@/lib/tapknock-api';
import crypto from 'node:crypto';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let sql = 'SELECT * FROM push_notifications WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      sql += ' AND status = $1';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const notifications = await query(sql, params);
    return NextResponse.json({ notifications });
  } catch (err: any) {
    return NextResponse.json({ error: 'notifications_fetch_error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      body: text,
      target_type = 'all',
      target_account_ids = [],
      priority = 'normal',
      category = 'announcement',
      action_url = null,
      scheduled_at = null,
    } = body;

    if (!title?.trim() || !text?.trim()) {
      return NextResponse.json({ error: 'title_and_body_required', message: 'Title and message body are required.' }, { status: 400 });
    }

    // Call TapKnock Core Backend Push Dispatcher
    const backendResult = await sendInternalPush({
      title: title.trim(),
      body: text.trim(),
      target: target_type === 'targeted' ? 'targeted' : 'all',
      account_ids: target_account_ids,
      priority,
      category,
      action_url,
      scheduled_at,
      created_by: 'admin',
    });

    if (backendResult?.ok) {
      return NextResponse.json(backendResult);
    }

    // Fallback: If backend is momentarily unreachable directly, insert into database directly
    const notifId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const isScheduled = scheduled_at && new Date(scheduled_at).getTime() > Date.now();

    const notifRow = {
      id: notifId,
      title: title.trim(),
      body: text.trim(),
      target_type,
      target_account_ids: JSON.stringify(target_account_ids),
      target_label: target_type === 'all' ? 'All Users' : `Targeted (${target_account_ids.length} accounts)`,
      priority,
      category,
      action_url,
      scheduled_at: isScheduled ? new Date(scheduled_at).toISOString() : null,
      sent_at: isScheduled ? null : nowIso,
      status: isScheduled ? 'scheduled' : 'sent',
      recipients_count: target_account_ids.length || 1,
      delivered_count: 0,
      created_at: nowIso,
      created_by: 'admin',
    };

    await query(
      `INSERT INTO push_notifications (
        id, title, body, target_type, target_account_ids, target_label,
        priority, category, action_url, scheduled_at, sent_at,
        status, recipients_count, delivered_count, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        notifRow.id, notifRow.title, notifRow.body, notifRow.target_type,
        notifRow.target_account_ids, notifRow.target_label, notifRow.priority,
        notifRow.category, notifRow.action_url, notifRow.scheduled_at,
        notifRow.sent_at, notifRow.status, notifRow.recipients_count,
        notifRow.delivered_count, notifRow.created_at, notifRow.created_by,
      ]
    );

    return NextResponse.json({ ok: true, notification: notifRow, fallback: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'dispatch_failed', message: err.message }, { status: 500 });
  }
}
