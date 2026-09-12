import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE_NAME = 'tk_admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  const isAuth = !!sessionCookie;

  // Protect all /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!isAuth) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect admin API routes except login
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth/login')) {
    if (!isAuth) {
      return NextResponse.json({ error: 'unauthorized', message: 'Admin authentication required' }, { status: 401 });
    }
  }

  // If authenticated and visiting login, go to dashboard
  if (pathname === '/login' && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
};
