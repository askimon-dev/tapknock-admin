'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, BellRing, RefreshCw, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

type UserRow = {
  account_id: string;
  email: string | null;
  display_name: string | null;
  app_version_name: string | null;
  app_version_code: number | null;
  last_seen_at: string | null;
  status: 'current' | 'outdated' | 'unknown';
};

/**
 * Who is running which build, and a way to tell the ones who are behind.
 *
 * "Outdated" is measured by the server against the release that is actually
 * live, not against whatever the console was built from — the two drift, and
 * the app checks against the former.
 *
 * Nobody with an unknown version is ever notified: never having connected is a
 * different thing from being behind, and pushing an update notice at a phone
 * that has never appeared is shouting at nobody.
 */
export default function AppVersionsPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [latest, setLatest] = useState<{ version_name: string; version_code: number } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/app-versions');
      const data = await res.json();
      setRows(data.users || []);
      setLatest(data.latest || null);
      setCounts(data.counts || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const notify = async (ids: string[], label: string) => {
    setNotifying(label);
    setNotice(null);
    try {
      const res = await fetch('/api/app-versions/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_ids: ids, version_name: latest?.version_name }),
      });
      const data = await res.json();
      setNotice(res.ok ? `Update notice sent to ${data.notified}.` : data.message || 'Could not send.');
    } catch {
      setNotice('Could not send.');
    } finally {
      setNotifying(null);
    }
  };

  const outdated = rows.filter((r) => r.status === 'outdated');

  const badge = (status: UserRow['status']) => {
    const map = {
      current: ['bg-emerald-500/15 text-emerald-400 border-emerald-500/30', CheckCircle2, 'Up to date'],
      outdated: ['bg-amber-500/15 text-amber-400 border-amber-500/30', AlertTriangle, 'Outdated'],
      unknown: ['bg-slate-500/15 text-slate-400 border-slate-500/30', HelpCircle, 'Never seen'],
    } as const;
    const [cls, Icon, label] = map[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${cls}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-brand-400" /> App versions
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {latest
              ? `Latest release is ${latest.version_name} (${latest.version_code}).`
              : 'No active release, so nothing can be called outdated.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-2 rounded-xl border border-surface-border text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => notify(outdated.map((r) => r.account_id), 'all')}
            disabled={outdated.length === 0 || notifying !== null}
            className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <BellRing className="w-3.5 h-3.5" />
            {notifying === 'all' ? 'Sending…' : `Notify everyone outdated (${outdated.length})`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([['total', 'People'], ['current', 'Up to date'], ['outdated', 'Outdated'], ['unknown', 'Never seen']] as const).map(
          ([key, label]) => (
            <div key={key} className="bg-surface-card border border-surface-border rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="text-xl font-bold text-white">{counts[key] ?? 0}</p>
            </div>
          )
        )}
      </div>

      {notice && (
        <p className="text-xs text-brand-300 bg-brand-500/10 border border-brand-500/20 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nobody yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-darker text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5">Person</th>
                <th className="text-left px-4 py-2.5">Version</th>
                <th className="text-left px-4 py-2.5">Last seen</th>
                <th className="text-right px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account_id} className="border-t border-surface-border">
                  <td className="px-4 py-3">
                    <p className="text-white text-[13px]">{r.display_name || '—'}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{r.email || r.account_id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-slate-300">
                        {r.app_version_name ?? '—'}
                      </span>
                      {badge(r.status)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">
                    {r.last_seen_at ? new Date(r.last_seen_at).toLocaleString() : 'never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'outdated' && (
                      <button
                        onClick={() => notify([r.account_id], r.account_id)}
                        disabled={notifying !== null}
                        className="px-2.5 py-1.5 rounded-lg border border-surface-border text-[11px] font-semibold text-brand-300 hover:bg-surface-border disabled:opacity-40"
                      >
                        {notifying === r.account_id ? 'Sending…' : 'Notify'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
