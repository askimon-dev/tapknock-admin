import { NextResponse } from 'next/server';
import { claimDeviceSession } from '@/lib/auth';
import { getDefaultLandingPage } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * A waiting device asking whether its sign-in link has been used yet.
 *
 * The app is on a phone and the mailbox is often read on a laptop, so the link
 * cannot deliver the session to the thing that asked for it. The device holds a
 * code, waits here, and collects the session once somebody opens the link
 * wherever they happen to be.
 *
 * Read once — the session is cleared as it is handed over — and bounded by the
 * link's own fifteen minutes, so a code that leaks afterwards buys nothing.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!code || code.length < 32) {
    return NextResponse.json({ error: 'bad_code' }, { status: 400 });
  }

  const claimed = await claimDeviceSession(code);
  if (!claimed) {
    // Not an error: nobody has opened the link yet.
    return NextResponse.json({ pending: true }, { status: 202 });
  }

  const { token, user } = claimed;
  return NextResponse.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    landing: getDefaultLandingPage(user.role),
  });
}
