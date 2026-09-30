'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight } from 'lucide-react';
import TapKnockLogo from '@/components/TapKnockLogo';

/**
 * Choosing your own password, before anything else.
 *
 * Reached by signing in with one that was issued rather than chosen — on
 * invitation, or after a super admin reset it. The middleware keeps you here
 * until it is done, because a password that arrived through a mailbox is a way
 * in rather than a credential to keep.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError('Those two do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not change the password.');
      router.push(data.landing || '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete: string
  ) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-surface-darkest flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <TapKnockLogo size={52} />
            </div>
            <div className="flex justify-center mb-3">
              <KeyRound className="w-5 h-5 text-brand-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Choose your own password</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              The one you were sent was issued by somebody else and arrived through a
              mailbox. Replace it and it stops working.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {field('current', 'The password you were sent', current, setCurrent, 'current-password')}
            {field('next', 'New password (at least 10 characters)', next, setNext, 'new-password')}
            {field('confirm', 'New password again', confirm, setConfirm, 'new-password')}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || next.length < 10 || !current}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white text-sm font-semibold"
            >
              {busy ? 'Saving…' : 'Set my password'}
              {!busy && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
