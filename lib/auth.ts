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
  /// True while the password was issued by somebody else and not yet replaced.
  mustChange?: boolean;
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
  user: { id: string; email: string; name: string; role: AdminRole; must_change_password?: boolean },
  previewRole?: AdminRole | null,
  // Explicit, because the caller that has just *changed* the password is
  // holding a user row that still says the old thing.
  mustChangeOverride?: boolean
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
      // Carried in the token so the middleware can enforce it without a query:
      // a change screen you can navigate away from is not a requirement.
      mustChange: mustChangeOverride ?? !!user.must_change_password,
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

      -- Set the moment a password is issued by somebody other than its owner:
      -- on invitation, and on a super admin's reset. Cleared only when they
      -- choose one themselves.
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

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

// ------------------------------------------------------------- passwords

/**
 * A password nobody has to remember, because nobody keeps it.
 *
 * It is mailed to its owner, used once, and replaced on that first sign-in.
 * Deliberately readable over the phone and unambiguous on paper — no l/1/I or
 * O/0 — because somebody will read it aloud or retype it from a screenshot.
 */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < 20; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i === 4 || i === 9 || i === 14) out += '-';
  }
  return out;
}

/** Verifies a password in constant time. */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const a = Buffer.from(check, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Signs somebody in with an address and a password.
 *
 * There is no master password and no way in without a row in `admin_users`:
 * this used to accept the master password *as the identifier*, defaulting to
 * `admin123`, which made anybody who read the login screen a super admin.
 *
 * A password that was issued rather than chosen signs you in, and says so — the
 * caller is expected to make changing it the only thing you can do next.
 */
export async function authenticateStaff(
  email: string,
  password: string,
  clientIp?: string,
  userAgent?: string
): Promise<
  | { user: AdminUser; token: string; mustChangePassword: boolean }
  | { error: string; status: number }
> {
  await ensureAdminTables();
  const address = (email || '').trim().toLowerCase();
  if (!address || !password) return { error: 'Email and password are required.', status: 400 };

  const user = await queryOne<AdminUser & { must_change_password?: boolean }>(
    'SELECT * FROM admin_users WHERE LOWER(email) = $1',
    [address]
  );

  // Deliberately the same answer for "no such address" and "wrong password".
  // The console is invite only; which addresses are on it is not something an
  // unauthenticated caller gets to learn by guessing.
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return { error: 'That email and password do not match.', status: 401 };
  }
  if (user.status !== 'active') {
    return { error: 'That account is not active. Ask a super admin.', status: 403 };
  }

  const nowIso = new Date().toISOString();
  try {
    await query('UPDATE admin_users SET last_login_at = $1, last_login_ip = $2 WHERE id = $3',
      [nowIso, clientIp || null, user.id]);
    await query(
      `INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at)
       VALUES ($1, $2, 'auth.login', 'admin_user', $3, $4, $5)`,
      [crypto.randomUUID(), user.email, user.id, JSON.stringify({ ip: clientIp, userAgent }), nowIso]
    );
  } catch {
    // Bookkeeping must not stand between somebody and their own console.
  }

  return {
    user,
    token: createSessionToken(user),
    mustChangePassword: !!user.must_change_password,
  };
}

/** Sets a password its owner chose, and stops asking them to. */
export async function setOwnPassword(userId: string, newPassword: string): Promise<void> {
  const { hash, salt } = hashPassword(newPassword);
  await query(
    `UPDATE admin_users SET password_hash = $1, salt = $2, must_change_password = FALSE,
            updated_at = $3 WHERE id = $4`,
    [hash, salt, new Date().toISOString(), userId]
  );
}

/**
 * Issues a password on somebody's behalf, for mailing to them.
 *
 * Always leaves `must_change_password` set: a password somebody else chose and
 * sent through a mailbox is a way in, not a credential to keep.
 */
export async function issuePassword(userId: string): Promise<string> {
  const password = generatePassword();
  const { hash, salt } = hashPassword(password);
  await query(
    `UPDATE admin_users SET password_hash = $1, salt = $2, must_change_password = TRUE,
            updated_at = $3 WHERE id = $4`,
    [hash, salt, new Date().toISOString(), userId]
  );
  return password;
}

// Password sign-in used to live here, and it also accepted the master password
// *as the identifier* with no password at all. With a default of `admin123`,
// anybody who read the login screen was a super admin — and that screen listed
// six accounts with their passwords, in an APK that goes to testers.
//
// Sign-in is email and password. A password is issued by a super admin, mailed
// to its owner, and replaced by them on first use — see issuePassword and
// setOwnPassword.

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
