import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sendInternalPush } from '@/lib/tapknock-api';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getPool();
  try {
    const res = await pool.query(
      `SELECT * FROM app_releases ORDER BY version_code DESC`
    );
    return NextResponse.json({ releases: res.rows });
  } catch (err: any) {
    console.error('Failed to fetch app releases:', err);
    return NextResponse.json({ error: err.message, releases: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const pool = getPool();
  try {
    const body = await req.json();
    const {
      version_name,
      version_code,
      platform = 'android',
      release_type = 'drive',
      download_url,
      title,
      release_notes = '',
      is_mandatory = false,
      min_supported_version_code = 0,
      is_active = 1,
      notify_users = true,
      custom_notification_body,
    } = body;

    if (!version_name || !download_url || !title) {
      return NextResponse.json(
        { error: 'version_name, download_url, and title are required' },
        { status: 400 }
      );
    }

    const code = parseInt(version_code, 10) || 2013;
    const releaseId = `rel-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();

    // If marked active, demote previous active releases for the same platform
    if (is_active) {
      await pool.query(
        `UPDATE app_releases SET is_active = 0 WHERE platform = $1 OR platform = 'all'`,
        [platform]
      );
    }

    const insertQuery = `
      INSERT INTO app_releases (
        id, version_name, version_code, platform, release_type,
        download_url, title, release_notes, is_mandatory,
        min_supported_version_code, is_active, download_count,
        created_at, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13)
      RETURNING *
    `;

    const values = [
      releaseId,
      version_name.trim(),
      code,
      platform,
      release_type,
      download_url.trim(),
      title.trim(),
      release_notes.trim(),
      is_mandatory ? 1 : 0,
      parseInt(min_supported_version_code, 10) || 0,
      is_active ? 1 : 0,
      nowIso,
      nowIso,
    ];

    const result = await pool.query(insertQuery, values);
    const release = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, 'admin', 'CREATE_APP_RELEASE', 'app_release', $2, $3, $4)`,
      [
        crypto.randomUUID(),
        releaseId,
        JSON.stringify({ version_name, version_code: code, platform, release_type, download_url }),
        nowIso,
      ]
    );

    // Notify all users immediately if enabled
    let pushResult = null;
    if (notify_users) {
      const notifTitle = title || `TapKnock v${version_name} Released!`;
      const notifBody = custom_notification_body ||
        `TapKnock v${version_name} is now available with updates. Tap to download and install.`;

      pushResult = await sendInternalPush({
        title: notifTitle,
        body: notifBody,
        target: 'all',
        priority: is_mandatory ? 'high' : 'normal',
        category: 'update',
        action_url: download_url.trim(),
        version_name: version_name.trim(),
        version_code: code,
        created_by: 'admin',
      });
    }

    return NextResponse.json({
      ok: true,
      release,
      push_notified: notify_users,
      push_result: pushResult,
    });
  } catch (err: any) {
    console.error('Failed to create app release:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
