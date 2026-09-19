'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Headphones,
  Megaphone,
  Code2,
  BarChart3,
  UserPlus,
  Edit2,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Check,
  Minus,
  Info,
} from 'lucide-react';
import {
  AdminRole,
  Permission,
  ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
  ALL_ROLES,
  hasPermission,
} from '@/lib/rbac';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  avatar_url?: string | null;
  phone?: string | null;
  status: 'active' | 'suspended' | 'invited';
  last_login_at?: string | null;
  last_login_ip?: string | null;
  created_at: string;
  updated_at: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'directory' | 'matrix'>('directory');
  const [currentUserRole, setCurrentUserRole] = useState<string>('super_admin');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [resetPassUser, setResetPassUser] = useState<StaffUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'support_executive' as AdminRole,
    password: '',
    phone: '',
  });
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff');
      const data = await res.json();
      if (res.ok && data.staff) {
        setStaff(data.staff);
        if (data.currentUserRole) setCurrentUserRole(data.currentUserRole);
      }
    } catch (err) {
      console.error('Failed to load staff members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create staff member');
      }
      setSuccessMsg(`Staff member ${formData.name} added successfully`);
      setShowAddModal(false);
      setFormData({ name: '', email: '', role: 'support_executive', password: '', phone: '' });
      fetchStaff();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/staff/${editingStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingStaff.name,
          role: editingStaff.role,
          status: editingStaff.status,
          phone: editingStaff.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update staff member');
      }
      setSuccessMsg(`Updated ${editingStaff.name} successfully`);
      setEditingStaff(null);
      fetchStaff();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/staff/${resetPassUser.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPasswordVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }
      setSuccessMsg(`Password reset for ${resetPassUser.name}`);
      setResetPassUser(null);
      setResetPasswordVal('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the staff?`)) return;
    try {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to delete staff member');
        return;
      }
      setSuccessMsg(`Staff member ${name} deleted`);
      fetchStaff();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group permissions by category for the matrix
  const permissionsList = Object.values(PERMISSION_DEFINITIONS);
  const categories = Array.from(new Set(permissionsList.map((p) => p.category)));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card border border-surface-border p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-brand-500" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Staff & Role-Based Access Control (RBAC)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define fine-grained team roles, enforce access controls, and manage administrative accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-surface-darker p-1 border border-surface-border text-xs">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                activeTab === 'directory'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Team Directory ({staff.length})
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                activeTab === 'matrix'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Role Permission Matrix
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer keep-white"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span className="text-white">Invite Staff</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'directory' ? (
        /* Team Directory Tab */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search staff by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-card border border-surface-border rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              onClick={fetchStaff}
              title="Refresh Directory"
              className="p-2 bg-surface-card border border-surface-border hover:bg-surface-darker text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Directory Table */}
          <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-darker border-b border-surface-border text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span>Loading staff directory...</span>
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No staff members found matching "{searchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((user) => {
                      const roleDef = ROLE_DEFINITIONS[user.role];
                      const isSuper = user.role === 'super_admin';
                      return (
                        <tr key={user.id} className="hover:bg-surface-darker/50 transition-colors">
                          {/* Member */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-500 font-bold flex items-center justify-center text-xs">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {user.email === 'admin@tapknock.com' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 font-semibold border border-amber-500/30">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${roleDef?.badgeClass || 'bg-slate-500/15 text-slate-400'}`}>
                              {roleDef?.name || user.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                user.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <span className="capitalize">{user.status}</span>
                            </span>
                          </td>

                          {/* Last Activity */}
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {user.last_login_at ? (
                              <div>
                                <div>{new Date(user.last_login_at).toLocaleDateString()}</div>
                                <div className="text-[10px] text-slate-600 font-mono">
                                  {user.last_login_ip || 'IP hidden'}
                                </div>
                              </div>
                            ) : (
                              <span>Never logged in</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setEditingStaff(user)}
                                title="Edit Role & Status"
                                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-surface-darker rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setResetPassUser(user); setResetPasswordVal(''); }}
                                title="Reset Password"
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-surface-darker rounded-lg transition-colors cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              {user.email !== 'admin@tapknock.com' && (
                                <button
                                  onClick={() => handleDeleteStaff(user.id, user.name)}
                                  title="Delete Account"
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-surface-darker rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Role Permission Matrix Tab */
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Role Access & Permission Matrix
            </h2>
            <p className="text-xs text-slate-500">
              System capabilities granted to each administrative tier across the platform.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-surface-border text-[11px]">
                  <th className="py-3 px-4 bg-surface-darker/60 font-bold text-slate-700 dark:text-slate-300 w-64">
                    Capability / Permission
                  </th>
                  {ALL_ROLES.map((r) => {
                    const rDef = ROLE_DEFINITIONS[r];
                    return (
                      <th key={r} className="py-3 px-3 text-center min-w-[110px]">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${rDef.badgeClass}`}>
                          {rDef.badgeLabel}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {categories.map((cat) => {
                  const catPerms = permissionsList.filter((p) => p.category === cat);
                  return (
                    <React.Fragment key={cat}>
                      <tr className="bg-surface-darker/80 font-bold text-[10px] text-brand-500 uppercase tracking-wider">
                        <td colSpan={ALL_ROLES.length + 1} className="py-2 px-4">
                          {cat}
                        </td>
                      </tr>
                      {catPerms.map((perm) => (
                        <tr key={perm.id} className="hover:bg-surface-darker/30 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{perm.name}</div>
                            <div className="text-[10px] text-slate-500">{perm.description}</div>
                          </td>
                          {ALL_ROLES.map((role) => {
                            const isAllowed = hasPermission(role, perm.id);
                            return (
                              <td key={role} className="py-2.5 px-3 text-center">
                                {isAllowed ? (
                                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center mx-auto">
                                    <Minus className="w-3 h-3" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Invite / Add Staff */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Invite New Staff Member</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. alex@tapknock.com"
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  {ALL_ROLES.map((r) => {
                    const rDef = ROLE_DEFINITIONS[r];
                    return (
                      <option key={r} value={r}>
                        {rDef.name} ({rDef.badgeLabel})
                      </option>
                    );
                  })}
                </select>

                {/* Role description preview */}
                <div className="mt-2 p-2.5 bg-surface-darker rounded-xl border border-surface-border text-[11px] text-slate-400">
                  <div className="font-semibold text-slate-200 mb-0.5">
                    {ROLE_DEFINITIONS[formData.role].name}
                  </div>
                  <div>{ROLE_DEFINITIONS[formData.role].description}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Initial Password</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generateRandomPassword() })}
                    className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 555-0199"
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-surface-darker hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/25 keep-white"
                >
                  {actionLoading ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff Member */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Edit Staff Details</h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleUpdateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role Assignment</label>
                <select
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value as AdminRole })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_DEFINITIONS[r].name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Status</label>
                <select
                  value={editingStaff.status}
                  onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  <option value="active">Active (Access Granted)</option>
                  <option value="suspended">Suspended (Access Revoked)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editingStaff.phone || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 bg-surface-darker hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/25 keep-white"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Reset Staff Password</h3>
              </div>
              <button
                onClick={() => setResetPassUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter a new temporary or permanent password for <strong className="text-slate-200">{resetPassUser.name}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">New Password</label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordVal(generateRandomPassword())}
                    className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setResetPassUser(null)}
                  className="px-4 py-2 bg-surface-darker hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/25 keep-white"
                >
                  {actionLoading ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
