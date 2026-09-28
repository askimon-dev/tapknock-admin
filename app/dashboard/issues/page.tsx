'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bug,
  Plus,
  Search,
  RefreshCw,
  Sparkles,
  Wrench,
  ListChecks,
  Trash2,
  Edit2,
  X,
  Send,
  Bot,
  GitCommit,
  GitBranch,
  FlaskConical,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import type { Issue, IssueComment } from '@/lib/tapknock-api';

/* -------------------------------------------------------------- vocabulary */

const KINDS = ['bug', 'feature', 'improvement', 'chore'] as const;
const STATUSES = ['open', 'in_progress', 'blocked', 'fixed', 'verified', 'closed', 'wont_fix'] as const;
const PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;
const AREAS = ['app', 'server', 'admin', 'admin_app', 'infra', 'other'] as const;
const AGENTS = ['claude', 'antigravity'] as const;

const AREA_LABEL: Record<string, string> = {
  app: 'Owner app',
  server: 'Server',
  admin: 'Admin panel',
  admin_app: 'Admin app',
  infra: 'Infrastructure',
  other: 'Other',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  fixed: 'Fixed',
  verified: 'Verified',
  closed: 'Closed',
  wont_fix: "Won't fix",
};

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  in_progress: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  blocked: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  fixed: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  verified: 'bg-teal-500/15 text-teal-500 border-teal-500/30',
  closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  wont_fix: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  high: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  normal: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  low: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  bug: Bug,
  feature: Sparkles,
  improvement: Wrench,
  chore: ListChecks,
};

/** Statuses that still represent work. The agent asks for exactly this set. */
const OUTSTANDING = 'open,in_progress,blocked';

function ago(iso?: string | null) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const emptyDraft = {
  title: '',
  body: '',
  kind: 'bug' as string,
  priority: 'normal' as string,
  area: 'app' as string,
  assigned_ai: 'claude' as string,
  steps: '',
  expected: '',
  actual: '',
  app_version: '',
  tags: '',
};

