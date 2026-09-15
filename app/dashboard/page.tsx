'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  DoorClosed,
  PhoneCall,
  PhoneForwarded,
  Smartphone,
  BellRing,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Video,
  Mic,
  Activity,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DashboardMetrics } from '@/lib/types';
import ExportModal from '@/components/ExportModal';

export default function DashboardOverview() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error('Failed to load metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Loading system analytics...</span>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Registered Accounts',
      value: metrics?.totalAccounts ?? 0,
      icon: Users,
      trend: '+100% migrated',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      label: 'Configured Doors',
      value: metrics?.totalDoors ?? 0,
      icon: DoorClosed,
      trend: '6 live access points',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Total Rings Logged',
      value: metrics?.totalRings ?? 0,
      icon: PhoneCall,
      trend: `${metrics?.ringsToday ?? 0} rings today`,
      color: 'from-amber-500 to-orange-600',
    },
    {
      label: 'Call Answer Rate',
      value: `${metrics?.answerRate ?? 0}%`,
      icon: PhoneForwarded,
      trend: 'Avg pickup 4.2s',
      color: 'from-purple-500 to-pink-600',
    },
    {
      label: 'Online Devices',
      value: metrics?.activeOnlineDevices ?? 1,
      icon: Smartphone,
      trend: 'Live WebSocket signaling',
      color: 'from-cyan-500 to-blue-600',
    },
    {
      label: 'Push Dispatched',
      value: metrics?.notificationsCount ?? 0,
      icon: BellRing,
      trend: 'Targeted & Broadcast',
      color: 'from-rose-500 to-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-surface-card via-surface-darker to-surface-card border border-surface-border">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            TapKnock Command Center
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live PostgreSQL 16
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, visitor call audit, and mobile push notification management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExportOpen(true)}
            className="px-4 py-2 bg-surface-card hover:bg-surface-border text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-surface-border transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Export Analytics</span>
          </button>
          <a
            href="/dashboard/notifications"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose Push Notification</span>
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border/80 transition-all hover:shadow-lg hover:shadow-black/40"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-medium truncate">{kpi.label}</span>
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-sm`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">{kpi.value}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="text-slate-500">•</span>
                <span className="truncate">{kpi.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ring Volume Trends (7 Days) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Ring Activity Volume</h3>
              <p className="text-xs text-slate-400">Total visitor rings vs answered calls over the last 7 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
                <span className="text-slate-300">Total Rings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-300">Answered</span>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.ringActivity || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ringsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="answeredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="rings" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#ringsGrad)" name="Total Rings" />
                <Area type="monotone" dataKey="answered" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#answeredGrad)" name="Answered Calls" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ring Outcome Breakdown (Donut Chart) */}
        <div className="p-5 rounded-2xl bg-surface-card border border-surface-border flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Call Outcome Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">Breakdown of all visitor interactions</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.outcomesBreakdown || []}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {(metrics?.outcomesBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-surface-border">
            {(metrics?.outcomesBreakdown || []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400 capitalize">{item.name.toLowerCase()}:</span>
                <span className="font-semibold text-white ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Heatmap & Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Peak Activity (0-23h) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-card border border-surface-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Peak Doorbell Hours</h3>
              <p className="text-xs text-slate-400">Distribution of ring activity across 24 hours (UTC)</p>
            </div>
            <Activity className="w-4 h-4 text-brand-400" />
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.hourlyActivity || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" stroke="#64748B" fontSize={10} tickLine={false} interval={2} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Rings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Push Notifications Card */}
        <div className="p-5 rounded-2xl bg-surface-card border border-surface-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BellRing className="w-4 h-4 text-brand-400" />
                Recent Push Alerts
              </h3>
              <a href="/dashboard/notifications" className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                View All
              </a>
            </div>
            <p className="text-xs text-slate-400 mb-4">History of broadcast and scheduled mobile notifications</p>

            <div className="space-y-3">
              {(metrics?.recentNotifications || []).slice(0, 3).map((notif) => (
                <div key={notif.id} className="p-3 bg-surface-darker rounded-xl border border-surface-border text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white truncate max-w-[140px]">{notif.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        notif.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : notif.status === 'scheduled'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {notif.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-400 line-clamp-1">{notif.body}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{notif.target_label || 'All Users'}</span>
                    <span>{notif.sent_at ? new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</span>
                  </div>
                </div>
              ))}

              {(!metrics?.recentNotifications || metrics.recentNotifications.length === 0) && (
                <div className="text-center py-6 text-xs text-slate-500">
                  No notifications recorded yet.
                </div>
              )}
            </div>
          </div>

          <a
            href="/dashboard/notifications"
            className="mt-4 w-full py-2 bg-surface-darker hover:bg-surface-border text-slate-300 hover:text-white rounded-xl text-xs font-semibold text-center border border-surface-border transition-colors block"
          >
            Open Push Notification Center →
          </a>
        </div>
      </div>

      {/* Live Ring Feed (Recent Activity) */}
      <div className="p-5 rounded-2xl bg-surface-card border border-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              Live Doorbell Activity Stream
            </h3>
            <p className="text-xs text-slate-400">Latest visitor rings across all doors</p>
          </div>
          <a href="/dashboard/rings" className="text-xs text-brand-400 hover:text-brand-300 font-medium">
            Full Audit Log →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-slate-400 font-medium">
                <th className="pb-3 font-medium">Door</th>
                <th className="pb-3 font-medium">Visitor</th>
                <th className="pb-3 font-medium">Reason</th>
                <th className="pb-3 font-medium">Outcome</th>
                <th className="pb-3 font-medium">Media</th>
                <th className="pb-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {(metrics?.recentRings || []).map((ring) => {
                const isAnswered = ring.status === 'answered';
                const isDeclined = ring.status === 'declined';
                const isRinging = ring.status === 'ringing';

                return (
                  <tr key={ring.id} className="hover:bg-surface-darker/50 transition-colors">
                    <td className="py-3 font-medium text-white">
                      {ring.door_name || ring.door_label || 'Door'}
                    </td>
                    <td className="py-3 text-slate-300">
                      {ring.visitor_name || 'Visitor'}
                    </td>
                    <td className="py-3 text-slate-400 capitalize">
                      {ring.reason || 'General'}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isAnswered
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isDeclined
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : isRinging
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isAnswered && <CheckCircle2 className="w-3 h-3" />}
                        {isDeclined && <XCircle className="w-3 h-3" />}
                        {isRinging && <Clock className="w-3 h-3" />}
                        {ring.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {ring.has_media ? (
                        <span className="inline-flex items-center gap-1 text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded text-[10px]">
                          <Video className="w-3 h-3" /> Video Note
                        </span>
                      ) : ring.has_photo ? (
                        <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded text-[10px]">
                          Photo
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-500">
                      {new Date(ring.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultType="overview"
      />
    </div>
  );
}
