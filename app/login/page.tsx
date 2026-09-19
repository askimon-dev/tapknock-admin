'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Mail,
  Eye,
  EyeOff,
  Key,
  Users,
  CheckCircle2,
  Headphones,
  Megaphone,
  Code2,
  BarChart3,
  Shield,
} from 'lucide-react';
import TapKnockLogo from '@/components/TapKnockLogo';

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  pass: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const demoAccounts: DemoAccount[] = [
  { name: 'System Admin', email: 'admin@tapknock.com', role: 'Super Admin', pass: 'admin123', icon: Shield, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { name: 'Sarah Jenkins', email: 'support.lead@tapknock.com', role: 'Support Lead', pass: 'lead123', icon: Headphones, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { name: 'Alex Rivera', email: 'support@tapknock.com', role: 'Support Exec', pass: 'support123', icon: Headphones, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  { name: 'Elena Rostova', email: 'marketing@tapknock.com', role: 'Marketing', pass: 'market123', icon: Megaphone, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { name: 'David Chen', email: 'devops@tapknock.com', role: 'DevOps / Eng', pass: 'dev123', icon: Code2, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { name: 'Priya Patel', email: 'analyst@tapknock.com', role: 'Data Analyst', pass: 'analyst123', icon: BarChart3, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
];

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<'staff' | 'master'>('staff');
  const [email, setEmail] = useState('admin@tapknock.com');
  const [password, setPassword] = useState('admin123');
  const [masterSecret, setMasterSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload =
        loginMode === 'staff'
          ? { email: email.trim(), password }
          : { password: masterSecret.trim() };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Navigate to destination
      const destination = data.landing || '/dashboard';
      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (acc: DemoAccount) => {
    setLoginMode('staff');
    setEmail(acc.email);
    setPassword(acc.pass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-darkest via-surface-darker to-[#0a1122] text-slate-100 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-4">
        {/* Main Card */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <TapKnockLogo size={60} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              TapKnock <span className="text-xs uppercase tracking-widest bg-brand-500/20 text-brand-400 px-2.5 py-0.5 rounded font-semibold border border-brand-500/30">Console</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1.5">
              Role-Based Access Control • Live Support • Push Gateway
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-surface-darker p-1 border border-surface-border mb-5">
            <button
              type="button"
              onClick={() => { setLoginMode('staff'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'staff'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('master'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginMode === 'master'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Master Secret</span>
            </button>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginMode === 'staff' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="executive@tapknock.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Master Password or Root Secret Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={masterSecret}
                    onChange={(e) => setMasterSecret(e.target.value)}
                    placeholder="Enter ADMIN_SECRET or ADMIN_PASSWORD"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-surface-darker border border-surface-border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Emergency root login for server maintainers. Grants Super Admin privileges.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-2.5 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-5 text-center text-[11px] text-slate-500">
            Protected instance • TapKnock Smart Doorbell Infrastructure
          </div>
        </div>

        {/* Quick Demo Accounts Selection Box */}
        <div className="bg-surface-card/70 border border-surface-border rounded-2xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand-400" />
              <span>Test Pre-Configured RBAC Roles</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              className="text-[11px] text-brand-400 hover:text-brand-300 underline"
            >
              {showDemoAccounts ? 'Hide Roles' : 'Show Roles'}
            </button>
          </div>

          {showDemoAccounts && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {demoAccounts.map((acc) => {
                const Icon = acc.icon;
                const isSelected = email === acc.email && loginMode === 'staff';
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemoAccount(acc)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-brand-600/20 border-brand-500/50 ring-1 ring-brand-500'
                        : 'bg-surface-darker/70 border-surface-border hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${acc.color}`}>
                        {acc.role}
                      </span>
                      <Icon className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="text-xs font-medium text-slate-200 truncate">{acc.name}</div>
                    <div className="text-[10px] text-slate-500 truncate font-mono">{acc.email}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
