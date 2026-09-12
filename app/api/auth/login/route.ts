import { NextResponse } from 'next/server';
import { checkAdminPassword, createAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (!password || !checkAdminPassword(password)) {
      return NextResponse.json({ error: 'invalid_credentials', message: 'Invalid admin credentials' }, { status: 401 });
    }

    const token = createAdminToken();
    const response = NextResponse.json({ ok: true, message: 'Authenticated successfully' });

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
    return NextResponse.json({ error: 'server_error', message: err.message }, { status: 500 });
  }
}
