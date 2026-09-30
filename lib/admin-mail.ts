import { TAPKNOCK_API_BASE, ADMIN_SECRET } from './tapknock-api';

/**
 * Sends an issued password to its owner.
 *
 * The console decides who gets one and what it is; the API owns the mail
 * credentials, so it does the sending. Returns whether it went — a password
 * that was set but never delivered is worse than one that was never set, and
 * the caller needs to be able to say so.
 */
export async function mailAdminPassword(opts: {
  email: string;
  password: string;
  issuedBy: string;
  isReset?: boolean;
  origin: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/auth/send-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({
        email: opts.email,
        password: opts.password,
        url: `${opts.origin}/login`,
        issued_by: opts.issuedBy,
        is_reset: !!opts.isReset,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
