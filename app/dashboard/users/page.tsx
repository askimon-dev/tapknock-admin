'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users,
  Search,
  RefreshCw,
  Smartphone,
  DoorClosed,
  Shield,
  Trash2,
  Key,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import { Account } from '@/lib/types';
import { COHORT_DEFINITIONS } from '@/lib/demographics';

function UsersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialAgeGroup = searchParams.get('age_group') || 'all';

  const [users, setUsers] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState(initialAgeGroup);
  const [loading, setLoading] = useState(true);

  // Sync if query param in URL changes
  useEffect(() => {
    const fromUrl = searchParams.get('age_group');
    if (fromUrl && fromUrl !== ageGroupFilter) {
      setAgeGroupFilter(fromUrl);
    }
  }, [searchParams]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (ageGroupFilter && ageGroupFilter !== 'all') params.set('age_group', ageGroupFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
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
  }, [search, ageGroupFilter]);

  const handleAgeGroupChange = (newVal: string) => {
    setAgeGroupFilter(newVal);
    const params = new URLSearchParams(window.location.search);
    if (newVal === 'all') {
      params.delete('age_group');
    } else {
      params.set('age_group', newVal);
    }
    const queryStr = params.toString();
    router.replace(queryStr ? `/dashboard/users?${queryStr}` : '/dashboard/users');
  };

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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            User & Account Management
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Registered homeowners, age demographics, active sessions, and door permissions
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="self-start sm:self-auto px-3 py-1.5 bg-surface-card hover:bg-surface-darker text-slate-700 dark:text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Demographic Filters */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col md:flex-row items-center gap-3 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts by email, display name, or UUID..."
            className="w-full pl-10 pr-4 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="text-slate-500 text-[11px] whitespace-nowrap">Age Group:</span>
              <select
                value={ageGroupFilter}
                onChange={(e) => handleAgeGroupChange(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white text-xs font-semibold focus:outline-none cursor-pointer pr-2"
              >
                <option value="all" className="bg-slate-900 text-white">All Demographics</option>
                {COHORT_DEFINITIONS.map((def) => (
                  <option key={def.cohort} value={def.cohort} className="bg-slate-900 text-white">
                    {def.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {ageGroupFilter !== 'all' && (
            <button
              onClick={() => handleAgeGroupChange('all')}
              className="px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-surface-darker hover:bg-surface-border border border-surface-border rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
              title="Clear demographic filter"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-card rounded-2xl border border-surface-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-darker/70 border-b border-surface-border text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-semibold">User Profile</th>
                <th className="py-3.5 px-4 font-semibold">Email Address</th>
                <th className="py-3.5 px-4 font-semibold">Age & DOB</th>
                <th className="py-3.5 px-4 font-semibold">Account ID</th>
                <th className="py-3.5 px-4 font-semibold">Doors Owned</th>
                <th className="py-3.5 px-4 font-semibold">Total Rings</th>
                <th className="py-3.5 px-4 font-semibold">Active Sessions</th>
                <th className="py-3.5 px-4 font-semibold">Registered</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-darker/50 transition-colors">
                  {/* User Profile */}
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
                        {user.display_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">{user.display_name || 'Anonymous User'}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {user.email || <span className="text-slate-400 dark:text-slate-500 italic">No email set</span>}
                  </td>

                  {/* Age & DOB */}
                  <td className="py-3 px-4">
                    {user.age !== null && user.age !== undefined ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {user.age} yrs
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAgeGroupChange(user.age_group || 'all')}
                            className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/25 hover:bg-brand-500/20 transition-colors cursor-pointer"
                            title={`Filter by ${user.age_group}`}
                          >
                            {user.age_group}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{user.dob}</span>
                          {user.generation && (
                            <>
                              <span>•</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">{user.generation.split(' (')[0]}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-surface-darker border border-surface-border">
                        Not provided
                      </span>
                    )}
                  </td>

                  {/* Account ID */}
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {user.id.slice(0, 8)}...
                  </td>

                  {/* Doors */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-darker text-slate-700 dark:text-slate-300 border border-surface-border font-medium">
                      <DoorClosed className="w-3 h-3 text-emerald-500" />
                      {user.door_count ?? 0} door(s)
                    </span>
                  </td>

                  {/* Rings */}
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                    {user.ring_count ?? 0}
                  </td>

                  {/* Active Sessions */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Smartphone className="w-3.5 h-3.5" />
                      {user.active_sessions_count ?? 0} device(s)
                    </span>
                  </td>

                  {/* Registered Date */}
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRevokeSessions(user.id)}
                        title="Revoke all device sessions"
                        className="px-2.5 py-1 bg-surface-darker hover:bg-amber-500/10 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 border border-surface-border rounded-lg text-[11px] transition-colors cursor-pointer"
                      >
                        Revoke Sessions
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    {ageGroupFilter !== 'all' ? (
                      <div className="flex flex-col items-center gap-2">
                        <span>No accounts found in age group "{ageGroupFilter}".</span>
                        <button
                          onClick={() => handleAgeGroupChange('all')}
                          className="text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                        >
                          Clear demographic filter
                        </button>
                      </div>
                    ) : (
                      'No accounts found matching your query.'
                    )}
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

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  );
}
