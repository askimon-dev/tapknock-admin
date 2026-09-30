'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmSignIn({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /// Set once signed in, so a phone can carry the session into the admin app
  /// rather than being stuck in a browser tab.
  const [appLink, setAppLink] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/link/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'That link could not be used.');
        setBusy(false);
        return;
      }
      // On a phone, offer to continue in the app. The token here is the session
      // the console just minted, so this is a delivery route rather than a
      // second credential.
      const user = encodeURIComponent(
        btoa(JSON.stringify(data.user)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      );
      const link = `tapknock-admin://auth?token=${encodeURIComponent(data.token)}&user=${user}`;

      if (/android|iphone|ipad/i.test(navigator.userAgent)) {
        setAppLink(link);
        setBusy(false);
        window.location.href = link;
        return;
      }

      router.replace(data.landing || '/dashboard');
    } catch {
      setError('Something went wrong. Try asking for a new link.');
      setBusy(false);
    }
  };

  if (appLink) {
    return (
      <>
        <h1 className="text-xl font-semibold text-white mb-2">You&apos;re signed in</h1>
        <p className="text-sm text-slate-400 mb-6">
          Opening the admin app. If nothing happened, tap below.
        </p>
        <a
          href={appLink}
          className="block w-full px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold"
        >
          Open the admin app
        </a>
        <button
          onClick={() => router.replace('/dashboard')}
          className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          Stay in the browser
        </button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-white mb-2">Sign in to the admin panel</h1>
      <p className="text-sm text-slate-400 mb-6">
        You asked for a link. Press the button to finish signing in on this device.
      </p>
      <button
        onClick={signIn}
        disabled={busy}
        className="w-full px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-60 text-white text-sm font-semibold"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
    </>
  );
}