/* ------------------------------------------------------------------ page */

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(OUTSTANDING);
  const [filterKind, setFilterKind] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Issue | null>(null);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<Issue | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterKind !== 'all') params.set('kind', filterKind);
      if (filterArea !== 'all') params.set('area', filterArea);
      if (filterAgent !== 'all') params.set('assigned_ai', filterAgent);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/issues?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load issues');
      setIssues(json.issues || []);
      setCounts(json.counts || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterKind, filterArea, filterAgent, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft });
    setEditorOpen(true);
  };

  const openEdit = (issue: Issue) => {
    setEditing(issue);
    setDraft({
      title: issue.title,
      body: issue.body || '',
      kind: issue.kind,
      priority: issue.priority,
      area: issue.area,
      assigned_ai: issue.assigned_ai || '',
      steps: issue.steps || '',
      expected: issue.expected || '',
      actual: issue.actual || '',
      app_version: issue.app_version || '',
      tags: (issue.tags || []).join(', '),
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        assigned_ai: draft.assigned_ai || null,
        tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch(
        editing ? `/api/issues/${editing.issue_number}` : '/api/issues',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save');
      setEditorOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (issue: Issue, status: string) => {
    try {
      const res = await fetch(`/api/issues/${issue.issue_number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not update');
      if (detail && detail.id === issue.id) {
        setDetail(json.issue);
        setComments(json.comments || []);
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (issue: Issue) => {
    if (!confirm(`Delete #${issue.issue_number} “${issue.title}”? This cannot be undone.`)) return;
    await fetch(`/api/issues/${issue.issue_number}`, { method: 'DELETE' });
    if (detail?.id === issue.id) setDetail(null);
    await load();
  };

  const openDetail = async (issue: Issue) => {
    setDetail(issue);
    setComments([]);
    setCommentDraft('');
    try {
      const res = await fetch(`/api/issues/${issue.issue_number}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        setDetail(json.issue);
        setComments(json.comments || []);
      }
    } catch {
      /* the row we already have is enough to show */
    }
  };

  const addComment = async () => {
    if (!commentDraft.trim() || !detail) return;
    const body = commentDraft.trim();
    setCommentDraft('');
    await fetch(`/api/issues/${detail.issue_number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    await openDetail(detail);
  };

  /** The line the owner pastes at an agent at the end of the day. */
  const handoff = useMemo(() => {
    const agent = filterAgent === 'all' ? 'claude' : filterAgent;
    return `@ISSUE_WORKFLOW.md solve all open issues assigned to ${agent}`;
  }, [filterAgent]);

  const copyHandoff = async () => {
    await navigator.clipboard.writeText(handoff);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const outstanding =
    (counts.open || 0) + (counts.in_progress || 0) + (counts.blocked || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bug className="w-7 h-7 text-brand-400" />
            <span>Issues &amp; Feature Tracker</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Log bugs, features and improvements as you find them. At the end of the day, hand the
            queue to a coding agent by name or one issue at a time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
          <button
            onClick={copyHandoff}
            title={handoff}
            className="px-3 py-2.5 bg-surface-card border border-surface-border hover:bg-surface-cardHover text-slate-300 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy hand-off'}</span>
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Issue</span>
          </button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Outstanding', value: outstanding, dot: 'bg-sky-500' },
          { label: 'In progress', value: counts.in_progress || 0, dot: 'bg-amber-500' },
          { label: 'Fixed, unverified', value: counts.fixed || 0, dot: 'bg-emerald-500' },
          { label: 'Closed', value: (counts.closed || 0) + (counts.verified || 0), dot: 'bg-slate-500' },
        ].map((card) => (
          <div key={card.label} className="bg-surface-card border border-surface-border p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <span className={`w-2.5 h-2.5 rounded-full ${card.dot}`} />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles and descriptions…"
              className="w-full bg-surface-darker border border-surface-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={() => load()}
            className="px-3 py-2.5 bg-surface-darker border border-surface-border hover:bg-surface-cardHover text-slate-300 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onChange={setFilterStatus} options={[
            { value: OUTSTANDING, label: 'Outstanding' },
            { value: 'all', label: 'All statuses' },
            ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          ]} />
          <Select value={filterKind} onChange={setFilterKind} options={[
            { value: 'all', label: 'All kinds' },
            ...KINDS.map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })),
          ]} />
          <Select value={filterArea} onChange={setFilterArea} options={[
            { value: 'all', label: 'All areas' },
            ...AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] })),
          ]} />
          <Select value={filterAgent} onChange={setFilterAgent} options={[
            { value: 'all', label: 'Any agent' },
            ...AGENTS.map((a) => ({ value: a, label: a[0].toUpperCase() + a.slice(1) })),
          ]} />
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading && issues.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">Loading issues…</div>
        )}

        {!loading && issues.length === 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-12 text-center">
            <Bug className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-300 font-semibold mt-3">Nothing in the queue</p>
            <p className="text-sm text-slate-500 mt-1">
              Log the first bug or idea and it will be waiting for the agent tonight.
            </p>
          </div>
        )}

        {issues.map((issue) => {
          const Icon = KIND_ICON[issue.kind] || Bug;
          return (
            <div
              key={issue.id}
              className="bg-surface-card border border-surface-border hover:bg-surface-cardHover rounded-2xl p-5 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">#{issue.issue_number}</span>
                    <Icon className="w-4 h-4 text-brand-400 shrink-0" />
                    <button
                      onClick={() => openDetail(issue)}
                      className="text-white font-semibold text-left hover:text-brand-400 transition-colors cursor-pointer truncate"
                    >
                      {issue.title}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-2.5">
                    <Badge className={STATUS_STYLE[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
                    <Badge className={PRIORITY_STYLE[issue.priority]}>{issue.priority}</Badge>
                    <Badge className="bg-surface-darker text-slate-400 border-surface-border">
                      {AREA_LABEL[issue.area] || issue.area}
                    </Badge>
                    {issue.assigned_ai && (
                      <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                        <Bot className="w-3 h-3" /> {issue.assigned_ai}
                      </Badge>
                    )}
                    {issue.app_version && (
                      <Badge className="bg-surface-darker text-slate-400 border-surface-border font-mono">
                        v{issue.app_version}
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {ago(issue.updated_at)}
                    </span>
                  </div>

                  {issue.body && (
                    <p className="text-sm text-slate-400 mt-2.5 line-clamp-2">{issue.body}</p>
                  )}

                  {(issue.commit_sha || issue.branch) && (
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500 flex-wrap">
                      {issue.branch && (
                        <span className="flex items-center gap-1 font-mono">
                          <GitBranch className="w-3 h-3" /> {issue.branch}
                        </span>
                      )}
                      {issue.commit_sha && (
                        <span className="flex items-center gap-1 font-mono">
                          <GitCommit className="w-3 h-3" /> {issue.commit_sha.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <select
                    value={issue.status}
                    onChange={(e) => setStatus(issue, e.target.value)}
                    className="bg-surface-darker border border-surface-border rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <IconButton onClick={() => openEdit(issue)} title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </IconButton>
                  <IconButton onClick={() => remove(issue)} title="Delete" danger>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      {editorOpen && (
        <Modal onClose={() => setEditorOpen(false)} title={editing ? `Edit #${editing.issue_number}` : 'Log a new issue'}>
          <div className="space-y-4">
            <Field label="Title">
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ring vanishes after the phone locks on Vivo"
                className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
              />
            </Field>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Kind">
                <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} full
                  options={KINDS.map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))} />
              </Field>
              <Field label="Priority">
                <Select value={draft.priority} onChange={(v) => setDraft({ ...draft, priority: v })} full
                  options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} />
              </Field>
              <Field label="Area">
                <Select value={draft.area} onChange={(v) => setDraft({ ...draft, area: v })} full
                  options={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))} />
              </Field>
              <Field label="Agent">
                <Select value={draft.assigned_ai} onChange={(v) => setDraft({ ...draft, assigned_ai: v })} full
                  options={[{ value: '', label: 'Unassigned' }, ...AGENTS.map((a) => ({ value: a, label: a[0].toUpperCase() + a.slice(1) }))]} />
              </Field>
            </div>

            <Field label="What is wrong, or what should exist">
              <textarea
                rows={3}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Enough for someone who was not there to understand it tomorrow."
                className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 resize-y"
              />
            </Field>

            {draft.kind === 'bug' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Field label="Steps to reproduce">
                  <textarea rows={3} value={draft.steps}
                    onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
                    placeholder="1. Lock the phone&#10;2. Ring from another device"
                    className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 resize-y" />
                </Field>
                <Field label="Expected">
                  <textarea rows={3} value={draft.expected}
                    onChange={(e) => setDraft({ ...draft, expected: e.target.value })}
                    className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 resize-y" />
                </Field>
                <Field label="Actual">
                  <textarea rows={3} value={draft.actual}
                    onChange={(e) => setDraft({ ...draft, actual: e.target.value })}
                    className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 resize-y" />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="App version seen on">
                <input value={draft.app_version}
                  onChange={(e) => setDraft({ ...draft, app_version: e.target.value })}
                  placeholder="0.7.1"
                  className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 font-mono" />
              </Field>
              <Field label="Tags (comma separated)">
                <input value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  placeholder="vivo, ringing"
                  className="w-full bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500" />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setEditorOpen(false)}
                className="px-4 py-2.5 bg-surface-darker border border-surface-border hover:bg-surface-cardHover text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !draft.title.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all cursor-pointer">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Log issue'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detail */}
      {detail && (
        <Modal onClose={() => setDetail(null)} title={`#${detail.issue_number} · ${detail.title}`}>
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={STATUS_STYLE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
              <Badge className={PRIORITY_STYLE[detail.priority]}>{detail.priority}</Badge>
              <Badge className="bg-surface-darker text-slate-400 border-surface-border">
                {AREA_LABEL[detail.area] || detail.area}
              </Badge>
              {detail.assigned_ai && (
                <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                  <Bot className="w-3 h-3" /> {detail.assigned_ai}
                </Badge>
              )}
            </div>

            {detail.body && <Section title="Description">{detail.body}</Section>}
            {detail.steps && <Section title="Steps to reproduce">{detail.steps}</Section>}
            {detail.expected && <Section title="Expected">{detail.expected}</Section>}
            {detail.actual && <Section title="Actual">{detail.actual}</Section>}
            {detail.resolution && <Section title="Resolution">{detail.resolution}</Section>}
            {detail.test_notes && (
              <Section title={<span className="flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> How it was verified</span>}>
                {detail.test_notes}
              </Section>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                History
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {comments.length === 0 && (
                  <p className="text-sm text-slate-500">Nothing logged against this yet.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="bg-surface-darker border border-surface-border rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-300">{c.author}</span>
                      <span className="text-[11px] text-slate-500">{ago(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                  placeholder="Add a note…"
                  className="flex-1 bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                />
                <button onClick={addComment} disabled={!commentDraft.trim()}
                  className="px-3 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 ${className}`}>
      {children}
    </span>
  );
}

function IconButton({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick: () => void; title: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg border border-surface-border transition-all cursor-pointer ${
        danger
          ? 'text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/40'
          : 'text-slate-400 hover:bg-surface-cardHover hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, options, full }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  full?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface-darker border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer ${full ? 'w-full' : ''}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</h4>
      <p className="text-sm text-slate-300 whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-surface-border">
          <h3 className="text-lg font-bold text-white truncate">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-surface-cardHover hover:text-white transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
