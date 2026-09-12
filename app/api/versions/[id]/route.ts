import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getPool();
  try {
    const { id } = params;
    const body = await req.json();

    const allowed = [
      'version_name',
      'version_code',
      'platform',
      'release_type',
      'download_url',
      'title',
      'release_notes',
      'is_mandatory',
      'min_supported_version_code',
      'is_active',
    ];

    const fieldsToUpdate: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of Object.keys(body)) {
      if (allowed.includes(key)) {
        fieldsToUpdate.push(`${key} = $${idx}`);
        if (key === 'is_mandatory' || key === 'is_active') {
          values.push(body[key] ? 1 : 0);
        } else if (key === 'version_code' || key === 'min_supported_version_code') {
          values.push(parseInt(body[key], 10) || 0);
        } else {
          values.push(body[key]);
        }
        idx++;
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    // If activating, demote other active releases
    if (body.is_active) {
      const rel = await pool.query(`SELECT platform FROM app_releases WHERE id = $1`, [id]);
      if (rel.rows[0]) {
        await pool.query(
          `UPDATE app_releases SET is_active = 0 WHERE platform = $1 AND id != $2`,
          [rel.rows[0].platform, id]
        );
      }
    }

    values.push(id);
    const query = `
      UPDATE app_releases
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

    const res = await pool.query(query, values);
    if (!res.rows.length) {
      return NextResponse.json({ error: 'Release not found' }, { status: 400 });
    }

    // Audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, 'admin', 'UPDATE_APP_RELEASE', 'app_release', $2, $3, $4)`,
      [
        crypto.randomUUID(),
        id,
        JSON.stringify(body),
        new Date().toISOString(),
      ]
    );

    return NextResponse.json({ ok: true, release: res.rows[0] });
  } catch (err: any) {
    console.error('Failed to update release:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getPool();
  try {
    const { id } = params;
    const res = await pool.query(`DELETE FROM app_releases WHERE id = $1 RETURNING *`, [id]);
    if (!res.rows.length) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, 'admin', 'DELETE_APP_RELEASE', 'app_release', $2, $3, $4)`,
      [
        crypto.randomUUID(),
        id,
        JSON.stringify({ deleted: true, version: res.rows[0].version_name }),
        new Date().toISOString(),
      ]
    );

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error('Failed to delete release:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
