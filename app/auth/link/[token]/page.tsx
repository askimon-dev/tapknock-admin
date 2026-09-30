import { peekAdminMagicLink } from '@/lib/auth';
import ConfirmSignIn from './confirm';

export const dynamic = 'force-dynamic';

/**
 * The page a sign-in link opens, which deliberately does not sign anybody in.
 *
 * It only asks whether the link is still good. Spending it happens when the
 * person presses the button, because mail providers follow links before anyone
 * reads them and both admin addresses are on Zoho — the provider that ate one
 * of these on the resident side seven seconds after it was sent.
 */
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await peekAdminMagicLink(token);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-darkest px-6">
      <div className="w-full max-w-sm text-center">
        {valid ? (
          <ConfirmSignIn token={token} />
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white mb-2">This link has expired</h1>
            <p className="text-sm text-slate-400 mb-6">
              Sign in links work once, and for 15 minutes. Ask for a new one.
            </p>
            <a
              href="/login"
              className="inline-block px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold"
            >
              Back to sign in
            </a>
          </>
        )}
      </div>
    </main>
  );
}
