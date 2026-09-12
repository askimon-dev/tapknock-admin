import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doorId = searchParams.get('door_id');
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let sql = `
      SELECT r.id, r.door_id, r.code_id, r.visitor_name, r.reason,
             r.lat, r.lng, r.distance_m, r.ip_city, r.ip_country, r.trust_badge,
             r.fingerprint, r.status, r.answered_by, r.answered_at, r.ended_at,
             r.connection_type, r.duration_s, r.message_type, r.media_mime, r.media_size,
             r.message_text, r.message_sent_at, r.photo_at, r.created_at,
             d.label as door_label, d.display_name as door_name,
             CASE WHEN r.media_path IS NOT NULL THEN true ELSE false END as has_media,
             CASE WHEN r.photo IS NOT NULL OR r.photo_at IS NOT NULL THEN true ELSE false END as has_photo
      FROM rings r
      LEFT JOIN doors d ON d.id = r.door_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (doorId) {
      sql += ` AND r.door_id = $${idx++}`;
      params.push(doorId);
    }
    if (status && status !== 'all') {
      sql += ` AND r.status = $${idx++}`;
      params.push(status);
    }
    if (q) {
      sql += ` AND (LOWER(r.visitor_name) LIKE $${idx} OR LOWER(r.reason) LIKE $${idx} OR LOWER(d.label) LIKE $${idx} OR LOWER(d.display_name) LIKE $${idx})`;
      params.push(`%${q.toLowerCase()}%`);
      idx++;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const rings = await query(sql, params);
    const total = (await queryOne<{ count: string }>('SELECT count(*) FROM rings'))?.count ?? '0';

    return NextResponse.json({ rings, total: parseInt(total, 10) });
  } catch (err: any) {
    return NextResponse.json({ error: 'rings_fetch_error', message: err.message }, { status: 500 });
  }
}
