import { NextResponse } from 'next/server';
import { authenticateStaff, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { getDefaultLandingPage } from '@/lib/rbac';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = body.email || body.identifier || body.password;
    const password = body.password;

    if (!identifier) {
      return NextResponse.json({ error: 'invalid_request', message: 'Email or password is required' }, { status: 400 });
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    const result = await authenticateStaff(identifier, password, clientIp, userAgent);

    if ('error' in result) {
      return NextResponse.json({ error: 'auth_failed', message: result.error }, { status: result.status });
    }

    const { user, token } = result;
    const landing = getDefaultLandingPage(user.role);

    const response = NextResponse.json({
      ok: true,
      message: 'Authenticated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
      landing,
    });

    // Set HTTP-only secure cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'server_error', message: err.message || 'Internal server error' }, { status: 500 });
  }
}
