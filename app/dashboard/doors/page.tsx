'use client';

import React, { useState, useEffect } from 'react';
import {
  DoorClosed,
  Search,
  RefreshCw,
  QrCode,
  Play,
  Pause,
  PhoneCall,
  MapPin,
  Clock,
  ExternalLink,
  Copy,
  Check,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Door } from '@/lib/types';

export default function DoorsPage() {
  const [doors, setDoors] = useState<Door[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{ door: Door; dataUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [testRingStatus, setTestRingStatus] = useState<string | null>(null);

  const loadDoors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doors?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setDoors(data.doors || []);
      }
    } catch (err) {
      console.error('Failed to load doors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoors();
  }, [search]);

  const togglePauseResume = async (door: Door) => {
    const nextState = door.is_active ? 0 : 1;
    try {
      const res = await fetch('/api/doors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: door.id, is_active: nextState }),
      });
      if (res.ok) {
        setDoors(doors.map((d) => (d.id === door.id ? { ...d, is_active: nextState } : d)));
      }
    } catch (err) {
      alert('Failed to update door state');
    }
  };

  const handleOpenQr = async (door: Door) => {
    const code = door.public_code;
    const url = `https://tapknock.generalquery.xyz/r/${code}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrModal({ door, dataUrl });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateRing = async (door: Door) => {
    if (!door.public_code) return;
    setTestRingStatus(`Ringing ${door.display_name || door.label}...`);
    try {
      const res = await fetch('/api/doors/test-ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: door.public_code, visitor_name: 'Admin Panel Test Ring' }),
      });
      const data = await res.json();
      if (data.outcome === 'ringing') {
        setTestRingStatus(`✅ Ring sent! Ring ID: ${data.ring_id.slice(0, 8)}. Check connected owner phones.`);
      } else {
        setTestRingStatus(`⚠️ Ring response: ${data.outcome || data.message || 'Complete'}`);
      }
    } catch (err: any) {
      setTestRingStatus(`❌ Failed: ${err.message}`);
    }
    setTimeout(() => setTestRingStatus(null), 7000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <DoorClosed className="w-5 h-5 text-brand-400" />
            Doors & Smart Access Points
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Hardware access codes, QR kits, auto-reply configurations, and pause toggles
          </p>
        </div>

        <button
          onClick={loadDoors}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {testRingStatus && (
        <div className="p-3.5 bg-brand-500/10 border border-brand-500/30 rounded-xl text-brand-300 text-xs flex items-center justify-between">
          <span>{testRingStatus}</span>
          <button onClick={() => setTestRingStatus(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doors by label, display name, public code or owner email..."
            className="w-full pl-10 pr-4 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Doors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {doors.map((door) => {
          const isActive = door.is_active === 1;
          const visitorUrl = `https://tapknock.generalquery.xyz/r/${door.public_code}`;

          return (
            <div
              key={door.id}
              className="bg-surface-card rounded-2xl border border-surface-border p-5 flex flex-col justify-between hover:border-surface-border/80 transition-all hover:shadow-xl"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white text-base truncate">
                      {door.display_name || door.label}
                    </h3>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-brand-400 font-semibold">{door.public_code || 'No code'}</span>
                      <span>•</span>
                      <span>{door.label}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                {/* Owner & Address */}
                <div className="space-y-1.5 py-3 border-y border-surface-border text-xs text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Owner:</span>
                    <span className="font-medium text-slate-300 truncate max-w-[160px]">
                      {door.owner_name || door.owner_email || 'Unknown'}
                    </span>
                  </div>
                  {door.address_line && (
                    <div className="flex items-center justify-between">
                      <span>Address:</span>
                      <span className="text-slate-300 truncate max-w-[160px]">{door.address_line}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Geofence Radius:</span>
                    <span className="text-slate-300">{door.radius_m || 150}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ring Duration:</span>
                    <span className="text-slate-300">{door.ring_seconds || 30}s</span>
                  </div>
                  {door.auto_reply && (
                    <div className="pt-1 text-[11px] text-amber-400/90 italic">
                      Auto-reply: &quot;{door.auto_reply}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenQr(door)}
                  className="flex-1 py-1.5 px-3 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-brand-400" />
                  <span>View QR</span>
                </button>

                <button
                  onClick={() => handleSimulateRing(door)}
                  className="py-1.5 px-3 bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Test Ring</span>
                </button>

                <button
                  onClick={() => togglePauseResume(door)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isActive ? 'Pause' : 'Resume'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Preview Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center">
            <button
              onClick={() => setQrModal(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-darker"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              {qrModal.door.display_name || qrModal.door.label}
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Code: {qrModal.door.public_code}
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              <img src={qrModal.dataUrl} alt="Door QR Code" className="w-56 h-56 mx-auto" />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://tapknock.generalquery.xyz/r/${qrModal.door.public_code}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full py-2 bg-surface-darker hover:bg-surface-border text-slate-300 text-xs font-semibold rounded-xl border border-surface-border flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied Visitor URL!' : 'Copy Visitor Doorbell URL'}</span>
              </button>

              <a
                href={`https://tapknock.generalquery.xyz/r/${qrModal.door.public_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Open Visitor Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
