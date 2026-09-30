import { NextRequest, NextResponse } from 'next/server';
import { consumeAdminMagicLink, createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { getDefaultLandingPage } from '@/lib/rbac';
import { query } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Pressing the button is the sign-in. Opening the link is not.
 *
 * Mail providers follow links before a person ever sees them — Zoho ate one of
 * the resident-side links 7.1 seconds after it was sent — and both admin
 * addresses are on Zoho. So the actual sign-in lives behind a POST, which
 * scanners do not make.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const user = await consumeAdminMagicLink(token);
  if (!user) {
    return NextResponse.json(
      { error: 'link_expired', message: 'Sign in links work once, and for 15 minutes.' },
      { status: 410 }
    );
  }

  const sessionToken = createSessionToken(user);
  const nowIso = new Date().toISOString();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;

  try {
    await query(
      'UPDATE admin_users SET last_login_at = $1, last_login_ip = $2 WHERE id = $3',
      [nowIso, ip, user.id]
    );
    await query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, $2, 'auth.login_link', 'admin_user', $3, $4, $5)`,
      [crypto.randomUUID(), user.email, user.id,
       JSON.stringify({ ip, userAgent: req.headers.get('user-agent') }), nowIso]
    );
  } catch {
    // Bookkeeping must not stand between somebody and their own panel.
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token: sessionToken,
    landing: getDefaultLandingPage(user.role),
  });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
