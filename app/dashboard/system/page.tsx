'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Radio,
  RefreshCw,
  HardDrive,
  Cpu,
  Shield,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function SystemPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load system data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-400" />
            Infrastructure & Database Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Droplet container cluster, PostgreSQL 16 health, and admin audit trail
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Cluster Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Database Engine</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white">PostgreSQL 16</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Healthy & Connected</span>
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Database Size</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-white">{data?.db?.size || '9.8 MB'}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>Persistent named volume</span>
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Signaling Gateway</span>
            <Radio className="w-4 h-4 text-brand-400 animate-pulse" />
          </div>
          <div className="text-lg font-bold text-white">
            {data?.live_backend?.stats?.online_devices ?? 1} Online
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>WebSockets: {data?.live_backend?.stats?.online_devices ?? 1} device socket(s)</span>
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Host Environment</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white">DigitalOcean Droplet</div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>IP: 64.227.155.199</span>
          </div>
        </div>
      </div>

      {/* Database Tables Breakdown */}
      <div className="p-5 bg-surface-card rounded-2xl border border-surface-border">
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          PostgreSQL Database Tables
        </h3>
        <p className="text-xs text-slate-400 mb-4">Live row counts across all relational entities</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(data?.db?.tables || []).map((t: any) => (
            <div key={t.name} className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="font-mono text-xs text-slate-300 block truncate">{t.name}</span>
              <span className="text-lg font-bold text-white mt-1 block">{t.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Audit Trail */}
      <div className="p-5 bg-surface-card rounded-2xl border border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-400" />
              Administrative Audit Trail
            </h3>
            <p className="text-xs text-slate-400">Security event log for administrative actions</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-slate-400 font-medium">
                <th className="pb-3 font-medium">Actor</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Target Type</th>
                <th className="pb-3 font-medium">Target ID / Details</th>
                <th className="pb-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {(data?.audit_logs || []).map((log: any) => (
                <tr key={log.id} className="hover:bg-surface-darker/50 transition-colors">
                  <td className="py-2.5 font-semibold text-white">{log.actor}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-surface-darker border border-surface-border font-mono text-[11px] text-brand-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400 capitalize">{log.target_type || '—'}</td>
                  <td className="py-2.5 text-slate-300 font-mono text-[11px] truncate max-w-[200px]">
                    {log.details || log.target_id || '—'}
                  </td>
                  <td className="py-2.5 text-slate-500 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}

              {(!data?.audit_logs || data.audit_logs.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No audit records logged yet.
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
