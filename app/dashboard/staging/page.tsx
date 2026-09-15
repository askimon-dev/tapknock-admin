'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Power,
  PowerOff,
  Cpu,
  HardDrive,
  Database,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Copy,
  ExternalLink,
  ArrowRightLeft,
  UploadCloud,
  ShieldCheck,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';

export default function StagingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [powering, setPowering] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dbActionLoading, setDbActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const logBoxRef = useRef<HTMLPreElement>(null);

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/staging/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch staging status:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/staging/logs?tail=100');
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || 'No log output recorded yet.');
      }
    } catch {
      setLogs('Error fetching container logs.');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadLogs();
    const interval = setInterval(() => {
      loadStatus();
      if (data?.container?.running) {
        loadLogs();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [data?.container?.running]);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const handlePowerToggle = async () => {
    const isRunning = data?.container?.running;
    const action = isRunning ? 'stop' : 'start';
    setPowering(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/staging/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const resJson = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: isRunning
            ? 'Staging server powered down. 0% CPU & 0 MB RAM used.'
            : 'Staging server starting up on port 8081...',
        });
        await loadStatus();
        await loadLogs();
      } else {
        setFeedback({
          type: 'error',
          message: resJson.message || 'Failed to toggle staging container.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setPowering(false);
    }
  };

  const handleDbAction = async (action: 'clone_prod_to_staging' | 'promote_staging_to_prod' | 'create_snapshot') => {
    let confirmMsg = '';
    if (action === 'clone_prod_to_staging') {
      confirmMsg = 'Clone Production DB to Staging? Staging data will be replaced with fresh production data.';
    } else if (action === 'promote_staging_to_prod') {
      confirmMsg = 'Promote Staging to Production? A full backup will be created automatically before promotion.';
    }

    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setDbActionLoading(action);
    setFeedback(null);
    try {
      const res = await fetch('/api/staging/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const resJson = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: resJson.message });
        await loadStatus();
      } else {
        setFeedback({ type: 'error', message: resJson.message || 'Database action failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setDbActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const isRunning = data?.container?.running;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            Staging Server & Environment
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Isolated on-demand development server and staging PostgreSQL database
          </p>
        </div>

        <button
          onClick={() => {
            loadStatus();
            loadLogs();
          }}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Hero Lifecycle & Power Card */}
      <div className="p-6 bg-surface-card rounded-2xl border border-surface-border relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Environment Lifecycle
              </span>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isRunning
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                <span>{isRunning ? 'RUNNING (ACTIVE)' : 'STOPPED (0% CPU / 0 MB RAM)'}</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isRunning ? 'Staging is Live & Operational' : 'Staging is Powered Off'}
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {isRunning
                ? 'The staging server container is active on port 8081 connected to tapknock_staging database. Test rings, WebSockets, and new APK builds are isolated here.'
                : 'The staging container is halted. No CPU or RAM is consumed on your droplet. Turn it on whenever you need to test the next version.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePowerToggle}
              disabled={powering}
              className={`px-5 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 ${
                isRunning
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
              }`}
            >
              {powering ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isRunning ? (
                <PowerOff className="w-4 h-4" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              <span>{powering ? 'Processing...' : isRunning ? 'Power Off Staging' : 'Power On Staging'}</span>
            </button>
          </div>
        </div>

        {/* Live Resource Telemetry when running */}
        {isRunning && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-surface-border">
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>CPU Usage</span>
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-base font-bold text-white mt-1">
                {data?.container?.cpuPercent ?? 0}%
              </div>
            </div>

            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Memory Allocation</span>
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-base font-bold text-white mt-1">
                {data?.container?.memoryMb ?? 0} MB
              </div>
            </div>

            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Port Binding</span>
                <Radio className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <div className="text-base font-bold text-white mt-1">8081 / TCP</div>
            </div>

            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Container ID</span>
                <Server className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-base font-mono font-bold text-white mt-1">
                {data?.container?.id || 'staging'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Staging Credentials & Endpoints Card */}
      {isRunning && (
        <div className="p-6 bg-surface-card rounded-2xl border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-400" />
                Staging Endpoints & Developer Credentials
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Use these URLs and secrets to test development builds without touching production
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 bg-surface-darker rounded-xl border border-surface-border space-y-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Direct Web App URL
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-brand-300 truncate">
                  {data?.endpoints?.httpDirect}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => copyToClipboard(data?.endpoints?.httpDirect, 'direct')}
                    className="p-1.5 hover:bg-surface-border text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedKey === 'direct' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={data?.endpoints?.httpDirect}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-surface-border text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-darker rounded-xl border border-surface-border space-y-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Subdomain URL (HTTPS / Caddy)
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-brand-300 truncate">
                  {data?.endpoints?.http}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => copyToClipboard(data?.endpoints?.http, 'subdomain')}
                    className="p-1.5 hover:bg-surface-border text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedKey === 'subdomain' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={data?.endpoints?.http}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-surface-border text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-darker rounded-xl border border-surface-border space-y-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Staging Signalling WebSocket URL
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-300 truncate">
                  {data?.endpoints?.wsDirect}
                </span>
                <button
                  onClick={() => copyToClipboard(data?.endpoints?.wsDirect, 'ws')}
                  className="p-1.5 hover:bg-surface-border text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Copy WebSocket URL"
                >
                  {copiedKey === 'ws' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-surface-darker rounded-xl border border-surface-border space-y-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Staging Database Connection
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-300 truncate">
                  {data?.endpoints?.dbUrl}
                </span>
                <button
                  onClick={() => copyToClipboard(data?.endpoints?.dbUrl, 'db')}
                  className="p-1.5 hover:bg-surface-border text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Copy DB URL"
                >
                  {copiedKey === 'db' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Comparison & Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Production DB Card */}
        <div className="p-5 bg-surface-card rounded-2xl border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Production Database (tapknock)
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 rounded-md">
              LIVE CLEAN
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Accounts</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {data?.prodDb?.accounts ?? 0}
              </span>
            </div>
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Doors</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {data?.prodDb?.doors ?? 0}
              </span>
            </div>
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Rings</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {data?.prodDb?.rings ?? 0}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Ready for tonight&apos;s live users. Zero test contamination.</span>
          </p>
        </div>

        {/* Staging DB Card */}
        <div className="p-5 bg-surface-card rounded-2xl border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              Staging Database (tapknock_staging)
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-950/60 text-purple-400 border border-purple-800/60 rounded-md">
              DEVELOPMENT
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Accounts</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {data?.stagingDb?.accounts ?? 0}
              </span>
            </div>
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Doors</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {data?.stagingDb?.doors ?? 0}
              </span>
            </div>
            <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
              <span className="text-[11px] text-slate-400 block">Rings</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {data?.stagingDb?.rings ?? 0}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleDbAction('clone_prod_to_staging')}
              disabled={dbActionLoading !== null}
              className="flex-1 px-3 py-2 bg-surface-darker hover:bg-surface-border text-slate-200 rounded-xl text-xs font-medium border border-surface-border flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Clone Prod to Staging</span>
            </button>

            <button
              onClick={() => handleDbAction('create_snapshot')}
              disabled={dbActionLoading !== null}
              className="px-3 py-2 bg-surface-darker hover:bg-surface-border text-slate-200 rounded-xl text-xs font-medium border border-surface-border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Create Safety Snapshot"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
              <span>Snapshot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Container Log Console */}
      <div className="p-5 bg-surface-card rounded-2xl border border-surface-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            Live Staging Container Console
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              disabled={loadingLogs}
              className="px-2.5 py-1 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-lg text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Fetch Logs</span>
            </button>
            <button
              onClick={() => setLogs('')}
              className="px-2.5 py-1 bg-surface-darker hover:bg-surface-border text-slate-400 hover:text-white rounded-lg text-xs border border-surface-border transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <pre
          ref={logBoxRef}
          className="p-4 bg-black/80 rounded-xl border border-surface-border text-[11.5px] font-mono text-emerald-400/90 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text"
        >
          {logs || 'Container log output will appear here in real-time when the container is active.'}
        </pre>
      </div>

      {/* Recovery Points & Backups */}
      <div className="p-5 bg-surface-card rounded-2xl border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Point-in-Time Recovery Snapshots
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated and manual snapshots stored on droplet disk (/opt/tapknock-backups)
            </p>
          </div>
        </div>

        <div className="divide-y divide-surface-border">
          {(data?.snapshots || []).slice(0, 5).map((snap: any) => (
            <div key={snap.name} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-slate-200">{snap.name}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-400">
                <span className="font-semibold text-slate-300">{snap.size}</span>
                <span>{new Date(snap.mtime).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
