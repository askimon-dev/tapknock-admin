import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequiredPermissionForPath, hasPermission, AdminRole, Permission, getDefaultLandingPage } from '@/lib/rbac';

export const ADMIN_COOKIE_NAME = 'tk_admin_session';

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || process.env.TAPKNOCK_SECRET || 'tapknock-admin-secret-key-2026';
}

function decodePayload(token: string): any {
  try {
    if (token.startsWith('admin:')) {
      return {
        role: 'super_admin',
        activeRole: 'super_admin',
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
    }
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyToken(token: string, secretStr: string): Promise<boolean> {
  try {
    if (token.startsWith('admin:')) {
      // Legacy token check
      const parts = token.split('.');
      return parts.length === 2;
    }
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, payload, signature] = parts;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretStr),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const binarySig = atob(signature.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }
    const dataBytes = encoder.encode(`${header}.${payload}`);
    return await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authHeader = request.headers.get('authorization') || request.headers.get('x-admin-token');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader?.trim();
  const sessionToken = tokenFromHeader || request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const secret = getAdminSecret();

  // Determine if valid session exists
  let isValid = false;
  let sessionPayload: any = null;

  if (sessionToken) {
    isValid = await verifyToken(sessionToken, secret);
    if (isValid) {
      sessionPayload = decodePayload(sessionToken);
      if (sessionPayload?.exp && sessionPayload.exp * 1000 < Date.now()) {
        isValid = false;
        sessionPayload = null;
      }
    }
  }

  // If already authenticated and visiting login, redirect to permitted landing page
  if (pathname === '/login') {
    if (isValid && sessionPayload) {
      const activeRole = (sessionPayload.activeRole || sessionPayload.role || 'super_admin') as AdminRole;
      const landing = getDefaultLandingPage(activeRole);
      return NextResponse.redirect(new URL(landing, request.url));
    }
    return NextResponse.next();
  }

  // Public / auth endpoints
  if (pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Protect API routes
  if (pathname.startsWith('/api')) {
    if (!isValid || !sessionPayload) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const activeRole = (sessionPayload.activeRole || sessionPayload.role || 'super_admin') as AdminRole;
    const method = request.method.toUpperCase();

    // Check specific API authorization
    // Database queries
    if (pathname.startsWith('/api/database/query') && !hasPermission(activeRole, 'database:execute')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Database SQL execution requires developer or super_admin role' },
        { status: 403 }
      );
    }
    if (pathname.startsWith('/api/database') && !hasPermission(activeRole, 'database:view')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Database inspection requires database:view permission' },
        { status: 403 }
      );
    }

    // Server logs
    if (pathname.startsWith('/api/logs') && !hasPermission(activeRole, 'logs:view')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Viewing server logs requires developer or super_admin role' },
        { status: 403 }
      );
    }

    // Staging management
    if (pathname.startsWith('/api/staging') && !hasPermission(activeRole, 'staging:manage')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Staging environment control requires developer or super_admin role' },
        { status: 403 }
      );
    }

    // Push notification dispatch
    if (pathname.startsWith('/api/notifications') && method === 'POST' && !hasPermission(activeRole, 'notifications:dispatch')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Push notification broadcast requires marketing or admin role' },
        { status: 403 }
      );
    }

    // App Releases management
    if (pathname.startsWith('/api/versions') && method !== 'GET' && !hasPermission(activeRole, 'versions:manage')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Publishing app releases requires versions:manage permission' },
        { status: 403 }
      );
    }

    // Staff management
    if (pathname.startsWith('/api/staff') && method !== 'GET' && !hasPermission(activeRole, 'staff:manage')) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Staff management requires super_admin role' },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // Protect Dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!isValid || !sessionPayload) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Allow access denied page unconditionally
    if (pathname === '/dashboard/forbidden') {
      return NextResponse.next();
    }

    const activeRole = (sessionPayload.activeRole || sessionPayload.role || 'super_admin') as AdminRole;

    // If visiting root /dashboard and user is support_executive without analytics:view, redirect to their home
    if (pathname === '/dashboard' && !hasPermission(activeRole, 'analytics:view')) {
      return NextResponse.redirect(new URL('/dashboard/support', request.url));
    }

    // Check path permissions
    const requiredPermission = getRequiredPermissionForPath(pathname);
    if (requiredPermission && !hasPermission(activeRole, requiredPermission)) {
      const forbiddenUrl = new URL('/dashboard/forbidden', request.url);
      forbiddenUrl.searchParams.set('required', requiredPermission);
      forbiddenUrl.searchParams.set('path', pathname);
      forbiddenUrl.searchParams.set('role', activeRole);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
};
