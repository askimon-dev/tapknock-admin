import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, setOwnPassword, verifyPassword, ADMIN_COOKIE_NAME, createSessionToken } from '@/lib/auth';
import { getDefaultLandingPage } from '@/lib/rbac';
import { queryOne, query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/** Long enough to be worth typing, short enough that somebody will. */
const MIN_LENGTH = 10;

/**
 * Choosing your own password.
 *
 * Requires the current one, even when the session is already valid: a session
 * left open on somebody else's screen should not be enough to lock its owner
 * out of their own account.
 */
export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { current_password: currentPassword, new_password: newPassword } = await req.json();

  if (!newPassword || newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: 'too_short', message: `Use at least ${MIN_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'unchanged', message: 'That is the password you were sent. Choose a different one.' },
      { status: 400 }
    );
  }

  const user = await queryOne<{
    id: string; email: string; name: string; role: string;
    password_hash: string; salt: string;
  }>('SELECT * FROM admin_users WHERE id = $1', [session.userId]);

  if (!user || !verifyPassword(currentPassword || '', user.password_hash, user.salt)) {
    return NextResponse.json(
      { error: 'wrong_password', message: 'That current password is not right.' },
      { status: 403 }
    );
  }

  await setOwnPassword(user.id, newPassword);

  try {
    await query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, $2, 'auth.password_changed', 'admin_user', $3, $4, $5)`,
      [crypto.randomUUID(), user.email, user.id, JSON.stringify({ self: true }), new Date().toISOString()]
    );
  } catch { /* bookkeeping only */ }

  // A fresh token, so nothing is still carrying the old state.
  const token = createSessionToken(user as any, null, false);
  const response = NextResponse.json({
    ok: true,
    landing: getDefaultLandingPage(user.role as any),
  });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
