'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Trash2, Plus, DoorClosed, AlertTriangle } from 'lucide-react';
import { BlocklistEntry } from '@/lib/types';

export default function BlocklistPage() {
  const [blocks, setBlocks] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blocklist');
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
      }
    } catch (err) {
      console.error('Failed to load blocklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, []);

  const handleUnblock = async (doorId: string, fingerprint: string) => {
    if (!confirm('Unblock this fingerprint? The visitor will be allowed to ring again.')) return;
    try {
      const res = await fetch(`/api/blocklist?door_id=${doorId}&fingerprint=${encodeURIComponent(fingerprint)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBlocks(blocks.filter((b) => !(b.door_id === doorId && b.fingerprint === fingerprint)));
      }
    } catch (err: any) {
      alert('Unblock failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Security & Fingerprint Blocklist
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Prevent persistent abusive visitors or harassers from alerting household devices
          </p>
        </div>

        <button
          onClick={loadBlocks}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-darker/60 border-b border-surface-border text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-medium">Door</th>
                <th className="py-3.5 px-4 font-medium">Blocked Fingerprint</th>
                <th className="py-3.5 px-4 font-medium">Reason</th>
                <th className="py-3.5 px-4 font-medium">Blocked On</th>
                <th className="py-3.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {blocks.map((b) => (
                <tr key={b.id} className="hover:bg-surface-darker/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-white">
                    {b.door_name || b.door_label || 'Door'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {b.fingerprint}
                  </td>
                  <td className="py-3 px-4 text-amber-400/90">
                    {b.reason || 'Blocked by owner'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {new Date(b.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleUnblock(b.door_id, b.fingerprint)}
                      className="px-2.5 py-1 bg-surface-darker hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-400 border border-surface-border rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Unblock
                    </button>
                  </td>
                </tr>
              ))}

              {blocks.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    No visitors are currently blocked on any door.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
