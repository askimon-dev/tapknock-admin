'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BellRing,
  Users,
  DoorClosed,
  PhoneCall,
  ShieldAlert,
  Server,
  LogOut,
  Send,
  Radio,
  Menu,
  X,
  ExternalLink,
  Smartphone,
  Cpu,
  MapPin,
  Database,
  Terminal,
  MessageSquare,
  ShieldCheck,
  Eye,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import TapKnockLogo from '@/components/TapKnockLogo';
import ThemeToggle from '@/components/ThemeToggle';
import {
  AdminRole,
  Permission,
  ROLE_DEFINITIONS,
  ALL_ROLES,
  hasPermission,
} from '@/lib/rbac';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  permission: Permission;
}

const navItems: NavItem[] = [
  { label: 'Overview & Analytics', href: '/dashboard', icon: LayoutDashboard, permission: 'analytics:view' },
  { label: 'Support & Live Chat', href: '/dashboard/support', icon: MessageSquare, badge: 'Live Chat', permission: 'support:view' },
  { label: 'Location Heatmap', href: '/dashboard/map', icon: MapPin, badge: 'Live', permission: 'map:view' },
  { label: 'Push Notifications', href: '/dashboard/notifications', icon: BellRing, badge: 'Crucial', permission: 'notifications:view' },
  { label: 'App Versions', href: '/dashboard/versions', icon: Smartphone, badge: 'Releases', permission: 'versions:view' },
  { label: 'Database Visualizer', href: '/dashboard/database', icon: Database, badge: 'Dev & SQL', permission: 'database:view' },
  { label: 'Live Server Logs', href: '/dashboard/logs', icon: Terminal, badge: 'Realtime', permission: 'logs:view' },
  { label: 'Staging Server', href: '/dashboard/staging', icon: Cpu, badge: 'On-Demand', permission: 'staging:manage' },
  { label: 'Users & Accounts', href: '/dashboard/users', icon: Users, permission: 'users:view' },
  { label: 'Doors & QR Kits', href: '/dashboard/doors', icon: DoorClosed, permission: 'doors:view' },
  { label: 'Rings & Call Audit', href: '/dashboard/rings', icon: PhoneCall, permission: 'rings:view' },
  { label: 'Security & Blocklist', href: '/dashboard/blocklist', icon: ShieldAlert, permission: 'blocklist:view' },
  { label: 'Staff & Team Roles', href: '/dashboard/staff', icon: ShieldCheck, badge: 'RBAC', permission: 'staff:view' },
  { label: 'System & Health', href: '/dashboard/system', icon: Server, permission: 'system:view' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveStats, setLiveStats] = useState<{ online_devices: number; total_accounts: number } | null>(null);

  // User Profile and RBAC state
  const [userProfile, setUserProfile] = useState<{
    userId: string;
    email: string;
    name: string;
    role: AdminRole;
    activeRole: AdminRole;
    isPreview: boolean;
    permissions: Permission[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          setUserProfile(data.user);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchUserProfile();

    async function checkLive() {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const data = await res.json();
          setLiveStats({
            online_devices: data.activeOnlineDevices || 0,
            total_accounts: data.totalAccounts || 0,
          });
        }
      } catch {}
    }
    checkLive();
    const interval = setInterval(checkLive, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const handleSwitchPreviewRole = async (targetRole: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/auth/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole: targetRole === userProfile?.role ? null : targetRole }),
      });
      if (res.ok) {
        await fetchUserProfile();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExitPreview = async () => {
    if (!userProfile) return;
    await handleSwitchPreviewRole(userProfile.role);
  };

  // Filter navigation items by active role's permissions
  const activeRole = userProfile?.activeRole || 'super_admin';
  const roleDef = ROLE_DEFINITIONS[activeRole as AdminRole];
  const isSuper = userProfile?.role === 'super_admin';

  const accessibleNavItems = navItems.filter((item) =>
    hasPermission(activeRole, item.permission)
  );

  const canDispatchPush = hasPermission(activeRole, 'notifications:dispatch');

  return (
    <div className="min-h-screen bg-surface-darkest flex flex-col md:flex-row text-slate-800 dark:text-slate-100">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-card border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <TapKnockLogo size={28} />
          <span className="font-bold text-slate-900 dark:text-white tracking-tight">TapKnock Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-surface-darker"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-surface-card border-r border-surface-border flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Brand */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TapKnockLogo size={36} />
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight text-sm flex items-center gap-1.5">
                TapKnock{' '}
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${roleDef?.badgeClass || 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/20 dark:text-brand-400 dark:border-brand-500/30'}`}>
                  {roleDef?.badgeLabel || 'Admin'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>PostgreSQL 16</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Send Push Action button (if role has dispatch permission) */}
        {canDispatchPush && (
          <div className="px-4 pt-4 pb-2">
            <a
              href="/dashboard/notifications"
              className="w-full py-2.5 px-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white keep-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              <span className="text-white">Dispatch Push</span>
            </a>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {accessibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25 keep-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isActive
                        ? 'bg-white/25 text-white border border-white/20 keep-white'
                        : 'bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/20 dark:text-brand-400 dark:border-brand-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Live Status Widget in Sidebar Footer */}
        <div className="p-3 mx-3 mb-3 bg-surface-darker rounded-xl border border-surface-border text-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              Signaling Gateway
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 font-bold dark:bg-emerald-500/10 px-1.5 py-0.2 rounded border dark:border-emerald-500/20">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>Online Devices:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {liveStats ? liveStats.online_devices : '1'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            <span>Registered Accounts:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {liveStats ? liveStats.total_accounts : '4'}
            </span>
          </div>
        </div>

        {/* User Profile & Logout in Sidebar Footer */}
        <div className="p-3 border-t border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-500 shrink-0">
              {userProfile ? userProfile.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {userProfile ? userProfile.name : 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-mono">
                {userProfile ? userProfile.email : 'admin@tapknock.com'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-surface-darker rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Preview Mode Alert Banner */}
        {userProfile?.isPreview && (
          <div className="bg-amber-500 text-slate-950 px-6 py-2 text-xs font-semibold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-950" />
              <span>
                <strong>Role Preview Active:</strong> You are viewing the console as{' '}
                <span className="underline font-bold">{roleDef?.name}</span>. Navigation and permissions reflect this role.
              </span>
            </div>
            <button
              onClick={handleExitPreview}
              className="px-3 py-1 bg-slate-950 text-white hover:bg-slate-900 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Exit Preview</span>
            </button>
          </div>
        )}

        {/* Top Header */}
        <header className="h-14 border-b border-surface-border bg-surface-card/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              {pathname === '/dashboard'
                ? 'Overview & Analytics'
                : pathname.replace('/dashboard/', '').replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Super Admin Preview Switcher Dropdown */}
            {isSuper && (
              <div className="hidden lg:flex items-center gap-2 bg-surface-darker px-3 py-1 rounded-xl border border-surface-border text-xs">
                <span className="text-slate-500 text-[11px] flex items-center gap-1 font-medium">
                  <Eye className="w-3.5 h-3.5 text-brand-400" />
                  <span>Preview as:</span>
                </span>
                <select
                  value={activeRole}
                  disabled={previewLoading}
                  onChange={(e) => handleSwitchPreviewRole(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-surface-card text-slate-900 dark:text-white">
                      {ROLE_DEFINITIONS[r].name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Droplet backend pill */}
            <div className="hidden sm:flex items-center gap-2 text-xs bg-surface-card px-3 py-1.5 rounded-full border border-surface-border text-slate-700 dark:text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Droplet: 64.227.155.199</span>
            </div>

            <ThemeToggle />

            <a
              href="https://tapknock.generalquery.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 bg-surface-card hover:bg-surface-darker px-3 py-1.5 rounded-full border border-surface-border transition-colors font-medium"
            >
              <span>Main App</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
