'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Terminal,
  Activity,
  Play,
  Pause,
  RotateCw,
  Search,
  Download,
  Copy,
  Trash2,
  Server,
  Cpu,
  Database,
  Shield,
  Clock,
  Check,
  AlertTriangle,
  Columns,
  Maximize2,
  Minimize2,
  ChevronDown,
  ArrowDown,
  Power,
  RefreshCcw,
  Sliders,
  Filter,
} from 'lucide-react';
import type { ContainerInfo } from '@/lib/docker';

interface LogEntry {
  id: string;
  timestamp: string;
  stream: 'stdout' | 'stderr';
  level: 'info' | 'warn' | 'error' | 'debug' | 'http';
  message: string;
  raw: string;
}

type ServerKey = 'production' | 'staging' | 'admin' | 'postgres';
type ViewMode = 'single' | 'dual';
type StreamFilter = 'all' | 'stdout' | 'stderr';
type SeverityFilter = 'all' | 'error' | 'warn' | 'http' | 'socket' | 'auth';

interface ServerState {
  server: ServerKey;
  containerName: string;
  status: ContainerInfo | null;
  entries: LogEntry[];
  rawText: string;
  loading: boolean;
  error: string | null;
  lastPolled: string | null;
}

// ANSI to CSS color mapping
const ANSI_COLOR_MAP: Record<number, string> = {
  30: 'text-slate-500',
  31: 'text-rose-400 font-semibold',
  32: 'text-emerald-400 font-semibold',
  33: 'text-amber-300 font-semibold',
  34: 'text-sky-400 font-semibold',
  35: 'text-purple-400 font-semibold',
  36: 'text-cyan-300 font-semibold',
  37: 'text-slate-200',
  90: 'text-slate-500',
  91: 'text-rose-300 font-bold',
  92: 'text-emerald-300 font-bold',
  93: 'text-amber-200 font-bold',
  94: 'text-sky-300 font-bold',
  95: 'text-purple-300 font-bold',
  96: 'text-cyan-200 font-bold',
  97: 'text-white font-bold',
};

