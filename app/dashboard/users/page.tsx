'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Smartphone, DoorClosed, Shield, Trash2, Key, CheckCircle, Clock } from 'lucide-react';
import { Account } from '@/lib/types';

export default function UsersPage() {
  const [users, setUsers] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Account | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search]);

  const handleRevokeSessions = async (id: string) => {
    if (!confirm('Revoke all active device sessions for this user? They will be signed out on all phones.')) return;
    try {
      const res = await fetch(`/api/users?id=${id}&action=revoke_sessions`, { method: 'DELETE' });
      if (res.ok) {
        alert('All active sessions revoked successfully.');
        loadUsers();
      }
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            User & Account Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered homeowners, active sessions, and door permissions
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts by email, display name, or UUID..."
            className="w-full pl-10 pr-4 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-darker/60 border-b border-surface-border text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-medium">User Profile</th>
                <th className="py-3.5 px-4 font-medium">Email Address</th>
                <th className="py-3.5 px-4 font-medium">Account ID</th>
                <th className="py-3.5 px-4 font-medium">Doors Owned</th>
                <th className="py-3.5 px-4 font-medium">Total Rings</th>
                <th className="py-3.5 px-4 font-medium">Active Sessions</th>
                <th className="py-3.5 px-4 font-medium">Registered Date</th>
                <th className="py-3.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-darker/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                      {user.display_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                    <span className="font-semibold text-white">{user.display_name || 'Anonymous User'}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {user.email || <span className="text-slate-500 italic">No email set</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {user.id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-darker text-slate-300 border border-surface-border">
                      <DoorClosed className="w-3 h-3 text-emerald-400" />
                      {user.door_count ?? 0} door(s)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {user.ring_count ?? 0}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <Smartphone className="w-3.5 h-3.5" />
                      {user.active_sessions_count ?? 0} device(s)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRevokeSessions(user.id)}
                        title="Revoke all device sessions"
                        className="px-2.5 py-1 bg-surface-darker hover:bg-amber-500/10 hover:text-amber-400 text-slate-400 border border-surface-border rounded-lg text-[11px] transition-colors cursor-pointer"
                      >
                        Revoke Sessions
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No accounts found matching your query.
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
