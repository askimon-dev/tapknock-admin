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

export function getMasterPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

/**
 * Hash password with PBKDF2 (100,000 rounds of sha512)
 */
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Constant-time password verification
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const bufA = Buffer.from(hash, 'hex');
    const bufB = Buffer.from(check, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
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

      CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
      CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
    `);

    // Check if any admin users exist
    const countRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM admin_users');
    const count = parseInt(countRes[0]?.count || '0', 10);

    if (count === 0) {
      const now = new Date().toISOString();
      const masterPass = getMasterPassword();
      const defaultAdmin = hashPassword(masterPass);
      const leadPass = hashPassword('lead123');
      const supportPass = hashPassword('support123');
      const marketingPass = hashPassword('market123');
      const devPass = hashPassword('dev123');
      const analystPass = hashPassword('analyst123');

      await query(`
        INSERT INTO admin_users (id, email, name, role, password_hash, salt, status, created_at, updated_at)
        VALUES
          ('usr_super_admin', 'admin@tapknock.com', 'System Administrator', 'super_admin', $1, $2, 'active', $3, $3),
          ('usr_support_lead', 'support.lead@tapknock.com', 'Sarah Jenkins', 'support_lead', $4, $5, 'active', $3, $3),
          ('usr_support_exec', 'support@tapknock.com', 'Alex Rivera', 'support_executive', $6, $7, 'active', $3, $3),
          ('usr_marketing', 'marketing@tapknock.com', 'Elena Rostova', 'marketing', $8, $9, 'active', $3, $3),
          ('usr_developer', 'devops@tapknock.com', 'David Chen', 'developer', $10, $11, 'active', $3, $3),
          ('usr_analyst', 'analyst@tapknock.com', 'Priya Patel', 'analyst', $12, $13, 'active', $3, $3)
        ON CONFLICT (email) DO NOTHING
      `, [
        defaultAdmin.hash, defaultAdmin.salt, now,
        leadPass.hash, leadPass.salt,
        supportPass.hash, supportPass.salt,
        marketingPass.hash, marketingPass.salt,
        devPass.hash, devPass.salt,
        analystPass.hash, analystPass.salt,
      ]);
      console.log('[Admin Auth] Initialized admin_users with default team accounts.');
    }

    _tablesEnsured = true;
  } catch (err) {
    console.error('[Admin Auth] Error ensuring admin tables:', err);
  }
}

/**
 * Authenticate by either staff email+password or master secret/password
 */
export async function authenticateStaff(
  identifier: string,
  password?: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ user: AdminUser; token: string } | { error: string; status: number }> {
  await ensureAdminTables();

  const cleanId = (identifier || '').trim().toLowerCase();
  const masterPassword = getMasterPassword();
  const masterSecret = getAdminSecret();

  // 1. Check if user entered master password / master secret directly
  if (
    cleanId === masterPassword ||
    cleanId === masterSecret ||
    ((cleanId === 'admin' || cleanId === 'admin@tapknock.com') && (password === masterPassword || password === masterSecret))
  ) {
    // Check if there is an admin@tapknock.com in the DB
    let rootUser = await queryOne<AdminUser>('SELECT * FROM admin_users WHERE email = $1', ['admin@tapknock.com']);
    if (!rootUser) {
      // Fallback virtual root user
      rootUser = {
        id: 'system-root-admin',
        email: 'admin@tapknock.com',
        name: 'System Root Admin',
        role: 'super_admin',
        password_hash: '',
        salt: '',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const token = createSessionToken(rootUser);
    try {
      await query(
        'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          crypto.randomUUID(),
          rootUser.email,
          'auth.login_master',
          'admin_user',
          rootUser.id,
          JSON.stringify({ ip: clientIp, userAgent }),
          new Date().toISOString(),
        ]
      );
    } catch {}

    return { user: rootUser, token };
  }

  // 2. Lookup user in admin_users by email
  if (!password) {
    return { error: 'Password is required', status: 400 };
  }

  const user = await queryOne<AdminUser>(
    'SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)',
    [cleanId]
  );

  if (!user) {
    return { error: 'Invalid email or password', status: 401 };
  }

  if (user.status === 'suspended') {
    return { error: 'Account has been suspended. Please contact your system administrator.', status: 403 };
  }

  if (user.status === 'inactive') {
    return { error: 'Account is inactive. Please contact your administrator to activate your access.', status: 403 };
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    return { error: 'Invalid email or password', status: 401 };
  }

  // Update last login
  const now = new Date().toISOString();
  try {
    await query(
      'UPDATE admin_users SET last_login_at = $1, last_login_ip = $2, updated_at = $1 WHERE id = $3',
      [now, clientIp || null, user.id]
    );

    await query(
      'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        crypto.randomUUID(),
        user.email,
        'auth.login_success',
        'admin_user',
        user.id,
        JSON.stringify({ role: user.role, ip: clientIp, userAgent }),
        now,
      ]
    );
  } catch {}

  const token = createSessionToken(user);
  return { user, token };
}

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
