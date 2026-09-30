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

      CREATE TABLE IF NOT EXISTS admin_magic_links (
        token      TEXT PRIMARY KEY,
        email      TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at    TEXT
      );

      -- Set when the link was asked for by a device that cannot receive it:
      -- the app on a phone, when the mailbox is read on a laptop. The device
      -- holds the code and waits; whoever opens the link hands the session back
      -- through this row. Nothing else can read it, and it is read once.
      -- Set the moment a password is issued by somebody other than its owner:
      -- on invitation, and on a super admin's reset. Cleared only when they
      -- choose one themselves.
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

      ALTER TABLE admin_magic_links ADD COLUMN IF NOT EXISTS device_code TEXT;
      ALTER TABLE admin_magic_links ADD COLUMN IF NOT EXISTS session_token TEXT;
      CREATE INDEX IF NOT EXISTS idx_admin_magic_device ON admin_magic_links(device_code);

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
export async function createAdminMagicLink(
  email: string,
  deviceCode?: string | null
): Promise<string | null> {
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
    `INSERT INTO admin_magic_links (token, email, created_at, expires_at, device_code)
     VALUES ($1, $2, $3, $4, $5)`,
    [token, address, now.toISOString(),
     new Date(now.getTime() + MAGIC_LINK_TTL_MS).toISOString(), deviceCode || null]
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
 * Hands a session back to the device that asked for the link.
 *
 * Called when the link is spent, which may be on a different machine entirely —
 * the app is on a phone and the mailbox is read on a laptop, which is the whole
 * reason this exists.
 */
export async function attachDeviceSession(token: string, sessionToken: string): Promise<void> {
  await query('UPDATE admin_magic_links SET session_token = $1 WHERE token = $2', [sessionToken, token]);
}

/**
 * The waiting device asking whether its link has been used yet.
 *
 * Reads once: the session is cleared as it is handed over, so a device code
 * that leaks afterwards is worth nothing. Bounded by the link's own fifteen
 * minutes either way.
 */
export async function claimDeviceSession(
  deviceCode: string
): Promise<{ token: string; user: AdminUser } | null> {
  await ensureAdminTables();
  // `RETURNING` hands back the *new* row, so returning `session_token` from an
  // update that nulls it returns null — the claim would swallow the very
  // session it was fetching. Joining against the pre-update snapshot in `FROM`
  // is what makes the old value readable.
  const row = await queryOne<{ token: string; email: string; session_token: string }>(
    `UPDATE admin_magic_links AS m
        SET session_token = NULL
       FROM admin_magic_links AS prior
      WHERE prior.token = m.token
        AND m.device_code = $1
        AND m.session_token IS NOT NULL
        AND m.expires_at > $2
      RETURNING prior.token, prior.email, prior.session_token`,
    [deviceCode, new Date().toISOString()]
  );
  if (!row?.session_token) return null;

  const user = await queryOne<AdminUser>(
    "SELECT * FROM admin_users WHERE LOWER(email) = $1 AND status = 'active'",
    [row.email]
  );
  return user ? { token: row.session_token, user } : null;
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

/** Whether this link was asked for by a device that is waiting on it. */
export async function linkHasWaitingDevice(token: string): Promise<boolean> {
  const row = await queryOne<{ device_code: string | null }>(
    'SELECT device_code FROM admin_magic_links WHERE token = $1',
    [token]
  );
  return !!row?.device_code;
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
