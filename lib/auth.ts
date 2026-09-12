import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'tk_admin_session';

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || process.env.TAPKNOCK_SECRET || 'tapknock-admin-secret-key-2026';
}

export function createAdminToken(): string {
  const secret = getAdminSecret();
  const timestamp = Date.now();
  const payload = `admin:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, hmac] = parts;
    const secret = getAdminSecret();
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (hmac !== expected) return false;

    const [user, tsStr] = payload.split(':');
    if (user !== 'admin') return false;

    const ts = parseInt(tsStr, 10);
    // Token valid for 7 days
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - ts > maxAge) return false;

    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(session);
}

export function checkAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminSecret = getAdminSecret();
  // Allow either password or secret
  return password === adminPassword || password === adminSecret;
}
