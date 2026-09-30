'use client';

import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import TapKnockLogo from '@/components/TapKnockLogo';

/**
 * Signing in to the admin panel.
 *
 * An address and nothing else, the same way the resident app does it. There is
 * deliberately no password field, no master secret tab, and no list of accounts
 * to tap: the page used to ship six of them with their passwords written on it,
 * prefilled, in an APK that goes to testers.
 *
 * The link that arrives is single use and lasts fifteen minutes, and pressing
 * the button on the page it opens is what signs you in — mail providers follow
 * links before anybody reads them, and both admin addresses are on the provider
 * that already ate one of these on the resident side.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /// Not invited is a different answer from "something went wrong", and is
  /// shown as one — it is the only error here a person can actually act on.
  const [notInvited, setNotInvited] = useState(false);

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotInvited(false);

    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.status === 403 || data.error === 'not_invited') {
        setNotInvited(true);
        return;
      }
      if (!res.ok) throw new Error(data.message || 'Could not send a sign-in link.');
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send a sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-darkest flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-7">
            <div className="flex justify-center mb-3">
              <TapKnockLogo size={60} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              TapKnock{' '}
              <span className="text-xs uppercase tracking-widest bg-brand-500/20 text-brand-400 px-2.5 py-0.5 rounded font-semibold border border-brand-500/30">
                Console
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">Staff access by email</p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-white mb-2">Check your email</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                A sign-in link is on its way to <span className="text-slate-200">{email.trim()}</span>.
                It works once and expires in 15 minutes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
                className="mt-6 text-xs font-semibold text-brand-400 hover:text-brand-300"
              >
                Use a different address
              </button>
            </div>
          ) : (
            <form onSubmit={requestLink} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Work email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@generalquery.xyz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {notInvited && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-red-300 mb-1">
                    This address has no access
                  </p>
                  <p className="text-xs text-red-200/80 leading-relaxed">
                    The TapKnock console is invite only. A super admin has to add{' '}
                    <span className="font-medium">{email.trim()}</span> to the team before it can
                    sign in. Nothing has been sent.
                  </p>
                </div>
              )}

              {error && !notInvited && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
              >
                {loading ? 'Sending…' : 'Email me a sign-in link'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-4">
          Access is by invitation. Ask a super admin to add your address.
        </p>
      </div>
    </main>
  );
}
