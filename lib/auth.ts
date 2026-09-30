import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { query, queryOne } from '@/lib/db';
import { AdminRole, Permission, getRolePermissions, hasPermission, ROLE_DEFINITIONS } from '@/lib/rbac';

export const ADMIN_COOKIE_NAME = 'tk_admin_session';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  password_hash: string;
  salt: string;
  avatar_url?: string | null;
  phone?: string | null;
  status: 'active' | 'suspended' | 'invited';
  last_login_at?: string | null;
  last_login_ip?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  activeRole: AdminRole;
  isPreview: boolean;
  permissions: Permission[];
  iat: number;
  exp: number;
}

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || process.env.TAPKNOCK_SECRET || 'tapknock-admin-secret-key-2026';
}

/**
 * Hash password with PBKDF2 (100,000 rounds of sha512)
 */
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Create tamper-proof HMAC signed session token
 */
export function createSessionToken(
  user: { id: string; email: string; name: string; role: AdminRole },
  previewRole?: AdminRole | null
): string {
  const secret = getAdminSecret();
  const activeRole = previewRole || user.role;
  const permissions = getRolePermissions(activeRole);
  const now = Date.now();
  const exp = now + 7 * 24 * 60 * 60 * 1000; // 7 days

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      activeRole,
      isPreview: !!previewRole && previewRole !== user.role,
      permissions,
      iat: Math.floor(now / 1000),
      exp: Math.floor(exp / 1000),
    })
  );

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verify and decode HMAC signed session token
 */
export function verifySessionToken(token: string | undefined | null): AuthSession | null {
  if (!token) return null;
  try {
    // Support legacy admin tokens "admin:1234567.hmac" for smooth backwards-compatibility
    if (token.startsWith('admin:')) {
      const parts = token.split('.');
      if (parts.length === 2) {
        const [payload, hmac] = parts;
        const secret = getAdminSecret();
        const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        if (hmac === expected) {
          const [, tsStr] = payload.split(':');
          const ts = parseInt(tsStr, 10);
          if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
            return {
              userId: 'system-root-admin',
              email: 'admin@tapknock.com',
              name: 'System Root Admin',
              role: 'super_admin',
              activeRole: 'super_admin',
              isPreview: false,
              permissions: getRolePermissions('super_admin'),
              iat: Math.floor(ts / 1000),
              exp: Math.floor((ts + 7 * 24 * 60 * 60 * 1000) / 1000),
            };
          }
        }
      }
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const secret = getAdminSecret();
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expected) return null;

    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null; // Expired
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      activeRole: decoded.activeRole || decoded.role,
      isPreview: !!decoded.isPreview,
      permissions: decoded.permissions || getRolePermissions(decoded.activeRole || decoded.role),
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Initialize admin database tables if they do not already exist, and seed default roles
 */
let _tablesEnsured = false;
export async function ensureAdminTables() {
  if (_tablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        name          TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'support_executive',
        password_hash TEXT NOT NULL,
        salt          TEXT NOT NULL,
        avatar_url    TEXT,
        phone         TEXT,
        status        TEXT NOT NULL DEFAULT 'active',
        last_login_at TEXT,
        last_login_ip TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        created_by    TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token         TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        role          TEXT NOT NULL,
        ip_address    TEXT,
        user_agent    TEXT,
        created_at    TEXT NOT NULL,
        expires_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_magic_links (
        token      TEXT PRIMARY KEY,
        email      TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at    TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_admin_magic_email ON admin_magic_links(email);
      CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
      CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
    `);

    // Deliberately no seeding.
    //
    // This inserted six demo accounts whenever the table was empty, with their
    // passwords in the source, so deleting them simply brought them back. The
    // console is invite only: a super admin adds an address and that address
    // gets a link. An empty table meaning nobody can sign in is correct.

    _tablesEnsured = true;
  } catch (err) {
    console.error('[Admin Auth] Error ensuring admin tables:', err);
  }
}

// --------------------------------------------------------- sign-in links

/** Long enough to read an email, short enough that a leaked one is stale. */
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/**
 * Mints a single-use sign-in link for a member of staff.
 *
 * Returns null when the address is not active staff. The console is invite
 * only, and the caller says so in as many words rather than leaving somebody
 * waiting for mail that is never coming.
 */
export async function createAdminMagicLink(email: string): Promise<string | null> {
  await ensureAdminTables();
  const address = (email || '').trim().toLowerCase();

  const user = await queryOne<AdminUser>(
    "SELECT * FROM admin_users WHERE LOWER(email) = $1 AND status = 'active'",
    [address]
  );
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await query(
    'INSERT INTO admin_magic_links (token, email, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [token, address, now.toISOString(), new Date(now.getTime() + MAGIC_LINK_TTL_MS).toISOString()]
  );
  return token;
}

/** Is this link still good? Asks without spending it. */
export async function peekAdminMagicLink(token: string): Promise<boolean> {
  await ensureAdminTables();
  const row = await queryOne<{ token: string }>(
    'SELECT token FROM admin_magic_links WHERE token = $1 AND used_at IS NULL AND expires_at > $2',
    [token, new Date().toISOString()]
  );
  return !!row;
}

/**
 * Spends the link and returns whose it was.
 *
 * The update is what claims it, conditional on the link still being unused — so
 * two requests racing for one token cannot both win, however they interleave.
 */
export async function consumeAdminMagicLink(token: string): Promise<AdminUser | null> {
  await ensureAdminTables();
  const claimed = await queryOne<{ email: string }>(
    `UPDATE admin_magic_links SET used_at = $1
      WHERE token = $2 AND used_at IS NULL AND expires_at > $1
      RETURNING email`,
    [new Date().toISOString(), token]
  );
  if (!claimed) return null;

  return queryOne<AdminUser>(
    "SELECT * FROM admin_users WHERE LOWER(email) = $1 AND status = 'active'",
    [claimed.email]
  );
}

// Password sign-in used to live here, and it also accepted the master password
// *as the identifier* with no password at all. With a default of `admin123`,
// anybody who read the login screen was a super admin — and that screen listed
// six accounts with their passwords, in an APK that goes to testers.
//
// The console is invite only now and signs in by emailed link: see
// createAdminMagicLink / consumeAdminMagicLink.

/**
 * Read current session from cookies in Server Components or API routes
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const headerStore = headers();
    const authHeader = headerStore.get('authorization') || headerStore.get('x-admin-token');
    if (authHeader) {
      const rawToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
      const verified = verifySessionToken(rawToken);
      if (verified) return verified;
    }
  } catch {}

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Check if current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return !!session;
}

/**
 * Require a specific permission, returning error response if unauthorized
 */
export async function requirePermission(permission: Permission): Promise<AuthSession | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (!hasPermission(session.activeRole, permission)) {
    return null;
  }
  return session;
}