function renderAnsiAndHighlight(text: string, searchHighlight = ''): React.ReactNode {
  if (!text) return null;

  // Split text by ANSI escape codes: \u001b[...m
  const parts = text.split(/(\u001b\[[0-9;]*m)/g);
  let currentClass = 'text-slate-300';
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, idx) => {
    if (part.startsWith('\u001b[')) {
      const codeMatch = part.match(/\u001b\[([0-9;]*)m/);
      if (codeMatch) {
        const codes = codeMatch[1].split(';').map(Number);
        for (const code of codes) {
          if (code === 0) {
            currentClass = 'text-slate-300';
          } else if (ANSI_COLOR_MAP[code]) {
            currentClass = ANSI_COLOR_MAP[code];
          }
        }
      }
    } else if (part.length > 0) {
      if (searchHighlight && part.toLowerCase().includes(searchHighlight.toLowerCase())) {
        // Highlight matching substrings
        const regex = new RegExp(`(${searchHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const subParts = part.split(regex);
        nodes.push(
          <span key={idx} className={currentClass}>
            {subParts.map((sp, sIdx) =>
              regex.test(sp) ? (
                <mark key={sIdx} className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded">
                  {sp}
                </mark>
              ) : (
                sp
              )
            )}
          </span>
        );
      } else {
        nodes.push(
          <span key={idx} className={currentClass}>
            {part}
          </span>
        );
      }
    }
  });

  return nodes;
}

export default function LogsDashboardPage() {
  // Global & View Mode
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [primaryServer, setPrimaryServer] = useState<ServerKey>('production');
  const [secondaryServer, setSecondaryServer] = useState<ServerKey>('staging');
  const [isLive, setIsLive] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(2000);
  const [tailLines, setTailLines] = useState<number>(250);
  const [timeDisplay, setTimeDisplay] = useState<'utc' | 'local' | 'none'>('local');
  const [wrapLines, setWrapLines] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Restart modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    server: ServerKey;
    action: 'restart' | 'stop' | 'start';
    loading: boolean;
    error?: string;
  }>({
    open: false,
    server: 'production',
    action: 'restart',
    loading: false,
  });

  // Server state caches
  const [serverStates, setServerStates] = useState<Record<ServerKey, ServerState>>({
    production: {
      server: 'production',
      containerName: 'tapknock',
      status: null,
      entries: [],
      rawText: '',
      loading: true,
      error: null,
      lastPolled: null,
    },
    staging: {
      server: 'staging',
      containerName: 'tapknock-staging',
      status: null,
      entries: [],
      rawText: '',
      loading: true,
      error: null,
      lastPolled: null,
    },
    admin: {
      server: 'admin',
      containerName: 'tapknock-admin',
      status: null,
      entries: [],
      rawText: '',
      loading: false,
      error: null,
      lastPolled: null,
    },
    postgres: {
      server: 'postgres',
      containerName: 'tapknock-postgres',
      status: null,
      entries: [],
      rawText: '',
      loading: false,
      error: null,
      lastPolled: null,
    },
  });

  // Filters for primary and secondary terminals
  const [primaryFilter, setPrimaryFilter] = useState<{
    search: string;
    stream: StreamFilter;
    severity: SeverityFilter;
  }>({
    search: '',
    stream: 'all',
    severity: 'all',
  });

  const [secondaryFilter, setSecondaryFilter] = useState<{
    search: string;
    stream: StreamFilter;
    severity: SeverityFilter;
  }>({
    search: '',
    stream: 'all',
    severity: 'all',
  });

  // Terminal scroll anchors and follow-tail states
  const primaryScrollRef = useRef<HTMLDivElement>(null);
  const secondaryScrollRef = useRef<HTMLDivElement>(null);
  const [primaryAutoScroll, setPrimaryAutoScroll] = useState(true);
  const [secondaryAutoScroll, setSecondaryAutoScroll] = useState(true);
  const [primaryNewLinesCount, setPrimaryNewLinesCount] = useState(0);
  const [secondaryNewLinesCount, setSecondaryNewLinesCount] = useState(0);

  // Fetch single server logs
  const fetchServerLogs = useCallback(
    async (serverKey: ServerKey, silent = false) => {
      if (!silent) {
        setServerStates((prev) => ({
          ...prev,
          [serverKey]: { ...prev[serverKey], loading: true, error: null },
        }));
      }

      try {
        const res = await fetch(`/api/logs?server=${serverKey}&tail=${tailLines}`);
        const data = await res.json();

        if (res.ok && data.ok) {
          setServerStates((prev) => {
            const oldLength = prev[serverKey].entries.length;
            const newLength = data.entries?.length || 0;
            if (newLength > oldLength && !primaryAutoScroll && serverKey === primaryServer) {
              setPrimaryNewLinesCount((c) => c + (newLength - oldLength));
            }
            if (newLength > oldLength && !secondaryAutoScroll && serverKey === secondaryServer) {
              setSecondaryNewLinesCount((c) => c + (newLength - oldLength));
            }

            return {
              ...prev,
              [serverKey]: {
                server: serverKey,
                containerName: data.containerName,
                status: data.status,
                entries: data.entries || [],
                rawText: data.rawText || '',
                loading: false,
                error: null,
                lastPolled: data.polledAt,
              },
            };
          });
        } else {
          setServerStates((prev) => ({
            ...prev,
            [serverKey]: {
              ...prev[serverKey],
              loading: false,
              error: data.message || data.error || 'Failed to fetch container logs',
            },
          }));
        }
      } catch (err: any) {
        setServerStates((prev) => ({
          ...prev,
          [serverKey]: {
            ...prev[serverKey],
            loading: false,
            error: err.message || 'Network connection failed',
          },
        }));
      }
    },
    [tailLines, primaryAutoScroll, secondaryAutoScroll, primaryServer, secondaryServer]
  );

  // Polling loop
  useEffect(() => {
    // Initial fetch for visible servers
    fetchServerLogs(primaryServer);
    if (viewMode === 'dual') {
      fetchServerLogs(secondaryServer);
    }

    if (!isLive) return;

    const interval = setInterval(() => {
      fetchServerLogs(primaryServer, true);
      if (viewMode === 'dual') {
        fetchServerLogs(secondaryServer, true);
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [fetchServerLogs, primaryServer, secondaryServer, viewMode, isLive, pollIntervalMs]);

  // Handle auto-scroll for primary
  useEffect(() => {
    if (primaryAutoScroll && primaryScrollRef.current) {
      primaryScrollRef.current.scrollTop = primaryScrollRef.current.scrollHeight;
      setPrimaryNewLinesCount(0);
    }
  }, [serverStates[primaryServer].entries, primaryAutoScroll]);

  // Handle auto-scroll for secondary
  useEffect(() => {
    if (secondaryAutoScroll && secondaryScrollRef.current) {
      secondaryScrollRef.current.scrollTop = secondaryScrollRef.current.scrollHeight;
      setSecondaryNewLinesCount(0);
    }
  }, [serverStates[secondaryServer].entries, secondaryAutoScroll]);

  // Detect user scroll on primary to detach auto-scroll
  const handlePrimaryScroll = () => {
    if (!primaryScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = primaryScrollRef.current;
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 40;
    setPrimaryAutoScroll(atBottom);
    if (atBottom) setPrimaryNewLinesCount(0);
  };

  const handleSecondaryScroll = () => {
    if (!secondaryScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = secondaryScrollRef.current;
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 40;
    setSecondaryAutoScroll(atBottom);
    if (atBottom) setSecondaryNewLinesCount(0);
  };

  // Filter entries
  const filterEntries = (
    entries: LogEntry[],
    filter: { search: string; stream: StreamFilter; severity: SeverityFilter }
  ) => {
    return entries.filter((entry) => {
      // Stream filter
      if (filter.stream !== 'all' && entry.stream !== filter.stream) {
        return false;
      }

      // Severity filter
      if (filter.severity !== 'all') {
        if (filter.severity === 'error' && entry.level !== 'error') return false;
        if (filter.severity === 'warn' && entry.level !== 'warn') return false;
        if (filter.severity === 'http' && entry.level !== 'http') return false;
        if (
          filter.severity === 'socket' &&
          !entry.message.toLowerCase().includes('ws') &&
          !entry.message.toLowerCase().includes('socket') &&
          !entry.message.toLowerCase().includes('connected') &&
          !entry.message.toLowerCase().includes('webrtc') &&
          !entry.message.toLowerCase().includes('peer')
        ) {
          return false;
        }
        if (
          filter.severity === 'auth' &&
          !entry.message.toLowerCase().includes('auth') &&
          !entry.message.toLowerCase().includes('session') &&
          !entry.message.toLowerCase().includes('token') &&
          !entry.message.toLowerCase().includes('magic')
        ) {
          return false;
        }
      }

      // Search text
      if (filter.search) {
        const query = filter.search.toLowerCase();
        const matchMsg = entry.message.toLowerCase().includes(query);
        const matchTs = entry.timestamp.toLowerCase().includes(query);
        const matchLevel = entry.level.toLowerCase().includes(query);
        if (!matchMsg && !matchTs && !matchLevel) return false;
      }

      return true;
    });
  };

  const filteredPrimaryEntries = useMemo(
    () => filterEntries(serverStates[primaryServer].entries, primaryFilter),
    [serverStates, primaryServer, primaryFilter]
  );

  const filteredSecondaryEntries = useMemo(
    () => filterEntries(serverStates[secondaryServer].entries, secondaryFilter),
    [serverStates, secondaryServer, secondaryFilter]
  );

  // Copy logs
  const handleCopyLogs = (serverKey: ServerKey, filteredOnly = false) => {
    const entries = filteredOnly
      ? serverKey === primaryServer
        ? filteredPrimaryEntries
        : filteredSecondaryEntries
      : serverStates[serverKey].entries;

    const text = entries
      .map((e) => `[${e.timestamp}] [${e.stream.toUpperCase()}] [${e.level.toUpperCase()}] ${e.message.replace(/\u001b\[[0-9;]*m/g, '')}`)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(serverKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download log file
  const handleDownloadLogs = (serverKey: ServerKey) => {
    const entries = serverKey === primaryServer ? filteredPrimaryEntries : filteredSecondaryEntries;
    const text = entries
      .map((e) => `[${e.timestamp}] [${e.stream.toUpperCase()}] [${e.level.toUpperCase()}] ${e.message.replace(/\u001b\[[0-9;]*m/g, '')}`)
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tapknock-${serverKey}-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Execute container action (restart/stop/start)
  const handleExecuteAction = async () => {
    setConfirmModal((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch('/api/logs/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: confirmModal.server,
          action: confirmModal.action,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Server action failed');
      }

      setConfirmModal({ open: false, server: 'production', action: 'restart', loading: false });
      // Refresh immediately
      fetchServerLogs(confirmModal.server);
    } catch (err: any) {
      setConfirmModal((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  };

  // Format timestamp for display
  const formatTimestamp = (iso: string) => {
    if (timeDisplay === 'none') return '';
    try {
      const d = new Date(iso);
      if (timeDisplay === 'utc') {
        return d.toISOString().slice(11, 23);
      }
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    } catch {
      return iso.slice(11, 23);
    }
  };

  // Helper badge for level
  const renderLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">ERR</span>;
      case 'warn':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">WRN</span>;
      case 'http':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">HTTP</span>;
      case 'debug':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">DBG</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">INF</span>;
    }
  };

  // Terminal component generator
  const renderTerminalPane = (
    serverKey: ServerKey,
    entries: LogEntry[],
    filter: typeof primaryFilter,
    setFilter: React.Dispatch<React.SetStateAction<typeof primaryFilter>>,
    scrollRef: React.RefObject<HTMLDivElement | null>,
    onScroll: () => void,
    autoScroll: boolean,
    setAutoScroll: (val: boolean) => void,
    newLinesCount: number,
    isSecondary = false
  ) => {
    const sState = serverStates[serverKey];
    const isRunning = Boolean(sState.status?.running);

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d12] border border-surface-border/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[#13141c] border-b border-surface-border/60 gap-3">
          {/* Left: Window Controls & Server Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-darker border border-surface-border/60">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-mono text-xs font-bold text-white capitalize">
                  {serverKey === 'production' ? 'Production (live)' : serverKey === 'staging' ? 'Staging (port 8081)' : serverKey}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">[{sState.containerName}]</span>
              </div>

              {/* Live metrics pill */}
              {sState.status && isRunning && (
                <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 rounded-md bg-surface-card/60 text-[11px] font-mono text-slate-300 border border-surface-border/40">
                  <span title="CPU Usage">CPU: {sState.status.cpuPercent || 0}%</span>
                  <span className="text-slate-600">•</span>
                  <span title="Memory Usage">RAM: {sState.status.memoryMb || 0} MB</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleCopyLogs(serverKey, true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-card transition-colors text-xs flex items-center gap-1 cursor-pointer"
              title="Copy visible filtered logs"
            >
              {copiedId === serverKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[11px]">{copiedId === serverKey ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={() => handleDownloadLogs(serverKey)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-card transition-colors text-xs flex items-center gap-1 cursor-pointer"
              title="Download logs file (.log)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Export</span>
            </button>

            <button
              onClick={() => {
                setServerStates((prev) => ({
                  ...prev,
                  [serverKey]: { ...prev[serverKey], entries: [], rawText: '' },
                }));
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1 cursor-pointer"
              title="Clear terminal buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Clear</span>
            </button>

            {/* Container power management button */}
            <button
              onClick={() => setConfirmModal({ open: true, server: serverKey, action: isRunning ? 'restart' : 'start', loading: false })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                isRunning
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
              }`}
              title={isRunning ? `Restart ${serverKey} server container` : `Start ${serverKey} server container`}
            >
              <RefreshCcw className="w-3 h-3" />
              <span>{isRunning ? 'Restart' : 'Start'}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#0e1017] border-b border-surface-border/40 gap-2 text-xs">
          {/* Search box */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search or regex filter..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full pl-8 pr-6 py-1 bg-surface-darkest border border-surface-border/60 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
            />
            {filter.search && (
              <button
                onClick={() => setFilter({ ...filter, search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Severity & Stream Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={filter.severity}
              onChange={(e) => setFilter({ ...filter, severity: e.target.value as SeverityFilter })}
              className="bg-surface-darkest border border-surface-border/60 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors Only</option>
              <option value="warn">Warnings</option>
              <option value="http">HTTP Requests</option>
              <option value="socket">WebSockets / Signaling</option>
              <option value="auth">Auth & Sessions</option>
            </select>

            <select
              value={filter.stream}
              onChange={(e) => setFilter({ ...filter, stream: e.target.value as StreamFilter })}
              className="bg-surface-darkest border border-surface-border/60 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">stdout + stderr</option>
              <option value="stdout">stdout only</option>
              <option value="stderr">stderr only</option>
            </select>

            <button
              onClick={() => {
                if (autoScroll) {
                  setAutoScroll(false);
                } else {
                  setAutoScroll(true);
                  if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                autoScroll
                  ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                  : 'bg-surface-darkest text-slate-400 border-surface-border/60 hover:text-white'
              }`}
              title="Pin scrolling to bottom on incoming logs"
            >
              <ArrowDown className={`w-3 h-3 ${autoScroll ? 'animate-bounce' : ''}`} />
              <span>{autoScroll ? 'Following' : 'Scroll Paused'}</span>
            </button>
          </div>
        </div>

        {/* Terminal Output Area */}
        <div className="relative flex-1 min-h-[380px] max-h-[650px] overflow-hidden flex flex-col">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed text-slate-300 select-text"
            style={{ backgroundColor: '#090a0f' }}
          >
            {sState.loading && entries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 py-12 gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-brand-400" />
                <span>Connecting to container log stream...</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 gap-2">
                <Terminal className="w-8 h-8 opacity-30 text-slate-400" />
                <p>No log messages match your filter or container output is empty.</p>
                {filter.search && (
                  <button
                    onClick={() => setFilter({ search: '', stream: 'all', severity: 'all' })}
                    className="text-brand-400 hover:underline text-xs"
                  >
                    Clear active filters
                  </button>
                )}
              </div>
            ) : (
              <div className={`space-y-0.5 ${wrapLines ? 'break-words whitespace-pre-wrap' : 'whitespace-pre'}`}>
                {entries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`group flex items-start gap-2 hover:bg-slate-800/40 px-1.5 py-0.5 rounded transition-colors ${
                      entry.level === 'error'
                        ? 'bg-rose-950/20 text-rose-200'
                        : entry.level === 'warn'
                        ? 'bg-amber-950/15'
                        : ''
                    }`}
                  >
                    {/* Line number */}
                    {showLineNumbers && (
                      <span className="text-slate-600 text-[10px] w-7 text-right select-none flex-shrink-0 font-mono pt-0.5">
                        {idx + 1}
                      </span>
                    )}

                    {/* Timestamp */}
                    {timeDisplay !== 'none' && (
                      <span className="text-slate-500 text-[10.5px] flex-shrink-0 select-none font-mono pt-0.5">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    )}

                    {/* Stream badge */}
                    <span
                      className={`text-[9.5px] px-1 py-0.2 rounded uppercase font-mono select-none flex-shrink-0 ${
                        entry.stream === 'stderr'
                          ? 'text-rose-400 bg-rose-500/10'
                          : 'text-slate-400 bg-slate-800/40'
                      }`}
                    >
                      {entry.stream === 'stderr' ? 'err' : 'out'}
                    </span>

                    {/* Level badge */}
                    <div className="flex-shrink-0 select-none">{renderLevelBadge(entry.level)}</div>

                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      {renderAnsiAndHighlight(entry.message, filter.search)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Floating Jump to Latest Button if user scrolled up */}
          {!autoScroll && newLinesCount > 0 && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }}
              className="absolute bottom-3 right-4 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/30 flex items-center gap-1.5 animate-bounce cursor-pointer z-10"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Jump to latest ({newLinesCount} new)</span>
            </button>
          )}

          {/* Terminal Footer Info */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#13141c] border-t border-surface-border/40 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-white">{entries.length}</strong> lines
              </span>
              {filter.search && (
                <span className="text-amber-400">
                  (filtered from {sState.entries.length})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {sState.lastPolled && (
                <span className="hidden sm:inline text-slate-500">
                  Synced {new Date(sState.lastPolled).toLocaleTimeString()}
                </span>
              )}
              <span className="text-slate-600">•</span>
              <span className={isRunning ? 'text-emerald-400' : 'text-rose-400'}>
                {isRunning ? 'Connected' : 'Container Exited'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Realtime Server Logs & Monitoring
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live container logs, performance telemetry, and process controls for Production and Staging.
          </p>
        </div>

        {/* Global Controls & Modes */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Dual vs Single Screen Mode */}
          <div className="flex items-center p-1 bg-surface-card rounded-xl border border-surface-border">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Single Console</span>
            </button>
            <button
              onClick={() => {
                setViewMode('dual');
                fetchServerLogs(secondaryServer);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'dual'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Dual Split (Both Servers)</span>
            </button>
          </div>

          {/* Live Stream Toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 border transition-all cursor-pointer ${
              isLive
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
            }`}
          >
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>LIVE STREAM</span>
                <Pause className="w-3.5 h-3.5 ml-0.5" />
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>RESUME</span>
              </>
            )}
          </button>

          {/* Manual refresh button */}
          <button
            onClick={() => {
              fetchServerLogs(primaryServer);
              if (viewMode === 'dual') fetchServerLogs(secondaryServer);
            }}
            className="p-2 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl border border-surface-border transition-colors cursor-pointer"
            title="Refresh logs immediately"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Configuration Bar */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Left: Server Pickers */}
        <div className="flex items-center gap-3 flex-wrap">
          {viewMode === 'single' ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Server:</span>
              <div className="flex items-center gap-1 bg-surface-darker p-1 rounded-xl border border-surface-border">
                <button
                  onClick={() => setPrimaryServer('production')}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    primaryServer === 'production'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Production (live)</span>
                </button>
                <button
                  onClick={() => setPrimaryServer('staging')}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    primaryServer === 'staging'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Staging Server</span>
                </button>
                <button
                  onClick={() => setPrimaryServer('postgres')}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    primaryServer === 'postgres'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>PostgreSQL</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Left Terminal:</span>
                <select
                  value={primaryServer}
                  onChange={(e) => setPrimaryServer(e.target.value as ServerKey)}
                  className="bg-surface-darker border border-surface-border rounded-lg px-2.5 py-1 text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="production">Production Server (tapknock)</option>
                  <option value="staging">Staging Server (tapknock-staging)</option>
                  <option value="postgres">PostgreSQL Database</option>
                  <option value="admin">TapKnock Admin Panel</option>
                </select>
              </div>

              <div className="text-slate-600">vs</div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Right Terminal:</span>
                <select
                  value={secondaryServer}
                  onChange={(e) => setSecondaryServer(e.target.value as ServerKey)}
                  className="bg-surface-darker border border-surface-border rounded-lg px-2.5 py-1 text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="staging">Staging Server (tapknock-staging)</option>
                  <option value="production">Production Server (tapknock)</option>
                  <option value="postgres">PostgreSQL Database</option>
                  <option value="admin">TapKnock Admin Panel</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right: Telemetry & Terminal Options */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Polling Speed */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={pollIntervalMs}
              onChange={(e) => setPollIntervalMs(Number(e.target.value))}
              className="bg-surface-darker border border-surface-border rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value={1000}>Poll: 1s (Ultra Fast)</option>
              <option value={2000}>Poll: 2s (Smooth)</option>
              <option value={5000}>Poll: 5s (Standard)</option>
              <option value={10000}>Poll: 10s (Eco)</option>
            </select>
          </div>

          {/* Tail Depth */}
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              className="bg-surface-darker border border-surface-border rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value={100}>100 lines</option>
              <option value={250}>250 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1,000 lines</option>
              <option value={2000}>2,000 lines</option>
            </select>
          </div>

          {/* Timestamp view */}
          <select
            value={timeDisplay}
            onChange={(e) => setTimeDisplay(e.target.value as any)}
            className="bg-surface-darker border border-surface-border rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="local">Local Time</option>
            <option value="utc">UTC Time</option>
            <option value="none">Hide Time</option>
          </select>

          {/* Wrap toggle */}
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              wrapLines
                ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                : 'bg-surface-darker text-slate-400 border-surface-border hover:text-white'
            }`}
            title="Toggle line wrapping"
          >
            {wrapLines ? 'Wrap: On' : 'Wrap: Off'}
          </button>
        </div>
      </div>

      {/* Terminal Grid (Single or Dual) */}
      <div className={`flex flex-col lg:flex-row gap-5 ${viewMode === 'dual' ? '' : ''}`}>
        {renderTerminalPane(
          primaryServer,
          filteredPrimaryEntries,
          primaryFilter,
          setPrimaryFilter,
          primaryScrollRef,
          handlePrimaryScroll,
          primaryAutoScroll,
          setPrimaryAutoScroll,
          primaryNewLinesCount
        )}

        {viewMode === 'dual' &&
          renderTerminalPane(
            secondaryServer,
            filteredSecondaryEntries,
            secondaryFilter,
            setSecondaryFilter,
            secondaryScrollRef,
            handleSecondaryScroll,
            secondaryAutoScroll,
            setSecondaryAutoScroll,
            secondaryNewLinesCount,
            true
          )}
      </div>

      {/* Confirmation Modal for Server Restart/Stop/Start */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white capitalize">
                  Confirm {confirmModal.action} {confirmModal.server} Container
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Action will directly affect Docker container <code className="text-amber-300 font-mono">
                    {serverStates[confirmModal.server]?.containerName}
                  </code>.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-surface-darker p-3 rounded-xl border border-surface-border">
              {confirmModal.action === 'restart'
                ? `Restarting will send SIGTERM and gracefully restart the container within 5 seconds. Connected WebRTC/WebSocket clients will briefly reconnect.`
                : confirmModal.action === 'stop'
                ? `Stopping will shut down this server container until manually started again.`
                : `Starting will launch the server container and initialize service ports.`}
            </p>

            {confirmModal.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {confirmModal.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={confirmModal.loading}
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                className="px-4 py-2 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmModal.loading}
                onClick={handleExecuteAction}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-amber-600/30 cursor-pointer disabled:opacity-50"
              >
                {confirmModal.loading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                <span className="capitalize">Yes, {confirmModal.action} Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
