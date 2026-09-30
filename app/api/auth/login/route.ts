import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * There are no admin passwords any more.
 *
 * This route used to accept an email and password, and would also accept the
 * master password *as the identifier* with no password at all — which, with a
 * default of `admin123`, meant anybody who read the login screen was a super
 * admin. The login screen listed six accounts and their passwords, and shipped
 * in an APK.
 *
 * Kept as an explicit, honest 410 rather than deleted, so an older admin build
 * gets told what happened instead of a bare 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'password_login_removed',
      message:
        'Password sign-in has been removed. The console is invite only and signs in by '
        + 'emailed link — update the admin app, or use the web console.',
    },
    { status: 410 }
  );
}
