'use client';

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Send,
  Calendar,
  Clock,
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Smartphone,
  RefreshCw,
  Info,
  Radio,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Account, PushNotification } from '@/lib/types';

const templates = [
  {
    name: 'Scheduled Maintenance',
    title: '🛠️ Scheduled System Maintenance',
    body: 'TapKnock server will undergo a brief 5-minute maintenance tonight at 02:00 UTC. Your doorbells will automatically reconnect.',
    category: 'maintenance',
    priority: 'high',
  },
  {
    name: 'New Feature Announcement',
    title: '✨ Video Remuxing & Seekable Playback',
    body: 'You can now seek smoothly across visitor video notes! Update to the latest app release for instant cue streaming.',
    category: 'update',
    priority: 'normal',
  },
  {
    name: 'Security Alert',
    title: '🛡️ TapKnock Security Advisory',
    body: 'Please ensure your door PIN and household member permissions are up to date in the settings tab.',
    category: 'alert',
    priority: 'urgent',
  },
  {
    name: 'Doorbell Health Reminder',
    title: '🔔 Doorbell Connection Health Check',
    body: 'Keep your TapKnock background service unrestricted in battery settings to ensure you never miss a visitor ring.',
    category: 'announcement',
    priority: 'normal',
  },
];

export default function PushNotificationsPage() {
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'announcement' | 'alert' | 'maintenance' | 'update'>('announcement');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [actionUrl, setActionUrl] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'targeted'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const loadData = async () => {
    try {
      const [notifsRes, usersRes] = await Promise.all([
        fetch('/api/notifications'),
        fetch('/api/users'),
      ]);
      if (notifsRes.ok) {
        const notifsData = await notifsRes.json();
        setNotifications(notifsData.notifications || []);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load notification data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyTemplate = (t: typeof templates[0]) => {
    setTitle(t.title);
    setBody(t.body);
    setCategory(t.category as any);
    setPriority(t.priority as any);
  };

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSelectAllUsers = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map((u) => u.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setStatusMessage({ type: 'error', text: 'Title and message body cannot be empty.' });
      return;
    }
    if (targetType === 'targeted' && selectedUserIds.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one targeted user.' });
      return;
    }
    if (scheduleType === 'scheduled' && !scheduledAt) {
      setStatusMessage({ type: 'error', text: 'Please choose a future date and time for scheduled delivery.' });
      return;
    }

    setSending(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          category,
          priority,
          action_url: actionUrl.trim() || null,
          target_type: targetType,
          target_account_ids: targetType === 'targeted' ? selectedUserIds : [],
          scheduled_at: scheduleType === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch notification');
      }

      setStatusMessage({
        type: 'success',
        text: scheduleType === 'scheduled'
          ? `Notification successfully scheduled for ${new Date(scheduledAt).toLocaleString()}`
          : `Push notification broadcast successfully to ${data.delivered ?? 1} device(s)!`,
      });

      // Clear form
      setTitle('');
      setBody('');
      setActionUrl('');
      setSelectedUserIds([]);
      setScheduledAt('');
      setScheduleType('immediate');
      loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Notification dispatch failed.' });
    } finally {
      setSending(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled notification?')) return;
    try {
      const res = await fetch(`/api/notifications/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Scheduled notification cancelled.' });
        loadData();
      }
    } catch (err: any) {
      alert('Failed to cancel notification: ' + err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return (
      (u.email && u.email.toLowerCase().includes(s)) ||
      (u.display_name && u.display_name.toLowerCase().includes(s)) ||
      u.id.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
              <BellRing className="w-4 h-4" />
            </div>
            Push Notification Dispatch & Scheduling
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Broadcast alerts to all active devices immediately, target specific door owners, or schedule future announcements
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Presets / Templates Banner */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
        <div className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Quick Announcement Presets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {templates.map((t, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyTemplate(t)}
              className="px-3 py-1.5 bg-surface-darker hover:bg-surface-border/80 border border-surface-border rounded-xl text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Composer & Live Phone Mockup Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Composer Form (7 cols) */}
        <div className="lg:col-span-7 bg-surface-card rounded-2xl border border-surface-border p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Notification Title <span className="text-brand-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. TapKnock System Announcement"
                maxLength={60}
                required
                className="w-full px-3.5 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Shows prominently in lock screen banner</span>
                <span>{title.length}/60</span>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Message Body <span className="text-brand-400">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your push notification message..."
                rows={3}
                maxLength={240}
                required
                className="w-full px-3.5 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Delivered to Android and iOS notifications with sound & vibration</span>
                <span>{body.length}/240</span>
              </div>
            </div>

            {/* Category & Priority in 2 Cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="announcement">Announcement (General)</option>
                  <option value="alert">Security Alert</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="update">App Update</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Delivery Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="normal">Normal (Silent / Low alert)</option>
                  <option value="high">High (Sound & Banner)</option>
                  <option value="urgent">Urgent (Vibrate + Immediate popup)</option>
                </select>
              </div>
            </div>

            {/* Optional Action URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Action URL / Deep Link <span className="text-slate-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="e.g. https://tapknock.generalquery.xyz or tapknock://settings"
                className="w-full px-3.5 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Target Audience Selector */}
            <div className="pt-2 border-t border-surface-border">
              <label className="block text-xs font-medium text-slate-300 mb-2">Target Audience</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    targetType === 'all'
                      ? 'bg-brand-600/10 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/30'
                      : 'bg-surface-darker border-surface-border text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-400" />
                      Everyone
                    </span>
                    {targetType === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400">All {users.length} active registered accounts</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('targeted')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    targetType === 'targeted'
                      ? 'bg-brand-600/10 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/30'
                      : 'bg-surface-darker border-surface-border text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                      Targeted Users
                    </span>
                    {targetType === 'targeted' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedUserIds.length} user(s) selected
                  </div>
                </button>
              </div>

              {/* Targeted user selection drawer */}
              {targetType === 'targeted' && (
                <div className="p-3 bg-surface-darker rounded-xl border border-surface-border space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Select Recipients:</span>
                    <button
                      type="button"
                      onClick={handleSelectAllUsers}
                      className="text-brand-400 hover:text-brand-300 font-semibold text-[11px]"
                    >
                      {selectedUserIds.length === users.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email or name..."
                    className="w-full px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                  />

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {filteredUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleToggleUser(user.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-brand-600/20 text-white border border-brand-500/30' : 'hover:bg-surface-card text-slate-300'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-medium text-white">{user.display_name || 'No Name'}</span>
                            <span className="text-slate-400 text-[11px] ml-2 truncate">({user.email || user.id.slice(0, 8)})</span>
                          </div>
                          <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 border-slate-600">
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Delivery Timing (Immediate vs Scheduled) */}
            <div className="pt-2 border-t border-surface-border">
              <label className="block text-xs font-medium text-slate-300 mb-2">Delivery Timing</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setScheduleType('immediate')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    scheduleType === 'immediate'
                      ? 'bg-brand-600/10 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/30'
                      : 'bg-surface-darker border-surface-border text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-brand-400" />
                      Send Immediately
                    </span>
                    {scheduleType === 'immediate' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400">Broadcast right now via live WebSocket</div>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType('scheduled')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    scheduleType === 'scheduled'
                      ? 'bg-brand-600/10 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/30'
                      : 'bg-surface-darker border-surface-border text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-400" />
                      Schedule for Later
                    </span>
                    {scheduleType === 'scheduled' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400">Deliver automatically at future time</div>
                </button>
              </div>

              {scheduleType === 'scheduled' && (
                <div className="p-3 bg-surface-darker rounded-xl border border-surface-border">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Select Target Date & Time (Local / Server):
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required={scheduleType === 'scheduled'}
                    className="w-full px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>The server background scheduler runs every 30s to process due dispatches.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {scheduleType === 'scheduled'
                        ? 'Schedule Push Notification'
                        : `Dispatch Push Immediately (${targetType === 'all' ? 'All Users' : `${selectedUserIds.length} Target(s)`})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Realistic Phone Mockup (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-brand-400" />
            <span>Live Device Lockscreen Preview</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-[310px] h-[580px] bg-black rounded-[48px] p-3 ring-8 ring-slate-800 shadow-2xl relative flex flex-col justify-between border-4 border-slate-700">
            {/* Camera notch / dynamic island */}
            <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mt-1 mb-4 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-950 mr-2" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />
            </div>

            {/* Lockscreen clock */}
            <div className="text-center my-auto">
              <div className="text-4xl font-light text-white tracking-tight">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>

              {/* Notification Banner on Lock Screen */}
              <div className="mt-8 mx-1 p-3.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-xl text-left transition-all">
                {/* Header */}
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-md bg-brand-600 flex items-center justify-center font-bold text-[9px] text-white">
                      TK
                    </div>
                    <span className="font-semibold text-slate-200">TapKnock</span>
                  </div>
                  <span className="text-[10px] text-slate-400">now</span>
                </div>

                {/* Title */}
                <div className="font-semibold text-xs text-white line-clamp-1">
                  {title || 'TapKnock Notification'}
                </div>

                {/* Body */}
                <div className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                  {body || 'Preview your notification text here. It updates automatically as you type in the composer.'}
                </div>

                {/* Category & Action Tag */}
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="capitalize text-brand-400 font-medium">
                    {category}
                  </span>
                  <span className="text-slate-400">Tap to open app →</span>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mb-1" />
          </div>
        </div>
      </div>

      {/* Notification History & Scheduled Queue Table */}
      <div className="bg-surface-card rounded-2xl border border-surface-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Push Notification Log & Scheduled Queue</h3>
            <p className="text-xs text-slate-400">All historical broadcasts and scheduled tasks</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total: {notifications.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-slate-400">
                <th className="pb-3 font-medium">Title & Message</th>
                <th className="pb-3 font-medium">Audience</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Priority</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Recipients</th>
                <th className="pb-3 font-medium">Dispatched / Scheduled</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {notifications.map((notif) => {
                const isSent = notif.status === 'sent';
                const isScheduled = notif.status === 'scheduled';
                const isCancelled = notif.status === 'cancelled';

                return (
                  <tr key={notif.id} className="hover:bg-surface-darker/50 transition-colors">
                    <td className="py-3 max-w-[200px]">
                      <div className="font-semibold text-white truncate">{notif.title}</div>
                      <div className="text-slate-400 text-[11px] truncate">{notif.body}</div>
                    </td>
                    <td className="py-3 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-surface-darker border border-surface-border text-[11px]">
                        {notif.target_label || notif.target_type}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 capitalize">
                      {notif.category}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                          notif.priority === 'urgent'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : notif.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {notif.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isSent
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isScheduled
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {isSent && <CheckCircle2 className="w-3 h-3" />}
                        {isScheduled && <Clock className="w-3 h-3" />}
                        {isCancelled && <XCircle className="w-3 h-3" />}
                        {notif.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">
                      {notif.delivered_count} / {notif.recipients_count}
                    </td>
                    <td className="py-3 text-slate-400 text-[11px]">
                      {isScheduled && notif.scheduled_at ? (
                        <div className="text-amber-400 font-medium">
                          📅 {new Date(notif.scheduled_at).toLocaleString()}
                        </div>
                      ) : notif.sent_at ? (
                        new Date(notif.sent_at).toLocaleString()
                      ) : (
                        new Date(notif.created_at).toLocaleString()
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {isScheduled ? (
                        <button
                          onClick={() => handleCancelScheduled(notif.id)}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setTitle(notif.title);
                            setBody(notif.body);
                            setCategory(notif.category);
                            setPriority(notif.priority);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Copy
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {notifications.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No push notifications have been sent or scheduled yet.
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
