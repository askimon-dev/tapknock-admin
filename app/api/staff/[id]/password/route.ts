import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { query, queryOne } from '@/lib/db';
import { getCurrentSession, hashPassword } from '@/lib/auth';
import { hasPermission, canManageRole } from '@/lib/rbac';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const target = await queryOne('SELECT * FROM admin_users WHERE id = $1', [params.id]);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    // Must be managing staff or changing own password
    const isSelf = session.userId === target.id;
    if (!isSelf && !hasPermission(session.activeRole, 'staff:manage')) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    if (!isSelf && !canManageRole(session.role, target.role)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: `Cannot reset password for role ${target.role}` },
        { status: 403 }
      );
    }

    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'invalid_password', message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const { hash, salt } = hashPassword(newPassword);
    const now = new Date().toISOString();

    await query(`
      UPDATE admin_users SET password_hash = $1, salt = $2, updated_at = $3 WHERE id = $4
    `, [hash, salt, now, target.id]);

    // Also terminate all existing sessions for this user so they must log in with new password
    await query('DELETE FROM admin_sessions WHERE user_id = $1', [target.id]);

    await query(
      'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        crypto.randomUUID(),
        session.email,
        'staff.password_reset',
        'admin_user',
        target.id,
        JSON.stringify({ isSelf, email: target.email }),
        now,
      ]
    );

    return NextResponse.json({ ok: true, message: 'Password reset successfully' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
