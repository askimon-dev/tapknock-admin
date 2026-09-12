import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sendInternalPush } from '@/lib/tapknock-api';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getPool();
  try {
    const { id } = params;
    const res = await pool.query(`SELECT * FROM app_releases WHERE id = $1`, [id]);
    if (!res.rows.length) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const release = res.rows[0];
    const notifTitle = release.title || `TapKnock v${release.version_name} Update`;
    const notifBody = `TapKnock v${release.version_name} is available. Tap to download and install.`;

    const pushResult = await sendInternalPush({
      title: notifTitle,
      body: notifBody,
      target: 'all',
      priority: release.is_mandatory ? 'high' : 'normal',
      category: 'update',
      action_url: release.download_url,
      created_by: 'admin',
    });

    // Audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, 'admin', 'RESEND_RELEASE_NOTIFICATION', 'app_release', $2, $3, $4)`,
      [
        crypto.randomUUID(),
        id,
        JSON.stringify({ version: release.version_name, pushResult }),
        new Date().toISOString(),
      ]
    );

    return NextResponse.json({
      ok: true,
      message: 'Update notification broadcasted to all users',
      push_result: pushResult,
    });
  } catch (err: any) {
    console.error('Failed to notify release:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
