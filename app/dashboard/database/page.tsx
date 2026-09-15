'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Table,
  Search,
  RefreshCw,
  Play,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Layers,
  GitCompare,
  Activity,
  Key,
  Link as LinkIcon,
  Clock,
  Sparkles,
  Eye,
  X,
  FileCode,
  HardDrive,
  Cpu,
  Check,
  Code2,
  Trash2,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

type DatabaseTarget = 'production' | 'staging';

interface TableMeta {
  name: string;
  row_estimate: number;
  exact_rows: number;
  size: string;
  size_bytes: number;
  column_count: number;
  primary_key?: string | null;
}

interface ColumnMeta {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary: boolean;
  is_foreign: boolean;
  foreign_table: string | null;
  foreign_column: string | null;
}

interface IndexMeta {
  index_name: string;
  index_def: string;
  is_unique: boolean;
  is_primary: boolean;
}

interface ForeignKeyMeta {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface QueryHistoryItem {
  id: string;
  sql: string;
  database: DatabaseTarget;
  timestamp: string;
  durationMs: number;
  rowCount: number;
  success: boolean;
}

// Curated query suggestions for dev and debugging
const QUERY_SUGGESTIONS = [
  {
    category: 'Core Data & Inspection',
    queries: [
      {
        title: 'Recent Accounts',
        sql: 'SELECT id, email, display_name, quekey_id, address_area, state, created_at FROM accounts ORDER BY created_at DESC LIMIT 25;',
        desc: 'List latest registered users with location details',
      },
      {
        title: 'All Configured Doors',
        sql: 'SELECT id, owner_id, label, display_name, address_line, lat, lng, radius_m, is_active, created_at FROM doors ORDER BY created_at DESC;',
        desc: 'Inspect all doors, active statuses and GPS coordinates',
      },
      {
        title: 'Recent Doorbell Rings',
        sql: 'SELECT id, door_id, code_id, visitor_name, ring_type, status, initiated_at, answered_at, duration_s, answered_by FROM rings ORDER BY initiated_at DESC LIMIT 30;',
        desc: 'Audit recent doorbell call rings, durations and outcomes',
      },
      {
        title: 'All App Releases & Force Updates',
        sql: 'SELECT id, version_name, version_code, is_mandatory, is_active, scheduled_at, published_at, download_url, release_notes FROM app_releases ORDER BY version_code DESC;',
        desc: 'Inspect releases, mandatory flags, and scheduled rollout times',
      },
      {
        title: 'Active User Sessions',
        sql: 'SELECT s.token, s.account_id, a.email, a.display_name, s.created_at, s.expires_at FROM sessions s JOIN accounts a ON s.account_id = a.id WHERE s.expires_at > NOW()::text ORDER BY s.created_at DESC LIMIT 30;',
        desc: 'View live unexpired sessions linked to user accounts',
      },
    ],
  },
  {
    category: 'Debugging & Diagnosis',
    queries: [
      {
        title: 'Failed or Missed Rings',
        sql: "SELECT id, door_id, visitor_name, ring_type, status, initiated_at FROM rings WHERE status IN ('missed', 'declined', 'failed', 'timeout') ORDER BY initiated_at DESC LIMIT 25;",
        desc: 'Diagnose rings that were not answered or had issues',
      },
      {
        title: 'Doors with GPS Geofencing Set',
        sql: 'SELECT id, label, display_name, lat, lng, radius_m FROM doors WHERE lat IS NOT NULL AND lng IS NOT NULL;',
        desc: 'Verify geofencing coordinates and protection radius',
      },
      {
        title: 'Security Blocklist & Fraud Hits',
        sql: 'SELECT b.id, b.door_id, d.label AS door_label, b.visitor_name, b.reason, b.created_at FROM blocklist b LEFT JOIN doors d ON b.door_id = d.id ORDER BY b.created_at DESC;',
        desc: 'Audit blocked IPs, spam rings, or blacklisted visitors',
      },
      {
        title: 'Recent Push Notifications',
        sql: 'SELECT id, target_type, target_id, title, category, status, priority, attempts, created_at, sent_at FROM push_notifications ORDER BY created_at DESC LIMIT 25;',
        desc: 'Inspect push notification delivery states and queues',
      },
      {
        title: 'Admin Audit Log History',
        sql: 'SELECT id, actor, action, target_type, target_id, details, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 40;',
        desc: 'Audit administrative operations and schema changes',
      },
      {
        title: 'Household Shared Access',
        sql: 'SELECT h.id, d.label AS door_label, a.email AS member_email, a.display_name, h.role, h.created_at FROM household h JOIN doors d ON h.door_id = d.id JOIN accounts a ON h.account_id = a.id;',
        desc: 'List shared household memberships per door',
      },
    ],
  },
  {
    category: 'PostgreSQL Performance & Health',
    queries: [
      {
        title: 'Table Sizes & Row Counts',
        sql: 'SELECT relname AS table_name, n_live_tup AS row_estimate, n_dead_tup AS dead_rows, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_stat_user_tables ORDER BY n_live_tup DESC;',
        desc: 'Check storage footprint and live vs dead tuples',
      },
      {
        title: 'Active Database Queries & PIDs',
        sql: 'SELECT pid, usename, client_addr, state, query_start, query FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();',
        desc: 'Inspect running queries and connection pool processes',
      },
      {
        title: 'Cache Hit Ratio',
        sql: 'SELECT ROUND((sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100)::numeric, 2) AS cache_hit_percentage FROM pg_statio_user_tables;',
        desc: 'Evaluate memory cache hit ratio (should be >98%)',
      },
      {
        title: 'Query Plan (EXPLAIN ANALYZE)',
        sql: 'EXPLAIN ANALYZE SELECT * FROM rings WHERE door_id IS NOT NULL ORDER BY initiated_at DESC LIMIT 20;',
        desc: 'Measure execution plan and index scans for ring lookups',
      },
    ],
  },
];

export default function DatabaseVisualizerPage() {
  const [dbTarget, setDbTarget] = useState<DatabaseTarget>('production');
  const [activeTab, setActiveTab] = useState<'explorer' | 'sql' | 'diff' | 'erd' | 'diagnostics'>('explorer');

  // Overview stats
  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Table explorer state
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('accounts');
  const [tableSearch, setTableSearch] = useState('');
  const [schemaData, setSchemaData] = useState<{
    columns: ColumnMeta[];
    indexes: IndexMeta[];
    outgoingFks: ForeignKeyMeta[];
    incomingFks: ForeignKeyMeta[];
  } | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [tableSubTab, setTableSubTab] = useState<'data' | 'columns' | 'indexes'>('data');

  // Table data state
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [tableColumnTypes, setTableColumnTypes] = useState<Record<string, string>>({});
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [dataSearch, setDataSearch] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // SQL console state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM accounts ORDER BY created_at DESC LIMIT 25;');
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    durationMs: number;
    command: string;
  } | null>(null);
  const [queryError, setQueryError] = useState<any>(null);
  const [runningQuery, setRunningQuery] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);

  // Diff state
  const [diffData, setDiffData] = useState<any>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // ERD state
  const [erdData, setErdData] = useState<any>(null);
  const [loadingErd, setLoadingErd] = useState(false);
  const [selectedErdTable, setSelectedErdTable] = useState<string | null>(null);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [maintenanceActionLoading, setMaintenanceActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cell inspector modal
  const [inspectCell, setInspectCell] = useState<{
    column: string;
    value: any;
    formatted: string;
  } | null>(null);
  const [copiedCell, setCopiedCell] = useState(false);

  // Load Overview Stats
  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/database/overview');
      if (res.ok) {
        const json = await res.json();
        setOverview(json);
        const currentDbTables = json.databases[dbTarget]?.tables || [];
        setTables(currentDbTables);
      }
    } catch (err) {
      console.error('Failed to fetch DB overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
    // Load query history from localStorage
    try {
      const saved = localStorage.getItem('tapknock_query_history');
      if (saved) {
        setQueryHistory(JSON.parse(saved).slice(0, 30));
      }
    } catch {}
  }, []);

  // When database target changes, update tables and reload data
  useEffect(() => {
    if (overview?.databases?.[dbTarget]?.tables) {
      setTables(overview.databases[dbTarget].tables);
    }
    loadTableData(selectedTable, 1, sortCol, sortOrder, dataSearch);
    loadTableSchema(selectedTable);
    if (activeTab === 'diff') loadDiff();
    if (activeTab === 'erd') loadErd();
    if (activeTab === 'diagnostics') loadDiagnostics();
  }, [dbTarget]);

  // Load Table Schema
  const loadTableSchema = async (tableName: string) => {
    setLoadingSchema(true);
    try {
      const res = await fetch(`/api/database/schema?database=${dbTarget}&table=${encodeURIComponent(tableName)}`);
      if (res.ok) {
        const json = await res.json();
        setSchemaData(json);
      }
    } catch (err) {
      console.error('Failed to fetch table schema:', err);
    } finally {
      setLoadingSchema(false);
    }
  };

  // Load Table Data
  const loadTableData = async (
    tableName: string,
    pg = page,
    sort = sortCol,
    order = sortOrder,
    search = dataSearch
  ) => {
    setLoadingData(true);
    try {
      let url = `/api/database/data?database=${dbTarget}&table=${encodeURIComponent(tableName)}&page=${pg}&limit=${pageSize}`;
      if (sort) url += `&sort=${encodeURIComponent(sort)}&order=${order}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setTableData(json.rows || []);
        setTableColumns(json.columns || []);
        setTableColumnTypes(json.columnTypes || {});
        setTotalRows(json.total || 0);
        setPage(json.page || 1);
      }
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // When selected table changes
  const handleSelectTable = (tblName: string) => {
    setSelectedTable(tblName);
    setPage(1);
    setDataSearch('');
    setSortCol(null);
    loadTableSchema(tblName);
    loadTableData(tblName, 1, null, 'DESC', '');
  };

  // Sort toggle
  const handleSort = (colName: string) => {
    const newOrder = sortCol === colName && sortOrder === 'ASC' ? 'DESC' : 'ASC';
    setSortCol(colName);
    setSortOrder(newOrder);
    loadTableData(selectedTable, 1, colName, newOrder, dataSearch);
  };

  // Execute SQL Query
  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;
    setRunningQuery(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: dbTarget,
          sql: sqlQuery,
          confirmDangerous: confirmDestructive,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setQueryError(json);
        // Save failed query to history
        recordQueryHistory(sqlQuery, 0, 0, false);
      } else {
        setQueryResult(json);
        recordQueryHistory(sqlQuery, json.durationMs, json.rowCount, true);
        // Refresh overview if query might have modified data
        if (json.command && ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE'].includes(json.command)) {
          loadOverview();
          loadTableData(selectedTable);
        }
      }
    } catch (err: any) {
      setQueryError({ message: err.message || 'Network error running query' });
    } finally {
      setRunningQuery(false);
    }
  };

  const recordQueryHistory = (sql: string, durationMs: number, rowCount: number, success: boolean) => {
    const item: QueryHistoryItem = {
      id: `hist-${Date.now()}`,
      sql,
      database: dbTarget,
      timestamp: new Date().toLocaleTimeString(),
      durationMs,
      rowCount,
      success,
    };
    const updated = [item, ...queryHistory.filter((h) => h.sql !== sql)].slice(0, 30);
    setQueryHistory(updated);
    try {
      localStorage.setItem('tapknock_query_history', JSON.stringify(updated));
    } catch {}
  };

  // Load Database Diff
  const loadDiff = async () => {
    setLoadingDiff(true);
    try {
      const res = await fetch('/api/database/diff');
      if (res.ok) {
        const json = await res.json();
        setDiffData(json);
      }
    } catch (err) {
      console.error('Failed to load DB diff:', err);
    } finally {
      setLoadingDiff(false);
    }
  };

  // Load ERD
  const loadErd = async () => {
    setLoadingErd(true);
    try {
      const res = await fetch(`/api/database/schema?database=${dbTarget}&table=all`);
      if (res.ok) {
        const json = await res.json();
        setErdData(json);
      }
    } catch (err) {
      console.error('Failed to load ERD:', err);
    } finally {
      setLoadingErd(false);
    }
  };

  // Load Diagnostics
  const loadDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const res = await fetch(`/api/database/maintenance?database=${dbTarget}`);
      if (res.ok) {
        const json = await res.json();
        setDiagnostics(json);
      }
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  // Run Maintenance Action
  const handleMaintenanceAction = async (action: string, extra?: Record<string, any>) => {
    setMaintenanceActionLoading(action);
    setFeedback(null);
    try {
      const res = await fetch('/api/database/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: dbTarget,
          action,
          ...extra,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: json.message || 'Operation successful' });
        loadDiagnostics();
        loadOverview();
      } else {
        setFeedback({ type: 'error', message: json.message || 'Operation failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Operation error' });
    } finally {
      setMaintenanceActionLoading(null);
    }
  };

  // Cell inspector format helper
  const openCellInspector = (column: string, value: any) => {
    let formatted = '';
    if (value === null || value === undefined) {
      formatted = 'NULL';
    } else if (typeof value === 'object') {
      try {
        formatted = JSON.stringify(value, null, 2);
      } catch {
        formatted = String(value);
      }
    } else if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        formatted = JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        formatted = value;
      }
    } else {
      formatted = String(value);
    }

    setInspectCell({ column, value, formatted });
    setCopiedCell(false);
  };

  // Export Table Data to CSV
  const exportToCsv = (dataToExport: any[], filename = 'export.csv') => {
    if (!dataToExport || dataToExport.length === 0) return;
    const headers = Object.keys(dataToExport[0]);
    const csvRows = [headers.join(',')];

    for (const row of dataToExport) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const escaped = String(typeof val === 'object' ? JSON.stringify(val) : val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const exportToJson = (dataToExport: any[], filename = 'export.json') => {
    if (!dataToExport || dataToExport.length === 0) return;
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentDbStats = overview?.databases?.[dbTarget] || {
    name: dbTarget === 'staging' ? 'tapknock_staging' : 'tapknock',
    size: '---',
    connections: 0,
    tableCount: tables.length,
    totalRows: 0,
    cacheHitRatio: 99.9,
  };

  const filteredTables = tables.filter((t) => t.name.toLowerCase().includes(tableSearch.toLowerCase()));

  const isDestructiveQuery = /\b(DROP|TRUNCATE|ALTER|DELETE|UPDATE|REVOKE|GRANT)\b/i.test(sqlQuery);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Database Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card p-5 rounded-2xl border border-surface-border shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Database Visualizer & Query Studio
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                PostgreSQL Dual Engine
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Full relational schema inspection, real-time data visualizer, custom SQL console, and cross-environment diff.
            </p>
          </div>
        </div>

        {/* Database Switcher Segmented Control */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-surface-darkest p-1.5 rounded-xl border border-surface-border flex items-center gap-1 shadow-inner">
            <button
              onClick={() => setDbTarget('production')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dbTarget === 'production'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Production (tapknock)
            </button>

            <button
              onClick={() => setDbTarget('staging')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dbTarget === 'staging'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Staging (tapknock_staging)
            </button>
          </div>

          <button
            onClick={() => {
              loadOverview();
              loadTableData(selectedTable);
              loadTableSchema(selectedTable);
            }}
            disabled={loadingOverview}
            className="p-2 text-slate-400 hover:text-white bg-surface-darker hover:bg-surface-card rounded-lg border border-surface-border transition-colors"
            title="Refresh Database Stats"
          >
            <RefreshCw className={`w-4 h-4 ${loadingOverview ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Database Health & Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-card p-4 rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Database</span>
            <span
              className={`w-2 h-2 rounded-full ${dbTarget === 'production' ? 'bg-emerald-400' : 'bg-purple-400'}`}
            />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{currentDbStats.name}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {dbTarget === 'production' ? 'Live Primary DB' : 'Isolated Staging Sandbox'}
            </p>
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database Size</span>
            <HardDrive className="w-4 h-4 text-brand-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{currentDbStats.size}</div>
            <p className="text-xs text-slate-500 mt-0.5">{currentDbStats.tableCount} public tables</p>
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Rows</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {currentDbStats.totalRows.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Across all schema relations</p>
          </div>
        </div>

        <div className="bg-surface-card p-4 rounded-xl border border-surface-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cache Hit Ratio</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-emerald-400">{currentDbStats.cacheHitRatio}%</div>
            <p className="text-xs text-slate-500 mt-0.5">{currentDbStats.connections} active connections</p>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="border-b border-surface-border flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'explorer'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-4 h-4" />
            Data Explorer & Schema
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            SQL Query Console
            <span className="px-1.5 py-0.2 text-[10px] rounded bg-brand-500/20 text-brand-300 font-bold">SQL</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('diff');
              loadDiff();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'diff'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            Database Diff (Prod vs Staging)
          </button>

          <button
            onClick={() => {
              setActiveTab('erd');
              loadErd();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'erd'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Schema Relationships (ERD)
          </button>

          <button
            onClick={() => {
              setActiveTab('diagnostics');
              loadDiagnostics();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'diagnostics'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Diagnostics & Maintenance
          </button>
        </div>
      </div>

      {/* TAB 1: DATA EXPLORER & SCHEMA */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Table Sidebar */}
          <div className="lg:col-span-3 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full bg-surface-card border border-surface-border text-sm rounded-xl pl-9 pr-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-sm">
              <div className="p-3 border-b border-surface-border flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Tables ({filteredTables.length})</span>
                <span>Rows</span>
              </div>
              <div className="divide-y divide-surface-border max-h-[600px] overflow-y-auto">
                {filteredTables.map((t) => {
                  const isSelected = selectedTable === t.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => handleSelectTable(t.name)}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors text-xs ${
                        isSelected
                          ? 'bg-brand-500/15 text-brand-400 font-semibold border-l-4 border-brand-500'
                          : 'text-slate-300 hover:bg-surface-darker'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Table className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface-darker border border-surface-border text-slate-400">
                        {t.exact_rows ?? t.row_estimate}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Main Table Content Area */}
          <div className="lg:col-span-9 space-y-4">
            {/* Table Header & Sub-tabs */}
            <div className="bg-surface-card p-4 rounded-2xl border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                    <span>{selectedTable}</span>
                    <span className="text-xs font-normal px-2 py-0.5 rounded bg-surface-darker text-slate-400 border border-surface-border">
                      {totalRows} records
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Primary Key:{' '}
                    <span className="font-mono text-brand-400">
                      {schemaData?.columns.find((c) => c.is_primary)?.column_name || 'id'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Sub-tab selection */}
              <div className="flex items-center gap-2 bg-surface-darkest p-1 rounded-xl border border-surface-border text-xs">
                <button
                  onClick={() => setTableSubTab('data')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    tableSubTab === 'data' ? 'bg-surface-card text-brand-400 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Data Records ({totalRows})
                </button>
                <button
                  onClick={() => setTableSubTab('columns')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    tableSubTab === 'columns'
                      ? 'bg-surface-card text-brand-400 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Columns ({schemaData?.columns.length || 0})
                </button>
                <button
                  onClick={() => setTableSubTab('indexes')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    tableSubTab === 'indexes'
                      ? 'bg-surface-card text-brand-400 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Indexes & Foreign Keys
                </button>
              </div>
            </div>

            {/* DATA VIEW */}
            {tableSubTab === 'data' && (
              <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-sm space-y-3 p-4">
                {/* Search & Export Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder={`Search across ${selectedTable}...`}
                      value={dataSearch}
                      onChange={(e) => {
                        setDataSearch(e.target.value);
                        setPage(1);
                        loadTableData(selectedTable, 1, sortCol, sortOrder, e.target.value);
                      }}
                      className="w-full bg-surface-darkest border border-surface-border text-xs rounded-xl pl-9 pr-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportToCsv(tableData, `${selectedTable}-${dbTarget}.csv`)}
                      disabled={tableData.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition-colors disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => exportToJson(tableData, `${selectedTable}-${dbTarget}.json`)}
                      disabled={tableData.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition-colors disabled:opacity-50"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      JSON
                    </button>
                    <button
                      onClick={() => loadTableData(selectedTable)}
                      className="p-1.5 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-lg border border-surface-border"
                      title="Reload Table Data"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Table Data Grid */}
                <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-surface-darkest text-slate-400 font-semibold sticky top-0 z-10 border-b border-surface-border">
                      <tr>
                        {tableColumns.map((col) => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className="px-3.5 py-2.5 whitespace-nowrap cursor-pointer hover:text-white select-none transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-300">{col}</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({tableColumnTypes[col] || 'text'})
                              </span>
                              {sortCol === col ? (
                                <span className="text-brand-400 font-bold">{sortOrder === 'ASC' ? '▲' : '▼'}</span>
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border font-mono text-[11px]">
                      {loadingData ? (
                        <tr>
                          <td colSpan={Math.max(1, tableColumns.length)} className="text-center py-12 text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
                              <span>Loading records from {selectedTable}...</span>
                            </div>
                          </td>
                        </tr>
                      ) : tableData.length === 0 ? (
                        <tr>
                          <td colSpan={Math.max(1, tableColumns.length)} className="text-center py-12 text-slate-500">
                            No rows found in "{selectedTable}".
                          </td>
                        </tr>
                      ) : (
                        tableData.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-brand-500/5 transition-colors">
                            {tableColumns.map((col) => {
                              const val = row[col];
                              const isNull = val === null || val === undefined;
                              const isObj = typeof val === 'object';
                              let displayVal = isNull ? 'NULL' : isObj ? JSON.stringify(val) : String(val);
                              if (displayVal.length > 45) {
                                displayVal = displayVal.slice(0, 42) + '...';
                              }

                              return (
                                <td
                                  key={col}
                                  onClick={() => openCellInspector(col, val)}
                                  className="px-3.5 py-2 whitespace-nowrap cursor-pointer hover:bg-brand-500/10 transition-colors border-r border-surface-border/40 last:border-r-0"
                                  title="Click to inspect full value"
                                >
                                  {isNull ? (
                                    <span className="text-slate-600 italic">NULL</span>
                                  ) : (
                                    <span
                                      className={
                                        col === 'id' || col.endsWith('_id')
                                          ? 'text-indigo-400'
                                          : col.includes('at') || col.includes('time')
                                          ? 'text-amber-400/90'
                                          : typeof val === 'number'
                                          ? 'text-emerald-400'
                                          : isObj
                                          ? 'text-cyan-400'
                                          : 'text-slate-300'
                                      }
                                    >
                                      {displayVal}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Showing</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const newLimit = parseInt(e.target.value, 10);
                        setPageSize(newLimit);
                        setPage(1);
                        loadTableData(selectedTable, 1, sortCol, sortOrder, dataSearch);
                      }}
                      className="bg-surface-darkest border border-surface-border text-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value={10}>10 rows</option>
                      <option value={25}>25 rows</option>
                      <option value={50}>50 rows</option>
                      <option value={100}>100 rows</option>
                      <option value={500}>500 rows</option>
                    </select>
                    <span>of {totalRows} total records</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const prev = Math.max(1, page - 1);
                        setPage(prev);
                        loadTableData(selectedTable, prev);
                      }}
                      disabled={page <= 1}
                      className="p-1.5 bg-surface-darkest hover:bg-surface-darker disabled:opacity-30 rounded-lg border border-surface-border text-slate-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono">
                      Page {page} of {Math.ceil(totalRows / pageSize) || 1}
                    </span>
                    <button
                      onClick={() => {
                        const next = page + 1;
                        setPage(next);
                        loadTableData(selectedTable, next);
                      }}
                      disabled={page >= Math.ceil(totalRows / pageSize)}
                      className="p-1.5 bg-surface-darkest hover:bg-surface-darker disabled:opacity-30 rounded-lg border border-surface-border text-slate-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* COLUMNS VIEW */}
            {tableSubTab === 'columns' && (
              <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm overflow-hidden">
                <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-darkest text-slate-400 font-semibold border-b border-surface-border">
                      <tr>
                        <th className="px-4 py-3">Column Name</th>
                        <th className="px-4 py-3">Data Type</th>
                        <th className="px-4 py-3">Nullable</th>
                        <th className="px-4 py-3">Default Value</th>
                        <th className="px-4 py-3">Key / Relationship</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border font-mono text-xs">
                      {schemaData?.columns.map((col) => (
                        <tr key={col.column_name} className="hover:bg-surface-darker/50">
                          <td className="px-4 py-3 font-bold text-slate-200 flex items-center gap-2">
                            {col.is_primary && (
                              <span className="p-1 bg-amber-500/20 text-amber-400 rounded" title="Primary Key">
                                <Key className="w-3 h-3" />
                              </span>
                            )}
                            {col.is_foreign && (
                              <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded" title="Foreign Key">
                                <LinkIcon className="w-3 h-3" />
                              </span>
                            )}
                            <span>{col.column_name}</span>
                          </td>
                          <td className="px-4 py-3 text-brand-400 font-medium">{col.data_type}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                col.is_nullable === 'YES'
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold'
                              }`}
                            >
                              {col.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{col.column_default || '—'}</td>
                          <td className="px-4 py-3">
                            {col.is_primary ? (
                              <span className="text-amber-400 font-semibold">PRIMARY KEY</span>
                            ) : col.is_foreign ? (
                              <span className="text-indigo-400 font-medium flex items-center gap-1">
                                → {col.foreign_table}.{col.foreign_column}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INDEXES & FOREIGN KEYS VIEW */}
            {tableSubTab === 'indexes' && (
              <div className="space-y-4">
                <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    Indexes & Constraints ({schemaData?.indexes.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {schemaData?.indexes.map((idx) => (
                      <div
                        key={idx.index_name}
                        className="p-3 bg-surface-darkest rounded-xl border border-surface-border font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-300 font-bold">{idx.index_name}</span>
                          {idx.is_unique && (
                            <span className="px-1.5 py-0.5 bg-brand-500/20 text-brand-300 text-[10px] rounded font-semibold">
                              UNIQUE
                            </span>
                          )}
                          {idx.is_primary && (
                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded font-semibold">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px] truncate max-w-md">{idx.index_def}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-indigo-400" />
                    Relational References (Foreign Keys)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Outgoing References (Depends on)
                      </span>
                      {schemaData?.outgoingFks && schemaData.outgoingFks.length > 0 ? (
                        schemaData.outgoingFks.map((fk, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-surface-darkest rounded-xl border border-surface-border text-xs font-mono"
                          >
                            <span className="text-slate-300">{fk.column_name}</span>{' '}
                            <span className="text-indigo-400">→</span>{' '}
                            <span className="text-emerald-400 font-bold">{fk.foreign_table_name}</span>
                            <span className="text-slate-400">.{fk.foreign_column_name}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic">No outgoing foreign keys.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Incoming References (Referenced by)
                      </span>
                      {schemaData?.incomingFks && schemaData.incomingFks.length > 0 ? (
                        schemaData.incomingFks.map((fk, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-surface-darkest rounded-xl border border-surface-border text-xs font-mono"
                          >
                            <span className="text-purple-400 font-bold">{fk.table_name}</span>
                            <span className="text-slate-400">.{fk.column_name}</span>{' '}
                            <span className="text-indigo-400">→</span>{' '}
                            <span className="text-slate-300">{fk.foreign_column_name}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic">No other tables reference this table.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SQL QUERY CONSOLE */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          {/* Query Editor Box */}
          <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-brand-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">SQL Query Console</h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    dbTarget === 'production'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  Target: {dbTarget === 'production' ? 'tapknock (PROD)' : 'tapknock_staging (STAGING)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSqlQuery('SELECT * FROM accounts LIMIT 25;')}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-surface-darkest hover:bg-surface-darker rounded-lg border border-surface-border"
                >
                  Reset
                </button>
                <button
                  onClick={handleRunQuery}
                  disabled={runningQuery || !sqlQuery.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                >
                  {runningQuery ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Run Query (Ctrl + Enter)
                </button>
              </div>
            </div>

            {/* Safety Alert for Production Destructive Queries */}
            {dbTarget === 'production' && isDestructiveQuery && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-xs text-red-300">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="font-bold">⚠️ Destructive Query on Production Database</p>
                  <p className="text-slate-300">
                    This query modifies data (UPDATE/DELETE/ALTER/DROP). Any change will affect real production doorbell rings and users.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-red-200">
                    <input
                      type="checkbox"
                      checked={confirmDestructive}
                      onChange={(e) => setConfirmDestructive(e.target.checked)}
                      className="rounded bg-surface-darker border-red-500/50 text-red-600 focus:ring-0"
                    />
                    <span>I understand the risks and confirm executing this query on Production.</span>
                  </label>
                </div>
              </div>
            )}

            {/* SQL Code Textarea */}
            <div className="relative rounded-xl border border-surface-border overflow-hidden bg-surface-darkest">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleRunQuery();
                  }
                }}
                rows={6}
                placeholder="Write your PostgreSQL query here..."
                className="w-full bg-transparent p-3.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none resize-y leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Suggestions Drawer & Quick Insert Buttons */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Interactive Query Suggestions & Debugging Presets:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {QUERY_SUGGESTIONS.map((cat, idx) => (
                  <div key={idx} className="bg-surface-darkest p-3 rounded-xl border border-surface-border space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{cat.category}</span>
                    <div className="space-y-1.5">
                      {cat.queries.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => {
                            setSqlQuery(q.sql);
                            setQueryError(null);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-surface-darker hover:bg-brand-500/10 border border-surface-border/50 hover:border-brand-500/40 transition-colors group"
                        >
                          <div className="flex items-center justify-between text-xs font-medium text-slate-200 group-hover:text-brand-400">
                            <span>{q.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Insert →</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{q.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Query Execution Status / Error Banner */}
          {queryError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>SQL Execution Error: {queryError.message}</span>
              </div>
              {queryError.position && (
                <p className="font-mono text-slate-400">Syntax error near character position: {queryError.position}</p>
              )}
              {queryError.detail && <p className="font-mono text-slate-300">Detail: {queryError.detail}</p>}
              {queryError.hint && <p className="text-amber-400">Hint: {queryError.hint}</p>}
            </div>
          )}

          {/* Query Results Table */}
          {queryResult && (
            <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
                <div className="flex items-center gap-3">
                  <span className="p-1 bg-emerald-500/20 text-emerald-400 rounded">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div className="text-xs">
                    <span className="font-bold text-slate-200">
                      {queryResult.rowCount} rows returned ({queryResult.command})
                    </span>
                    <span className="text-slate-400 ml-2 font-mono">Executed in {queryResult.durationMs}ms</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportToCsv(queryResult.rows, `query-result-${Date.now()}.csv`)}
                    disabled={queryResult.rows.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-surface-darkest hover:bg-surface-darker text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={() => exportToJson(queryResult.rows, `query-result-${Date.now()}.json`)}
                    disabled={queryResult.rows.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-surface-darkest hover:bg-surface-darker text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition-colors disabled:opacity-50"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    JSON
                  </button>
                </div>
              </div>

              {queryResult.rows.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Query executed successfully with 0 rows returned.
                </div>
              ) : (
                <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-darkest text-slate-300 font-semibold sticky top-0 z-10 border-b border-surface-border">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border font-mono text-[11px]">
                      {queryResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-brand-500/5 transition-colors">
                          {queryResult.columns.map((col) => {
                            const val = row[col];
                            const isNull = val === null || val === undefined;
                            const isObj = typeof val === 'object';
                            let displayVal = isNull ? 'NULL' : isObj ? JSON.stringify(val) : String(val);
                            if (displayVal.length > 50) displayVal = displayVal.slice(0, 47) + '...';

                            return (
                              <td
                                key={col}
                                onClick={() => openCellInspector(col, val)}
                                className="px-3.5 py-2 whitespace-nowrap cursor-pointer hover:bg-brand-500/10 transition-colors border-r border-surface-border/40 last:border-r-0 text-slate-300"
                                title="Click to view full content"
                              >
                                {isNull ? <span className="text-slate-600 italic">NULL</span> : displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Query History */}
          {queryHistory.length > 0 && (
            <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Recent Query History
                </span>
                <button
                  onClick={() => {
                    setQueryHistory([]);
                    try {
                      localStorage.removeItem('tapknock_query_history');
                    } catch {}
                  }}
                  className="text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>
              <div className="divide-y divide-surface-border max-h-48 overflow-y-auto">
                {queryHistory.map((h) => (
                  <div
                    key={h.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs hover:bg-surface-darker px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full ${h.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="font-mono text-slate-300 truncate">{h.sql}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-slate-500 font-mono text-[11px]">
                      <span>{h.rowCount} rows</span>
                      <span>{h.durationMs}ms</span>
                      <button
                        onClick={() => setSqlQuery(h.sql)}
                        className="text-brand-400 hover:underline flex items-center gap-1"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DATABASE DIFF (PROD VS STAGING) */}
      {activeTab === 'diff' && (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-brand-400" />
                Database Comparison: Production vs Staging
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify schema parity, row differences, and storage footprints across both environments.
              </p>
            </div>
            <button
              onClick={loadDiff}
              disabled={loadingDiff}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-darkest hover:bg-surface-darker text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDiff ? 'animate-spin' : ''}`} />
              Re-run Comparison
            </button>
          </div>

          {loadingDiff ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-400" />
              <span>Comparing schemas and records between tapknock and tapknock_staging...</span>
            </div>
          ) : !diffData ? (
            <div className="py-12 text-center text-slate-500">Failed to load comparison data.</div>
          ) : (
            <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-darkest text-slate-400 font-semibold border-b border-surface-border">
                  <tr>
                    <th className="px-4 py-3">Table Name</th>
                    <th className="px-4 py-3">Production Rows</th>
                    <th className="px-4 py-3">Staging Rows</th>
                    <th className="px-4 py-3">Row Delta</th>
                    <th className="px-4 py-3">Production Size</th>
                    <th className="px-4 py-3">Staging Size</th>
                    <th className="px-4 py-3">Schema Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border font-mono text-xs">
                  {diffData.comparisons.map((c: any) => {
                    const hasRowDiff = c.rowDiff !== null && c.rowDiff !== 0;
                    return (
                      <tr key={c.tableName} className="hover:bg-surface-darker/50">
                        <td className="px-4 py-3 font-bold text-slate-200">{c.tableName}</td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold">
                          {c.existsInProd ? c.prodRows : <span className="text-red-400">MISSING</span>}
                        </td>
                        <td className="px-4 py-3 text-purple-400 font-semibold">
                          {c.existsInStaging ? c.stagingRows : <span className="text-red-400">MISSING</span>}
                        </td>
                        <td className="px-4 py-3">
                          {hasRowDiff ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                c.rowDiff > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {c.rowDiff > 0 ? `+${c.rowDiff} in prod` : `${c.rowDiff} in prod`}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-normal">Identical (0)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{c.prodSize}</td>
                        <td className="px-4 py-3 text-slate-400">{c.stagingSize}</td>
                        <td className="px-4 py-3">
                          {c.schemaMatches ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <Check className="w-3.5 h-3.5" /> In Sync
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 font-semibold" title="Schema mismatch">
                              <AlertTriangle className="w-3.5 h-3.5" /> Schema Differs
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ENTITY RELATIONSHIPS (ERD) */}
      {activeTab === 'erd' && (
        <div className="bg-surface-card rounded-2xl border border-surface-border p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Code2 className="w-5 h-5 text-brand-400" />
                Interactive Entity Relationship Diagram (ERD)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Visual relationship model mapping primary keys and foreign key constraints across TapKnock tables.
              </p>
            </div>
            <button
              onClick={loadErd}
              disabled={loadingErd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-darkest hover:bg-surface-darker text-slate-300 rounded-lg text-xs font-medium border border-surface-border"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingErd ? 'animate-spin' : ''}`} />
              Reload ERD
            </button>
          </div>

          {loadingErd ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-400" />
              <span>Analyzing schema foreign keys and relational graph...</span>
            </div>
          ) : !erdData ? (
            <div className="py-12 text-center text-slate-500">No schema data available.</div>
          ) : (
            <div className="space-y-6">
              {/* Relational Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(erdData.tables || {}).map(([tblName, cols]: [string, any]) => {
                  const isFocused = selectedErdTable === tblName;
                  const outgoing = (erdData.relationships || []).filter((r: any) => r.table_name === tblName);
                  const incoming = (erdData.relationships || []).filter((r: any) => r.foreign_table_name === tblName);

                  return (
                    <div
                      key={tblName}
                      onClick={() => setSelectedErdTable(tblName === selectedErdTable ? null : tblName)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isFocused
                          ? 'bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/30'
                          : 'bg-surface-darkest border-surface-border hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-surface-border/60 pb-2 mb-2">
                        <span className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                          <Table className="w-4 h-4 text-brand-400" />
                          {tblName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{cols.length} cols</span>
                      </div>

                      {/* Columns list */}
                      <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
                        {cols.map((c: any) => (
                          <div key={c.column_name} className="flex items-center justify-between gap-1 text-slate-300">
                            <span className="flex items-center gap-1 truncate">
                              {c.is_primary && <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                              {c.is_foreign && <LinkIcon className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                              <span className={c.is_primary ? 'font-bold text-amber-300' : ''}>{c.column_name}</span>
                            </span>
                            <span className="text-slate-500 text-[10px]">{c.data_type}</span>
                          </div>
                        ))}
                      </div>

                      {/* Relationships badge summary */}
                      <div className="border-t border-surface-border/60 pt-2 mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Outgoing FKs: {outgoing.length}</span>
                        <span>Incoming FKs: {incoming.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Foreign Keys Detailed Table */}
              <div className="bg-surface-darkest rounded-xl border border-surface-border p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Relational Constraints (Foreign Key Bindings)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(erdData.relationships || []).map((rel: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-surface-card rounded-lg border border-surface-border text-xs font-mono flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-400 font-bold">{rel.table_name}</span>
                        <span className="text-slate-400">({rel.column_name})</span>
                      </div>
                      <span className="text-indigo-400 font-bold">──────►</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">{rel.foreign_table_name}</span>
                        <span className="text-slate-400">({rel.foreign_column_name})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DIAGNOSTICS & MAINTENANCE */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              <span>{feedback.message}</span>
              <button onClick={() => setFeedback(null)}>
                <X className="w-4 h-4 opacity-70 hover:opacity-100" />
              </button>
            </div>
          )}

          {/* Maintenance Action Bar */}
          <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-400" />
              PostgreSQL Engine Actions ({dbTarget === 'production' ? 'tapknock' : 'tapknock_staging'})
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleMaintenanceAction('vacuum')}
                disabled={maintenanceActionLoading !== null}
                className="px-3.5 py-2 bg-surface-darkest hover:bg-surface-darker text-slate-200 border border-surface-border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Run VACUUM ANALYZE
              </button>

              <button
                onClick={() => handleMaintenanceAction('analyze')}
                disabled={maintenanceActionLoading !== null}
                className="px-3.5 py-2 bg-surface-darkest hover:bg-surface-darker text-slate-200 border border-surface-border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Update Query Statistics (ANALYZE)
              </button>

              <button
                onClick={() => handleMaintenanceAction('reset_stats')}
                disabled={maintenanceActionLoading !== null}
                className="px-3.5 py-2 bg-surface-darkest hover:bg-surface-darker text-slate-200 border border-surface-border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                Reset Engine Stats
              </button>
            </div>
          </div>

          {/* Active PostgreSQL Sessions */}
          <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Active Database Processes ({diagnostics?.activities?.length || 0})
              </h3>
              <button
                onClick={loadDiagnostics}
                className="p-1.5 bg-surface-darkest hover:bg-surface-darker rounded-lg border border-surface-border text-slate-400"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDiagnostics ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingDiagnostics ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading process activity...</div>
            ) : !diagnostics?.activities || diagnostics.activities.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No active client queries running.</div>
            ) : (
              <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-surface-darkest text-slate-400 border-b border-surface-border">
                    <tr>
                      <th className="px-3 py-2">PID</th>
                      <th className="px-3 py-2">Client IP</th>
                      <th className="px-3 py-2">State</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">Current Query</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-[11px]">
                    {diagnostics.activities.map((act: any) => (
                      <tr key={act.pid} className="hover:bg-surface-darker">
                        <td className="px-3 py-2 font-bold text-brand-400">{act.pid}</td>
                        <td className="px-3 py-2 text-slate-400">{act.client_ip || 'local'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              act.state === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {act.state}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-amber-300">{act.duration_seconds ?? 0}s</td>
                        <td className="px-3 py-2 text-slate-300 truncate max-w-md" title={act.query}>
                          {act.query || '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleMaintenanceAction('terminate_pid', { pid: act.pid })}
                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[10px] font-bold transition-colors"
                          >
                            Kill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dead Tuples & Vacuum Status */}
          <div className="bg-surface-card rounded-2xl border border-surface-border p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              Table Bloat & Tuple Analysis
            </h3>
            <div className="border border-surface-border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-darkest text-slate-400 border-b border-surface-border">
                  <tr>
                    <th className="px-3 py-2">Table</th>
                    <th className="px-3 py-2">Live Tuples</th>
                    <th className="px-3 py-2">Dead Tuples</th>
                    <th className="px-3 py-2">Last Vacuum</th>
                    <th className="px-3 py-2">Last Auto-Analyze</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-[11px]">
                  {diagnostics?.vacuumStats?.map((s: any) => (
                    <tr key={s.table_name} className="hover:bg-surface-darker">
                      <td className="px-3 py-2 font-bold text-slate-200">{s.table_name}</td>
                      <td className="px-3 py-2 text-emerald-400">{s.live_tuples}</td>
                      <td className="px-3 py-2 text-amber-400">{s.dead_tuples}</td>
                      <td className="px-3 py-2 text-slate-400">{s.last_vacuum || s.last_autovacuum || 'Never'}</td>
                      <td className="px-3 py-2 text-slate-400">{s.last_analyze || s.last_autoanalyze || 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CELL INSPECTOR MODAL */}
      {inspectCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-brand-400" />
                <span className="font-bold text-slate-200 text-sm font-mono">
                  Cell Value: {inspectCell.column}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inspectCell.formatted);
                    setCopiedCell(true);
                    setTimeout(() => setCopiedCell(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-surface-darkest hover:bg-surface-darker text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition-colors"
                >
                  {copiedCell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCell ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setInspectCell(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-darker"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed bg-surface-darkest/70 rounded-b-2xl">
              <pre className="whitespace-pre-wrap break-all">{inspectCell.formatted}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
