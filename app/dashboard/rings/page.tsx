'use client';

import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Search,
  RefreshCw,
  Video,
  Mic,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserX,
  X,
  MapPin,
  Globe,
} from 'lucide-react';
import { Ring } from '@/lib/types';

export default function RingsAuditPage() {
  const [rings, setRings] = useState<Ring[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRing, setSelectedRing] = useState<Ring | null>(null);
  const [blockReason, setBlockReason] = useState('Abusive behavior');
  const [blockLoading, setBlockLoading] = useState(false);

  const loadRings = async () => {
    setLoading(true);
    try {
      const url = `/api/rings?status=${statusFilter}&q=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRings(data.rings || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load rings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRings();
  }, [statusFilter, search]);

  const handleBlockFingerprint = async () => {
    if (!selectedRing || !selectedRing.fingerprint) return;
    if (!confirm(`Block fingerprint "${selectedRing.fingerprint.slice(0, 10)}..." from ringing this door?`)) return;

    setBlockLoading(true);
    try {
      const res = await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          door_id: selectedRing.door_id,
          fingerprint: selectedRing.fingerprint,
          reason: blockReason,
        }),
      });
      if (res.ok) {
        alert('Fingerprint successfully added to door blocklist.');
        setSelectedRing(null);
        loadRings();
      }
    } catch (err: any) {
      alert('Failed to block fingerprint: ' + err.message);
    } finally {
      setBlockLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-brand-400" />
            Visitor Rings & Call Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete interaction trail, visitor identities, trust levels, and media recordings
          </p>
        </div>

        <button
          onClick={loadRings}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by visitor name, reason, door label..."
            className="w-full pl-10 pr-4 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer w-full sm:w-44"
          >
            <option value="all">All Outcomes</option>
            <option value="answered">Answered</option>
            <option value="ringing">Ringing (Active)</option>
            <option value="declined">Declined</option>
            <option value="missed">Missed</option>
            <option value="quiet_hours">Quiet Hours</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Rings Table */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-darker/60 border-b border-surface-border text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-medium">Door</th>
                <th className="py-3.5 px-4 font-medium">Visitor</th>
                <th className="py-3.5 px-4 font-medium">Reason</th>
                <th className="py-3.5 px-4 font-medium">Outcome</th>
                <th className="py-3.5 px-4 font-medium">Trust Level</th>
                <th className="py-3.5 px-4 font-medium">Duration</th>
                <th className="py-3.5 px-4 font-medium">Media Note</th>
                <th className="py-3.5 px-4 font-medium">Date & Time</th>
                <th className="py-3.5 px-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {rings.map((ring) => {
                const isAnswered = ring.status === 'answered';
                const isDeclined = ring.status === 'declined';
                const isRinging = ring.status === 'ringing';
                const isBlocked = ring.status === 'blocked';

                return (
                  <tr key={ring.id} className="hover:bg-surface-darker/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {ring.door_name || ring.door_label || 'Door'}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-medium">
                      {ring.visitor_name || 'Visitor'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 capitalize">
                      {ring.reason || 'General'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isAnswered
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isDeclined
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : isRinging
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                            : isBlocked
                            ? 'bg-slate-500/20 text-slate-300'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isAnswered && <CheckCircle2 className="w-3 h-3" />}
                        {isDeclined && <XCircle className="w-3 h-3" />}
                        {isRinging && <Clock className="w-3 h-3" />}
                        {ring.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                          ring.trust_badge === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {ring.trust_badge || 'unverified'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {ring.duration_s ? `${ring.duration_s}s` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {ring.has_media ? (
                        <span className="inline-flex items-center gap-1 text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded text-[11px] font-medium">
                          <Video className="w-3 h-3" /> Video ({Math.round((ring.media_size || 0) / 1024)} KB)
                        </span>
                      ) : ring.message_text ? (
                        <span className="text-slate-300 italic truncate max-w-[120px] block">
                          &quot;{ring.message_text}&quot;
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(ring.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedRing(ring)}
                        className="px-2.5 py-1 bg-surface-darker hover:bg-surface-border text-slate-300 hover:text-white rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rings.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    No rings found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ring Detail Inspection Drawer / Modal */}
      {selectedRing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Ring Audit Inspection</span>
                  <span className="text-xs font-mono text-slate-400">({selectedRing.id.slice(0, 8)})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Door: <span className="text-white font-medium">{selectedRing.door_name || selectedRing.door_label}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedRing(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-darker"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-darker rounded-xl border border-surface-border">
                <div>
                  <span className="text-slate-500 block">Visitor Name:</span>
                  <span className="font-semibold text-white">{selectedRing.visitor_name || 'Visitor'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Visitor Reason:</span>
                  <span className="font-semibold text-white capitalize">{selectedRing.reason || 'General'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status / Outcome:</span>
                  <span className="font-semibold text-brand-400 uppercase">{selectedRing.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Call Duration:</span>
                  <span className="font-semibold text-white">{selectedRing.duration_s ? `${selectedRing.duration_s} seconds` : '0s'}</span>
                </div>
              </div>

              {/* Geolocation & Security */}
              <div className="p-3 bg-surface-darker rounded-xl border border-surface-border space-y-1.5">
                <div className="text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-brand-400" />
                  <span>Network & Device Telemetry</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Caller Fingerprint:</span>
                  <span className="font-mono text-slate-300">{selectedRing.fingerprint || 'Not captured'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Connection:</span>
                  <span className="text-slate-300 capitalize">{selectedRing.connection_type || 'Signaling only'}</span>
                </div>
                {selectedRing.ip_city && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Location:</span>
                    <span className="text-slate-300">{selectedRing.ip_city}, {selectedRing.ip_country}</span>
                  </div>
                )}
              </div>

              {/* Message / Media */}
              {selectedRing.message_text && (
                <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
                  <span className="text-slate-500 block mb-1">Visitor Recorded Message:</span>
                  <p className="text-slate-200 italic">&quot;{selectedRing.message_text}&quot;</p>
                </div>
              )}

              {/* Fingerprint Block Action */}
              {selectedRing.fingerprint && (
                <div className="pt-2">
                  <button
                    onClick={handleBlockFingerprint}
                    disabled={blockLoading}
                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Block Caller Fingerprint from Door</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
