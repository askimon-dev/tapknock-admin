import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'node:crypto';

export async function GET() {
  try {
    const blocks = await query(
      `SELECT b.*, d.label as door_label, d.display_name as door_name,
              r.visitor_name, r.reason as ring_reason
       FROM blocklist b
       JOIN doors d ON d.id = b.door_id
       LEFT JOIN rings r ON r.id = b.ring_id
       ORDER BY b.created_at DESC`
    );
    return NextResponse.json({ blocks });
  } catch (err: any) {
    return NextResponse.json({ error: 'blocklist_fetch_error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { door_id, fingerprint, reason } = await request.json();
    if (!door_id || !fingerprint) {
      return NextResponse.json({ error: 'door_id_and_fingerprint_required' }, { status: 400 });
    }

    const blockId = crypto.randomUUID();
    await query(
      `INSERT INTO blocklist (id, door_id, fingerprint, reason, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (door_id, fingerprint) DO NOTHING`,
      [blockId, door_id, fingerprint, reason || 'Blocked by admin', new Date().toISOString()]
    );

    return NextResponse.json({ ok: true, message: 'Fingerprint blocked' });
  } catch (err: any) {
    return NextResponse.json({ error: 'block_failed', message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doorId = searchParams.get('door_id');
    const fingerprint = searchParams.get('fingerprint');

    if (!doorId || !fingerprint) {
      return NextResponse.json({ error: 'door_id_and_fingerprint_required' }, { status: 400 });
    }

    await query('DELETE FROM blocklist WHERE door_id = $1 AND fingerprint = $2', [doorId, fingerprint]);
    return NextResponse.json({ ok: true, message: 'Unblocked successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: 'unblock_failed', message: err.message }, { status: 500 });
  }
}
