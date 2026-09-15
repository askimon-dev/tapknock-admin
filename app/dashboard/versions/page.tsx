'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Radio,
  ExternalLink,
  Copy,
  Check,
  Bell,
  Trash2,
  Edit2,
  AlertTriangle,
  Download,
  Share2,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight,
  RefreshCw,
  HardDrive,
  Globe,
  Play,
  RotateCcw,
  Calendar,
  Clock,
} from 'lucide-react';
import { AppRelease } from '@/lib/types';
import TapKnockLogo from '@/components/TapKnockLogo';

function toDatetimeLocal(isoStr?: string | null) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function VersionsPage() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'android' | 'ios'>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<AppRelease | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'notification' | 'home' | 'widget'>('notification');

  // Form State
  const [formData, setFormData] = useState({
    version_name: '',
    version_code: 2013,
    platform: 'android' as 'android' | 'ios' | 'all',
    release_type: 'drive' as 'drive' | 'playstore' | 'apk' | 'direct_link',
    download_url: '',
    title: '',
    release_notes: '',
    is_mandatory: false,
    min_supported_version_code: 2012,
    is_active: true,
    notify_users: true,
    is_scheduled: false,
    scheduled_at: '',
  });

  const fetchReleases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/versions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch releases');
      setReleases(data.releases || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const openCreateModal = () => {
    setEditingRelease(null);
    const maxCode = releases.reduce((max, r) => Math.max(max, Number(r.version_code) || 0), 2012);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    setFormData({
      version_name: '',
      version_code: maxCode + 1,
      platform: 'android',
      release_type: 'drive',
      download_url: '',
      title: '',
      release_notes: '',
      is_mandatory: false,
      min_supported_version_code: maxCode,
      is_active: true,
      notify_users: true,
      is_scheduled: false,
      scheduled_at: toDatetimeLocal(tomorrow.toISOString()),
    });
    setModalOpen(true);
  };

  const openEditModal = (release: AppRelease) => {
    setEditingRelease(release);
    const isScheduled = !!release.scheduled_at && new Date(release.scheduled_at) > new Date();
    setFormData({
      version_name: release.version_name,
      version_code: release.version_code,
      platform: release.platform,
      release_type: release.release_type,
      download_url: release.download_url,
      title: release.title,
      release_notes: release.release_notes || '',
      is_mandatory: !!release.is_mandatory,
      min_supported_version_code: release.min_supported_version_code || 0,
      is_active: !!release.is_active,
      notify_users: false,
      is_scheduled: isScheduled,
      scheduled_at: release.scheduled_at ? toDatetimeLocal(release.scheduled_at) : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.version_name || !formData.download_url || !formData.title) {
      alert('Please fill in version name, download link, and title.');
      return;
    }

    if (formData.is_scheduled && !formData.scheduled_at) {
      alert('Please specify a scheduled date and time.');
      return;
    }

    setSaving(true);
    const submitPayload = {
      ...formData,
      scheduled_at:
        formData.is_scheduled && formData.scheduled_at
          ? new Date(formData.scheduled_at).toISOString()
          : null,
      is_active: formData.is_scheduled ? false : formData.is_active,
    };

    try {
      if (editingRelease) {
        // Update
        const res = await fetch(`/api/versions/${editingRelease.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitPayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update release');
      } else {
        // Create
        const res = await fetch('/api/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitPayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create release');
        if (data.release?.scheduled_at) {
          alert(`📅 Release v${data.release.version_name} scheduled for ${new Date(data.release.scheduled_at).toLocaleString()}`);
        } else if (data.push_notified) {
          alert('🚀 Release created! Immediate push notification broadcasted to all users.');
        }
      }
      setModalOpen(false);
      fetchReleases();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, version: string) => {
    if (!confirm(`Are you sure you want to delete release v${version}?`)) return;
    try {
      const res = await fetch(`/api/versions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete release');
      fetchReleases();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const res = await fetch(`/api/versions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 1, scheduled_at: null }),
      });
      if (!res.ok) throw new Error('Failed to activate release');
      fetchReleases();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handlePublishNow = async (id: string, version: string) => {
    if (!confirm(`Publish scheduled release v${version} live right now and demote previous active?`)) return;
    try {
      const res = await fetch(`/api/versions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 1, scheduled_at: null }),
      });
      if (!res.ok) throw new Error('Failed to publish release');
      if (confirm(`Broadcast push notification for v${version} to all users now?`)) {
        await handleResendNotification(id, version);
      }
      fetchReleases();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleResendNotification = async (id: string, version: string) => {
    if (!confirm(`Broadcast update notification for v${version} to all users right now?`)) return;
    setNotifyingId(id);
    try {
      const res = await fetch(`/api/versions/${id}/notify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send notification');
      alert(`🔔 Update notification for v${version} sent to all active devices!`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setNotifyingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics
  const activeRelease = releases.find((r) => r.is_active === 1) || releases[0];
  const totalReleases = releases.length;
  const mandatoryCount = releases.filter((r) => r.is_mandatory === 1).length;
  const driveReleases = releases.filter((r) => r.release_type === 'drive').length;
  const playstoreReleases = releases.filter((r) => r.release_type === 'playstore').length;

  const filteredReleases = releases.filter((r) => {
    if (filterPlatform !== 'all' && r.platform !== filterPlatform && r.platform !== 'all') {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.version_name.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.release_notes && r.release_notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Smartphone className="w-7 h-7 text-brand-400" />
            <span>App Version Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track and publish TapKnock releases, update download links (Google Drive / Play Store), and broadcast instant notifications to all users.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Release</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-surface-border p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Live Version
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            {activeRelease ? `v${activeRelease.version_name}` : 'None'}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-surface-darker text-slate-300 font-mono text-[11px]">
              Code: {activeRelease ? activeRelease.version_code : 'N/A'}
            </span>
            <span>• {activeRelease?.platform.toUpperCase() || 'ANDROID'}</span>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Published
            </span>
            <Layers className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">{totalReleases}</div>
          <div className="text-xs text-slate-400 mt-1">
            Releases tracked in database
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Channels Distribution
            </span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            {driveReleases} <span className="text-xs font-normal text-slate-400">Drive</span> / {playstoreReleases} <span className="text-xs font-normal text-slate-400">Store</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Google Drive & Play Store links
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Mandatory Updates
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">{mandatoryCount}</div>
          <div className="text-xs text-slate-400 mt-1">
            Critical force-update releases
          </div>
        </div>
      </div>

      {/* Interactive Mobile Experience Preview */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>How Users Receive New Updates</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              When a release is created, users receive an immediate push alert, a home screen banner, and an interactive widget button.
            </p>
          </div>

          {/* Toggle preview mode */}
          <div className="flex bg-surface-darker p-1 rounded-xl border border-surface-border self-start">
            <button
              onClick={() => setPreviewTab('notification')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                previewTab === 'notification'
                  ? 'bg-brand-600 text-white shadow keep-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              1. Push Notification
            </button>
            <button
              onClick={() => setPreviewTab('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                previewTab === 'home'
                  ? 'bg-brand-600 text-white shadow keep-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              2. App Home Screen
            </button>
            <button
              onClick={() => setPreviewTab('widget')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                previewTab === 'widget'
                  ? 'bg-brand-600 text-white shadow keep-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              3. Home Screen Widget
            </button>
          </div>
        </div>

        {/* Mockup Display */}
        <div className="bg-surface-darker border border-surface-border/80 rounded-xl p-5 flex items-center justify-center dark-preview">
          {previewTab === 'notification' && (
            <div className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <TapKnockLogo size={18} />
                  <span className="font-semibold text-slate-200">TapKnock • Update System</span>
                </div>
                <span>Just now</span>
              </div>
              <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                <span>🚀 {activeRelease ? activeRelease.title : 'TapKnock v0.6.2 Released!'}</span>
              </div>
              <div className="text-xs text-slate-300 mt-1 leading-relaxed">
                TapKnock v{activeRelease ? activeRelease.version_name : '0.6.2'} is available. Tap to download and install.
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-brand-400 font-medium">Category: update</span>
                <span className="text-[11px] font-bold text-brand-400 flex items-center gap-1">
                  Open Download Link <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          )}

          {previewTab === 'home' && (
            <div className="w-full max-w-md bg-gradient-to-r from-blue-950/80 via-brand-950/70 to-indigo-950/80 border border-brand-500/50 rounded-2xl p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-600/30 border border-brand-500/50 flex items-center justify-center text-lg flex-shrink-0">
                  🚀
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      New Update Available • v{activeRelease ? activeRelease.version_name : '0.6.2'}
                    </span>
                    {activeRelease?.is_mandatory ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        Required
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 font-medium">
                    {activeRelease ? activeRelease.title : 'TapKnock Latest Update'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {activeRelease?.release_notes || 'Bug fixes, background reachability enhancements, and widget upgrades.'}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={activeRelease?.download_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow keep-white"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                      <span className="text-white">Download Update</span>
                    </a>
                    {!activeRelease?.is_mandatory && (
                      <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium">
                        Later
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {previewTab === 'widget' && (
            <div className="w-full max-w-sm bg-gradient-to-b from-[#1c2333] to-[#121824] border border-blue-500/40 rounded-2xl p-4 shadow-2xl text-white">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <TapKnockLogo size={18} />
                  <span className="text-[11px] font-bold text-blue-300">TapKnock • Front Door</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  ● Online
                </span>
              </div>

              {/* Dedicated Update Row in Widget */}
              <div className="bg-gradient-to-r from-brand-600/40 to-indigo-600/40 border border-brand-500/50 rounded-xl p-2.5 my-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">🚀</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      Update v{activeRelease ? activeRelease.version_name : '0.6.2'} Available
                    </div>
                    <div className="text-[10px] text-blue-200 truncate">
                      Tap download to upgrade
                    </div>
                  </div>
                </div>
                <button className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 flex-shrink-0 shadow keep-white">
                  <Download className="w-3 h-3 text-white" />
                  <span className="text-white">Download</span>
                </button>
              </div>

              {/* Normal widget card */}
              <div className="bg-slate-800/80 rounded-xl p-2.5 text-xs text-slate-300 border border-slate-700/50">
                <div className="text-[10px] font-bold text-slate-400 tracking-wider">DOOR STATUS</div>
                <div className="text-white font-semibold mt-0.5">🛡️ Armed & ready for visitors</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Releases Filter & List */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-white">Releases History & Distribution</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              All application builds with download links, release types, and direct push re-dispatch.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search versions or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-48"
            />

            <div className="flex bg-surface-darker p-1 rounded-xl border border-surface-border">
              <button
                onClick={() => setFilterPlatform('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  filterPlatform === 'all' ? 'bg-surface-card text-white' : 'text-slate-400'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterPlatform('android')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  filterPlatform === 'android' ? 'bg-surface-card text-white' : 'text-slate-400'
                }`}
              >
                Android
              </button>
              <button
                onClick={() => setFilterPlatform('ios')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  filterPlatform === 'ios' ? 'bg-surface-card text-white' : 'text-slate-400'
                }`}
              >
                iOS
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
            <span>Loading releases catalog...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-400 text-sm">{error}</div>
        ) : filteredReleases.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No releases found. Click &quot;New Release&quot; to publish your first update.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReleases.map((rel) => {
              const isScheduled = !!rel.scheduled_at && new Date(rel.scheduled_at) > new Date();
              const isActive = rel.is_active === 1 && !isScheduled;
              const isMandatory = rel.is_mandatory === 1;

              return (
                <div
                  key={rel.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isScheduled
                      ? 'bg-indigo-950/20 border-indigo-500/40 ring-1 ring-indigo-500/20'
                      : isActive
                      ? 'bg-brand-950/20 border-brand-500/40 ring-1 ring-brand-500/20'
                      : 'bg-surface-darker border-surface-border hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Version Info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-white">
                          v{rel.version_name}
                        </span>

                        <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-surface-card text-slate-300 border border-surface-border">
                          code: {rel.version_code}
                        </span>

                        {isScheduled && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Scheduled for {new Date(rel.scheduled_at!).toLocaleString()}</span>
                          </span>
                        )}

                        {isActive && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Live Active
                          </span>
                        )}

                        {isMandatory && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Mandatory Force Update</span>
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                          {rel.platform}
                        </span>

                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {rel.release_type === 'drive'
                            ? 'Google Drive'
                            : rel.release_type === 'playstore'
                            ? 'Play Store'
                            : rel.release_type === 'apk'
                            ? 'Direct APK'
                            : 'Link'}
                        </span>
                      </div>

                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-200">{rel.title}</div>

                      {rel.release_notes && (
                        <div className="text-xs text-slate-400 whitespace-pre-line bg-surface-card/60 p-3 rounded-lg border border-surface-border/50 max-h-24 overflow-y-auto font-mono text-[11px]">
                          {rel.release_notes}
                        </div>
                      )}

                      {/* Download link row */}
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-400 flex-wrap">
                        <span className="text-slate-500 font-medium">Link:</span>
                        <a
                          href={rel.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:text-brand-300 truncate max-w-xs sm:max-w-md underline underline-offset-2 flex items-center gap-1"
                        >
                          <span className="truncate">{rel.download_url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>

                        <button
                          onClick={() => copyToClipboard(rel.download_url, rel.id)}
                          className="p-1 hover:text-white rounded hover:bg-surface-card transition-colors text-slate-400 cursor-pointer"
                          title="Copy Link"
                        >
                          {copiedId === rel.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500">
                          {isScheduled
                            ? `Scheduled go-live: ${new Date(rel.scheduled_at!).toLocaleString()}`
                            : `Published: ${new Date(rel.published_at || rel.created_at).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
                      {isScheduled ? (
                        <button
                          onClick={() => handlePublishNow(rel.id, rel.version_name)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                          title="Publish this scheduled release live immediately"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Publish Now</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResendNotification(rel.id, rel.version_name)}
                          disabled={notifyingId === rel.id}
                          className="px-3 py-1.5 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Broadcast push notification to all users"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{notifyingId === rel.id ? 'Sending...' : 'Broadcast Push'}</span>
                        </button>
                      )}

                      {!isActive && !isScheduled && (
                        <button
                          onClick={() => handleSetActive(rel.id)}
                          className="px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs font-semibold border border-surface-border transition-all cursor-pointer"
                        >
                          Set as Live
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(rel)}
                        className="p-2 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl border border-surface-border transition-all cursor-pointer"
                        title="Edit Release"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(rel.id, rel.version_name)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all cursor-pointer"
                        title="Delete Release"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-surface-border flex items-center justify-between sticky top-0 bg-surface-card z-10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-brand-400" />
                  <span>{editingRelease ? 'Edit Release' : 'Publish New Application Release'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set version tags, links (Google Drive / Play Store), and trigger immediate broadcast.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-darker"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Row 1: Version Name & Version Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Version Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0.6.2 or 1.0.0"
                    value={formData.version_name}
                    onChange={(e) => setFormData({ ...formData, version_name: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Version Code (Build #) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.version_code}
                    onChange={(e) =>
                      setFormData({ ...formData, version_code: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Platform & Release Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
                    className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="android">Android (.apk / Play Store)</option>
                    <option value="ios">iOS (App Store / TestFlight)</option>
                    <option value="all">All Platforms</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Distribution Channel
                  </label>
                  <select
                    value={formData.release_type}
                    onChange={(e) =>
                      setFormData({ ...formData, release_type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="drive">Google Drive Link</option>
                    <option value="playstore">Google Play Store</option>
                    <option value="apk">Direct APK Download</option>
                    <option value="direct_link">Custom Direct Link</option>
                  </select>
                </div>
              </div>

              {/* Download URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Download Link / Store URL <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder={
                      formData.release_type === 'drive'
                        ? 'https://drive.google.com/file/d/...'
                        : formData.release_type === 'playstore'
                        ? 'https://play.google.com/store/apps/details?id=xyz.generalquery.tapknock'
                        : 'https://...'
                    }
                    value={formData.download_url}
                    onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
                    className="w-full pl-3 pr-24 py-2 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono text-xs"
                  />
                  {formData.download_url && (
                    <a
                      href={formData.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-surface-card hover:bg-surface-border text-[11px] font-semibold text-brand-300 rounded-lg border border-surface-border flex items-center gap-1"
                    >
                      <span>Test</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  This link will be opened when the user taps &quot;Download Update&quot; on the push notification, app banner, or home widget.
                </p>
              </div>

              {/* Release Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Release Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TapKnock v0.6.2 - Critical Reliability & Audio Updates"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Release Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Release Notes / Changelog
                </label>
                <textarea
                  rows={4}
                  placeholder={`- Fixed audio and video replay seeking\n- Instant unread counter clearing\n- Enhanced home screen widget alerts with download action\n- Signaling keep-alive enhancements`}
                  value={formData.release_notes}
                  onChange={(e) => setFormData({ ...formData, release_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                {/* Schedule Release Toggle */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  formData.is_scheduled
                    ? 'bg-indigo-950/30 border-indigo-500/50 ring-1 ring-indigo-500/30'
                    : 'bg-surface-darker border-surface-border hover:border-slate-700'
                }`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_scheduled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          is_scheduled: checked,
                          is_active: checked ? false : formData.is_active,
                        });
                      }}
                      className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Schedule Release for Future Date & Time</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Hold this release and automatically publish it live when the scheduled date/time arrives.
                      </div>
                    </div>
                  </label>

                  {formData.is_scheduled && (
                    <div className="mt-3 pt-3 border-t border-indigo-500/20 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Go-Live Date & Time <span className="text-red-400">*</span></span>
                      </label>
                      <input
                        type="datetime-local"
                        required={formData.is_scheduled}
                        value={formData.scheduled_at}
                        onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-card border border-indigo-500/40 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-400"
                      />
                      <p className="text-[11px] text-slate-400">
                        Until this timestamp, client devices will continue seeing the existing active version.
                      </p>
                    </div>
                  )}
                </div>

                {/* Force Update (Mandatory) Toggle */}
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  formData.is_mandatory
                    ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-surface-darker border-surface-border hover:border-slate-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Force Update (Mandatory)</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Only when this option is selected will users on older versions be blocked from using the app and widget until they update. Calls will still arrive and can be answered normally.
                    </div>
                  </div>
                </label>

                {/* Active Version Toggle (only if not scheduled) */}
                {!formData.is_scheduled && (
                  <label className="flex items-center gap-3 p-3 bg-surface-darker rounded-xl border border-surface-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">Set as Live Active Version</div>
                      <div className="text-[11px] text-slate-400">
                        Devices checking for updates will immediately see this as the current latest release.
                      </div>
                    </div>
                  </label>
                )}

                {!editingRelease && !formData.is_scheduled && (
                  <label className="flex items-center gap-3 p-3 bg-brand-950/30 rounded-xl border border-brand-500/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notify_users}
                      onChange={(e) => setFormData({ ...formData, notify_users: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-brand-300 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5" />
                        <span>Immediately broadcast push notification to all users</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Sends real-time push alert with download link to all registered devices upon release creation.
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/25 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingRelease ? 'Save Changes' : 'Publish & Broadcast'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
