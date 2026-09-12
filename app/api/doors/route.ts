import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    let sql = `
      SELECT d.*, c.public_code, a.email as owner_email, a.display_name as owner_name,
        (SELECT count(*) FROM rings r WHERE r.door_id = d.id) as ring_count
      FROM doors d
      LEFT JOIN codes c ON c.door_id = d.id AND c.revoked_at IS NULL
      LEFT JOIN accounts a ON a.id = d.owner_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      sql += ` AND (LOWER(d.label) LIKE $1 OR LOWER(d.display_name) LIKE $1 OR LOWER(c.public_code) LIKE $1 OR LOWER(a.email) LIKE $1)`;
      params.push(`%${q.toLowerCase()}%`);
    }

    sql += ` ORDER BY d.created_at DESC`;

    const doors = await query(sql, params);
    return NextResponse.json({ doors });
  } catch (err: any) {
    return NextResponse.json({ error: 'doors_fetch_error', message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_active, label, display_name, standing_note, auto_reply } = body;

    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (typeof is_active !== 'undefined') {
      updates.push(`is_active = $${idx++}`);
      params.push(is_active ? 1 : 0);
    }
    if (typeof label !== 'undefined') {
      updates.push(`label = $${idx++}`);
      params.push(label);
    }
    if (typeof display_name !== 'undefined') {
      updates.push(`display_name = $${idx++}`);
      params.push(display_name);
    }
    if (typeof standing_note !== 'undefined') {
      updates.push(`standing_note = $${idx++}`);
      params.push(standing_note);
    }
    if (typeof auto_reply !== 'undefined') {
      updates.push(`auto_reply = $${idx++}`);
      params.push(auto_reply);
    }

    if (!updates.length) {
      return NextResponse.json({ error: 'no_updates_provided' }, { status: 400 });
    }

    params.push(id);
    const sql = `UPDATE doors SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updated = await queryOne(sql, params);

    return NextResponse.json({ ok: true, door: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'door_update_error', message: err.message }, { status: 500 });
  }
}
