import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, issuePassword } from '@/lib/auth';
import { mailAdminPassword } from '@/lib/admin-mail';
import { queryOne, query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * A super admin issuing somebody a new password.
 *
 * This is the whole recovery story. There is no forgotten-password link,
 * because a console with one has a way in that depends on a mailbox nobody
 * here controls — and the people who use this one sit near each other.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Deliberately super admin only, not merely staff:manage. Issuing somebody
  // else's password is taking their account, and that is not an operations task.
  if (session.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only a super admin can reset a password.' },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;
  const user = await queryOne<{ id: string; email: string; name: string }>(
    'SELECT id, email, name FROM admin_users WHERE id = $1',
    [id]
  );
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const password = await issuePassword(user.id);

  const origin = req.headers.get('origin')
    || `https://${req.headers.get('host') ?? 'admin.tapknock.generalquery.xyz'}`;
  const mailed = await mailAdminPassword({
    email: user.email,
    password,
    issuedBy: session.email,
    isReset: true,
    origin,
  });

  try {
    await query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, $2, 'staff.password_reset', 'admin_user', $3, $4, $5)`,
      [crypto.randomUUID(), session.email, user.id,
       JSON.stringify({ target: user.email, mailed }), new Date().toISOString()]
    );
  } catch { /* bookkeeping only */ }

  return NextResponse.json({
    ok: true,
    password_mailed: mailed,
    message: mailed
      ? `A new password is on its way to ${user.email}.`
      : `The password was reset, but the email did not send. Try again.`,
  });
}
