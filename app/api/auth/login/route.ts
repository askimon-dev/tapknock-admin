import { NextRequest, NextResponse } from 'next/server';
import { authenticateStaff, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { getDefaultLandingPage } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * Email and password, and nothing else.
 *
 * There is no master password, no sign-up and no forgotten-password path: the
 * console is invite only, and a lost password is reset by a super admin who
 * issues a new one. That is the whole recovery story, on purpose — the previous
 * version accepted a master password *as the identifier*, defaulting to
 * `admin123`.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await authenticateStaff(email, password, clientIp, userAgent);
    if ('error' in result) {
      return NextResponse.json({ error: 'auth_failed', message: result.error }, { status: result.status });
    }

    const { user, token, mustChangePassword } = result;
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
      // A password somebody else chose gets you in and no further. The client
      // is expected to make changing it the only thing available next.
      must_change_password: mustChangePassword,
      landing: mustChangePassword ? '/change-password' : getDefaultLandingPage(user.role),
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
  } catch (err: any) {
    return NextResponse.json({ error: 'server_error', message: err?.message ?? 'Sign-in failed' }, { status: 500 });
  }
}
