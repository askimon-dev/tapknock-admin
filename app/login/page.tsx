'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import TapKnockLogo from '@/components/TapKnockLogo';

/**
 * Signing in to the admin console.
 *
 * An address and a password, and nothing else on the page: no list of accounts
 * with their passwords written next to them, which is what this used to ship
 * with in an APK that goes to testers, and no master-secret tab.
 *
 * There is deliberately no sign-up and no forgotten-password link. The console
 * is invite only, and a lost password is reset by a super admin who issues a
 * new one — a recovery path that depends on a mailbox rather than on somebody
 * deciding is a way in.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sign-in failed.');
      // A password somebody else chose gets you to the change screen and no
      // further; the server decides that, not this page.
      router.push(data.landing || '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Sign-in failed.');
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
            <p className="text-xs text-slate-400 mt-1.5">Staff sign-in</p>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Work email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="you@generalquery.xyz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-4 leading-relaxed">
          Access is by invitation. Forgotten your password? A super admin can issue
          you a new one — there is no reset link.
        </p>
      </div>
    </main>
  );
}
