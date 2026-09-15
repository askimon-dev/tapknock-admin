'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Calendar,
  TrendingUp,
  Cake,
  UserCheck,
  BarChart3,
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
          <span className="text-xs text-slate-500 dark:text-slate-400">Loading system analytics...</span>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Registered Accounts',
      value: metrics?.totalAccounts ?? 0,
      icon: Users,
      trend: '+100% active',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      label: 'Configured Doors',
      value: metrics?.totalDoors ?? 0,
      icon: DoorClosed,
      trend: `${metrics?.totalDoors ?? 0} live access points`,
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

  const demo = metrics?.ageDemographics;

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            TapKnock Command Center
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live PostgreSQL 16
            </span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Real-time telemetry, visitor call audit, user demographics, and mobile push notification management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExportOpen(true)}
            className="px-4 py-2 bg-surface-card hover:bg-surface-darker text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-surface-border transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Export Analytics</span>
          </button>
          <a
            href="/dashboard/notifications"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-brand-600/25 transition-all cursor-pointer keep-white"
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
              className="p-4 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border/80 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold truncate">{kpi.label}</span>
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-sm`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{kpi.value}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
                <span className="text-slate-400">•</span>
                <span className="truncate">{kpi.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ring Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ring Volume Trends (7 Days) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ring Activity Volume</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total visitor rings vs answered calls over the last 7 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
                <span className="text-slate-700 dark:text-slate-300">Total Rings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">Answered</span>
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
                  contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="rings" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#ringsGrad)" name="Total Rings" />
                <Area type="monotone" dataKey="answered" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#answeredGrad)" name="Answered Calls" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ring Outcome Breakdown (Donut Chart) */}
        <div className="p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Call Outcome Distribution</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Breakdown of all visitor interactions</p>
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
                  contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-surface-border">
            {(metrics?.outcomesBreakdown || []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-400 capitalize">{item.name.toLowerCase()}:</span>
                <span className="font-semibold text-slate-900 dark:text-white ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* HOMEOWNER DEMOGRAPHICS & AGE GROUP ANALYTICS SECTION */}
      {/* ======================================================== */}
      <div className="space-y-4 p-6 rounded-3xl bg-surface-card border border-surface-border shadow-sm">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Homeowner Demographics & Age Group Analytics
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                DOB telemetry, age cohort distribution, generation breakdown, and smart door engagement
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/users"
            className="self-start sm:self-auto px-3.5 py-1.5 bg-surface-darker hover:bg-surface-border text-brand-600 dark:text-brand-400 hover:text-brand-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
          >
            <span>View Filtered Users</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Demographic Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Average & Median Age */}
          <div className="p-4 rounded-2xl bg-surface-darker/60 border border-surface-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Average Age</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {demo?.averageAge ? `${demo.averageAge} yrs` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Median: <span className="font-semibold text-slate-700 dark:text-slate-300">{demo?.medianAge ? `${demo.medianAge} yrs` : '—'}</span>
            </div>
          </div>

          {/* DOB Completion Rate */}
          <div className="p-4 rounded-2xl bg-surface-darker/60 border border-surface-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">DOB Completion Rate</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {demo?.dobCompletionRate ?? 0}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{demo?.totalWithDob ?? 0}</span> of {demo?.totalAccounts ?? 0} profiles provided
            </div>
          </div>

          {/* Dominant Cohort */}
          <div className="p-4 rounded-2xl bg-surface-darker/60 border border-surface-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dominant Cohort</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {demo?.dominantAgeGroup || 'Unspecified'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Highest resident density
            </div>
          </div>

          {/* Age Span Range */}
          <div className="p-4 rounded-2xl bg-surface-darker/60 border border-surface-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Age Span Range</span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {demo?.youngestAge !== null && demo?.youngestAge !== undefined
                ? `${demo.youngestAge} – ${demo.oldestAge} yrs`
                : '—'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Youngest to oldest resident
            </div>
          </div>
        </div>

        {/* Demographics Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Age Cohorts Distribution Bar Chart */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-darker/50 border border-surface-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  Resident Distribution by Age Cohort
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Total resident accounts across generational age groups
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Total: {demo?.totalAccounts ?? 0}
              </span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demo?.cohorts || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="cohort" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    formatter={(val: any, name: any, item: any) => {
                      const payload = item?.payload;
                      return [
                        `${val} resident(s) (${payload?.percentage ?? 0}%) • ${payload?.doorsCount ?? 0} doors • ${payload?.ringsCount ?? 0} rings`,
                        'Accounts',
                      ];
                    }}
                  />
                  <Bar dataKey="usersCount" radius={[6, 6, 0, 0]}>
                    {(demo?.cohorts || []).map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Generations Share Donut Chart */}
          <div className="p-5 rounded-2xl bg-surface-darker/50 border border-surface-border flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Generations Breakdown</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Sociological generation market share</p>
            </div>

            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demo?.generations || []}
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {(demo?.generations || []).map((entry, index) => (
                      <Cell key={`gen-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val} resident(s) (${item?.payload?.percentage ?? 0}%)`,
                      item?.payload?.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-surface-border text-xs">
              {(demo?.generations || []).map((gen, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: gen.color }} />
                    <span className="text-slate-600 dark:text-slate-400 truncate">{gen.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white shrink-0">
                    <span>{gen.count}</span>
                    <span className="text-[11px] text-slate-500 font-normal">({gen.percentage}%)</span>
                  </div>
                </div>
              ))}
              {(!demo?.generations || demo.generations.length === 0) && (
                <div className="text-center py-3 text-xs text-slate-500">No demographic data</div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Cohort Engagement Breakdown Table */}
        <div className="pt-2">
          <div className="overflow-x-auto rounded-2xl border border-surface-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-darker/80 border-b border-surface-border text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Age Cohort</th>
                  <th className="py-3 px-4 font-semibold">Residents (% Share)</th>
                  <th className="py-3 px-4 font-semibold">Configured Doors</th>
                  <th className="py-3 px-4 font-semibold">Avg Doors / Resident</th>
                  <th className="py-3 px-4 font-semibold">Ring Interactions</th>
                  <th className="py-3 px-4 font-semibold">Avg Rings / Resident</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {(demo?.cohorts || []).map((c) => (
                  <tr key={c.cohort} className="hover:bg-surface-darker/40 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="font-semibold">{c.cohort}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      <span className="font-bold">{c.usersCount}</span>{' '}
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">({c.percentage}%)</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {c.doorsCount} door(s)
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {c.avgDoorsPerUser}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {c.ringsCount} ring(s)
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {c.avgRingsPerUser}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/users?age_group=${encodeURIComponent(c.cohort)}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-darker hover:bg-brand-500/10 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 border border-surface-border text-[11px] font-medium transition-colors"
                      >
                        <span>Filter Users</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Hourly Heatmap & Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Peak Activity (0-23h) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Peak Doorbell Hours</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">Distribution of ring activity across 24 hours (UTC)</p>
            </div>
            <Activity className="w-4 h-4 text-brand-500" />
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.hourlyActivity || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" stroke="#64748B" fontSize={10} tickLine={false} interval={2} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1322', borderColor: '#1E2D4A', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Rings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Push Notifications Card */}
        <div className="p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BellRing className="w-4 h-4 text-brand-500" />
                Recent Push Alerts
              </h3>
              <a href="/dashboard/notifications" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                View All
              </a>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">History of broadcast and scheduled mobile notifications</p>

            <div className="space-y-3">
              {(metrics?.recentNotifications || []).slice(0, 3).map((notif) => (
                <div key={notif.id} className="p-3 bg-surface-darker rounded-xl border border-surface-border text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">{notif.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        notif.status === 'sent'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : notif.status === 'scheduled'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {notif.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-1">{notif.body}</p>
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
            className="mt-4 w-full py-2 bg-surface-darker hover:bg-surface-border text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-semibold text-center border border-surface-border transition-colors block"
          >
            Open Push Notification Center →
          </a>
        </div>
      </div>

      {/* Live Ring Feed (Recent Activity) */}
      <div className="p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-500" />
              Live Doorbell Activity Stream
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Latest visitor rings across all doors</p>
          </div>
          <a href="/dashboard/rings" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
            Full Audit Log →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-slate-600 dark:text-slate-400 font-medium">
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
                    <td className="py-3 font-medium text-slate-900 dark:text-white">
                      {ring.door_name || ring.door_label || 'Door'}
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-300">
                      {ring.visitor_name || 'Visitor'}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400 capitalize">
                      {ring.reason || 'General'}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isAnswered
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : isDeclined
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                            : isRinging
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isAnswered && <CheckCircle2 className="w-3 h-3" />}
                        {isDeclined && <XCircle className="w-3 h-3" />}
                        {isRinging && <Clock className="w-3 h-3" />}
                        {ring.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {ring.has_media ? (
                        <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded text-[10px]">
                          <Video className="w-3 h-3" /> Video Note
                        </span>
                      ) : ring.has_photo ? (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded text-[10px]">
                          Photo
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
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
