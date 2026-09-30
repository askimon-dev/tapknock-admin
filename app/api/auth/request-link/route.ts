import { NextRequest, NextResponse } from 'next/server';
import { createAdminMagicLink } from '@/lib/auth';
import { TAPKNOCK_API_BASE, ADMIN_SECRET } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

/**
 * Asks for a sign-in link.
 *
 * The panel is invite only and says so plainly: an address that has not been
 * added by a super admin is turned away in as many words, rather than left
 * waiting for an email that is never coming.
 *
 * That is a deliberate trade. Answering differently for staff and non-staff
 * lets anybody who can reach this page test whether an address is on the team.
 * With a team of two who know each other, being told clearly why you cannot get
 * in is worth more than hiding a guest list that is not a secret.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const address = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      return NextResponse.json(
        { error: 'invalid_email', message: 'That does not look like an email address.' },
        { status: 400 }
      );
    }

    const token = await createAdminMagicLink(address);
    if (!token) {
      return NextResponse.json(
        {
          error: 'not_invited',
          message:
            'That address has no access to the TapKnock admin console. '
            + 'Access is invite only — a super admin has to add you before you can sign in.',
        },
        { status: 403 }
      );
    }

    // The link points back at whatever host the request arrived on, so this
    // works on the live panel and on a laptop without being told which it is.
    const origin = req.headers.get('origin')
      || `https://${req.headers.get('host') ?? 'admin.tapknock.generalquery.xyz'}`;

    const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/auth/send-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({ email: address, url: `${origin}/auth/link/${token}` }),
    });

    if (!res.ok) {
      // A mail failure is worth saying out loud: the alternative is somebody
      // waiting for a link that was never sent.
      return NextResponse.json(
        { error: 'mail_failed', message: 'We could not send the email. Try again in a moment.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'A sign-in link is on its way. It works once, and expires in 15 minutes.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Could not send a sign-in link.' },
      { status: 500 }
    );
  }
}
