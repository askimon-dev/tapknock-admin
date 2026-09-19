export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'support_lead'
  | 'support_executive'
  | 'marketing'
  | 'developer'
  | 'analyst';

export type Permission =
  // Analytics & Dashboards
  | 'analytics:view'
  | 'analytics:export'
  // Support & Live Chat
  | 'support:view'
  | 'support:respond'
  | 'support:manage'
  | 'support:diagnostics'
  // Location Heatmap
  | 'map:view'
  // Push Notifications
  | 'notifications:view'
  | 'notifications:dispatch'
  // App Releases
  | 'versions:view'
  | 'versions:manage'
  // Database Visualizer
  | 'database:view'
  | 'database:execute'
  // Live Server Logs
  | 'logs:view'
  // Staging Server
  | 'staging:manage'
  // Users & Accounts
  | 'users:view'
  | 'users:manage'
  // Doors & QR Kits
  | 'doors:view'
  | 'doors:manage'
  // Rings & Call Audit
  | 'rings:view'
  | 'rings:manage'
  // Security & Blocklist
  | 'blocklist:view'
  | 'blocklist:manage'
  // System & Health
  | 'system:view'
  | 'system:manage'
  // Staff & Team Governance
  | 'staff:view'
  | 'staff:manage'
  // Audit Logs
  | 'audit:view';

export interface RoleDefinition {
  id: AdminRole;
  name: string;
  badgeLabel: string;
  badgeClass: string; // Tailwind classes for the role badge
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
  defaultLandingPage: string;
  permissions: Permission[];
}

export interface PermissionDefinition {
  id: Permission;
  category: 'Analytics & Insights' | 'Support & Chat' | 'Communication' | 'Releases & Versions' | 'Data & SQL' | 'System & Infra' | 'Users & Doors' | 'Team & Security';
  name: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: Record<Permission, PermissionDefinition> = {
  'analytics:view': {
    id: 'analytics:view',
    category: 'Analytics & Insights',
    name: 'View Analytics',
    description: 'Access overview dashboard, charts, growth trends, and real-time user statistics.',
  },
  'analytics:export': {
    id: 'analytics:export',
    category: 'Analytics & Insights',
    name: 'Export Analytics',
    description: 'Download CSV and JSON reports of system metrics and user activities.',
  },
  'support:view': {
    id: 'support:view',
    category: 'Support & Chat',
    name: 'View Support Tickets',
    description: 'Browse incoming support tickets, filter by status and priority, and read chat transcripts.',
  },
  'support:respond': {
    id: 'support:respond',
    category: 'Support & Chat',
    name: 'Live Chat & Respond',
    description: 'Send live chat messages, share attachments, and interact with customers in real-time.',
  },
  'support:manage': {
    id: 'support:manage',
    category: 'Support & Chat',
    name: 'Manage Support Tickets',
    description: 'Change ticket priority/status, assign tickets to staff, add internal notes, and close tickets.',
  },
  'support:diagnostics': {
    id: 'support:diagnostics',
    category: 'Support & Chat',
    name: 'Inspect Diagnostics',
    description: 'Review full client hardware, OS, battery, RAM, network, and permission telemetry snapshots.',
  },
  'map:view': {
    id: 'map:view',
    category: 'Analytics & Insights',
    name: 'View Location Heatmap',
    description: 'View geographical distribution of online doorbells, rings, and visitor activity.',
  },
  'notifications:view': {
    id: 'notifications:view',
    category: 'Communication',
    name: 'View Push Notifications',
    description: 'Inspect past push notification campaigns, delivery statistics, and scheduled messages.',
  },
  'notifications:dispatch': {
    id: 'notifications:dispatch',
    category: 'Communication',
    name: 'Dispatch Push Campaigns',
    description: 'Compose, schedule, and broadcast real-time push notifications to all users or targeted groups.',
  },
  'versions:view': {
    id: 'versions:view',
    category: 'Releases & Versions',
    name: 'View App Releases',
    description: 'View release history, download statistics, and app version adoption breakdown.',
  },
  'versions:manage': {
    id: 'versions:manage',
    category: 'Releases & Versions',
    name: 'Publish & Manage Releases',
    description: 'Create new releases, upload APK links, toggle mandatory force update flags, and archive versions.',
  },
  'database:view': {
    id: 'database:view',
    category: 'Data & SQL',
    name: 'View Database Schema & Tables',
    description: 'Browse PostgreSQL tables, inspect schema definitions, and view record counts.',
  },
  'database:execute': {
    id: 'database:execute',
    category: 'Data & SQL',
    name: 'Execute SQL Queries',
    description: 'Run arbitrary SELECT, UPDATE, or maintenance SQL queries in the interactive database console.',
  },
  'logs:view': {
    id: 'logs:view',
    category: 'System & Infra',
    name: 'View Live Server Logs',
    description: 'Monitor real-time STDOUT/STDERR logs from production and staging Docker containers.',
  },
  'staging:manage': {
    id: 'staging:manage',
    category: 'System & Infra',
    name: 'Control Staging Environment',
    description: 'Spin up, reset, seed, and stop on-demand staging server containers.',
  },
  'users:view': {
    id: 'users:view',
    category: 'Users & Doors',
    name: 'View Users & Accounts',
    description: 'Search customer accounts, view profile details, email addresses, and registered doorbells.',
  },
  'users:manage': {
    id: 'users:manage',
    category: 'Users & Doors',
    name: 'Manage User Accounts',
    description: 'Edit account properties, suspend abusive users, or assist with account recovery.',
  },
  'doors:view': {
    id: 'doors:view',
    category: 'Users & Doors',
    name: 'View Doors & QR Kits',
    description: 'Inspect registered doors, address locations, QR codes, and household members.',
  },
  'doors:manage': {
    id: 'doors:manage',
    category: 'Users & Doors',
    name: 'Manage Doors & Print Kits',
    description: 'Regenerate QR codes, update door parameters, and re-issue printable PDF door kits.',
  },
  'rings:view': {
    id: 'rings:view',
    category: 'Users & Doors',
    name: 'View Rings & Call Logs',
    description: 'Inspect visitor knock history, ring duration, WebRTC status, and voicemail clips.',
  },
  'rings:manage': {
    id: 'rings:manage',
    category: 'Users & Doors',
    name: 'Manage Call Audit Records',
    description: 'Purge sensitive visitor recordings or ring audit entries upon customer request.',
  },
  'blocklist:view': {
    id: 'blocklist:view',
    category: 'Team & Security',
    name: 'View Security Blocklist',
    description: 'Browse blocked visitor fingerprints, IP addresses, and harassment defense rules.',
  },
  'blocklist:manage': {
    id: 'blocklist:manage',
    category: 'Team & Security',
    name: 'Manage Security Blocklist',
    description: 'Block or unblock visitor fingerprints and manage door security filters.',
  },
  'system:view': {
    id: 'system:view',
    category: 'System & Infra',
    name: 'View System Health',
    description: 'Inspect VPS droplet resource utilization, memory, disk space, and Docker status.',
  },
  'system:manage': {
    id: 'system:manage',
    category: 'System & Infra',
    name: 'Manage System & Services',
    description: 'Restart server containers, trigger cache purges, and modify system settings.',
  },
  'staff:view': {
    id: 'staff:view',
    category: 'Team & Security',
    name: 'View Staff & Roles',
    description: 'Inspect admin team members, role assignments, and account statuses.',
  },
  'staff:manage': {
    id: 'staff:manage',
    category: 'Team & Security',
    name: 'Manage Staff & RBAC',
    description: 'Invite new staff members, assign roles, reset credentials, and suspend team accounts.',
  },
  'audit:view': {
    id: 'audit:view',
    category: 'Team & Security',
    name: 'View Admin Audit Logs',
    description: 'Audit history of actions performed by administrators, executives, and marketing staff.',
  },
};

export const ROLE_DEFINITIONS: Record<AdminRole, RoleDefinition> = {
  super_admin: {
    id: 'super_admin',
    name: 'Super Administrator',
    badgeLabel: 'Super Admin',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-600 dark:text-purple-400',
    badgeBorder: 'border-purple-500/30',
    description: 'Full, unrestricted control over the entire TapKnock infrastructure, database, server logs, team staff, and security policies.',
    defaultLandingPage: '/dashboard',
    permissions: Object.keys(PERMISSION_DEFINITIONS) as Permission[],
  },
  admin: {
    id: 'admin',
    name: 'Administrator',
    badgeLabel: 'Admin',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600 dark:text-blue-400',
    badgeBorder: 'border-blue-500/30',
    description: 'Operations manager with broad permissions to manage users, doors, releases, notifications, and review logs without raw SQL console access.',
    defaultLandingPage: '/dashboard',
    permissions: [
      'analytics:view',
      'analytics:export',
      'support:view',
      'support:respond',
      'support:manage',
      'support:diagnostics',
      'map:view',
      'notifications:view',
      'notifications:dispatch',
      'versions:view',
      'versions:manage',
      'database:view',
      'users:view',
      'users:manage',
      'doors:view',
      'doors:manage',
      'rings:view',
      'rings:manage',
      'blocklist:view',
      'blocklist:manage',
      'system:view',
      'staff:view',
      'audit:view',
    ],
  },
  support_lead: {
    id: 'support_lead',
    name: 'Support Team Lead',
    badgeLabel: 'Support Lead',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    description: 'Leads customer service team. Full ticket lifecycle control, diagnostic inspection, ticket assignment, and customer account lookup.',
    defaultLandingPage: '/dashboard/support',
    permissions: [
      'analytics:view',
      'support:view',
      'support:respond',
      'support:manage',
      'support:diagnostics',
      'users:view',
      'doors:view',
      'rings:view',
      'blocklist:view',
      'blocklist:manage',
      'staff:view',
      'audit:view',
    ],
  },
  support_executive: {
    id: 'support_executive',
    name: 'Support Executive',
    badgeLabel: 'Support Executive',
    badgeClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
    badgeBg: 'bg-teal-500/15',
    badgeText: 'text-teal-600 dark:text-teal-400',
    badgeBorder: 'border-teal-500/30',
    description: 'Frontline customer support. Direct access to live chat, device diagnostic inspection, user search, and knock ring history.',
    defaultLandingPage: '/dashboard/support',
    permissions: [
      'support:view',
      'support:respond',
      'support:diagnostics',
      'users:view',
      'rings:view',
    ],
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing & Growth',
    badgeLabel: 'Marketing',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-500/30',
    description: 'Customer engagement, push notification campaigns, location heatmap demographic insights, and version adoption metrics.',
    defaultLandingPage: '/dashboard',
    permissions: [
      'analytics:view',
      'analytics:export',
      'map:view',
      'notifications:view',
      'notifications:dispatch',
      'versions:view',
      'users:view',
    ],
  },
  developer: {
    id: 'developer',
    name: 'Software Engineer & DevOps',
    badgeLabel: 'Developer',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    badgeBorder: 'border-indigo-500/30',
    description: 'Technical debugging, real-time container log streaming, database SQL console, staging environment control, and release publishing.',
    defaultLandingPage: '/dashboard',
    permissions: [
      'analytics:view',
      'support:view',
      'support:diagnostics',
      'versions:view',
      'versions:manage',
      'database:view',
      'database:execute',
      'logs:view',
      'staging:manage',
      'system:view',
      'system:manage',
      'rings:view',
      'audit:view',
    ],
  },
  analyst: {
    id: 'analyst',
    name: 'Data Analyst',
    badgeLabel: 'Analyst',
    badgeClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-600 dark:text-cyan-400',
    badgeBorder: 'border-cyan-500/30',
    description: 'Read-only business analytics, exportable metrics, location heatmap, version distribution, and audit summaries.',
    defaultLandingPage: '/dashboard',
    permissions: [
      'analytics:view',
      'analytics:export',
      'map:view',
      'versions:view',
      'notifications:view',
      'rings:view',
      'users:view',
      'audit:view',
    ],
  },
};

export const ALL_ROLES = Object.keys(ROLE_DEFINITIONS) as AdminRole[];

/**
 * Check if a role possesses a specific permission
 */
export function hasPermission(role: AdminRole | string, permission: Permission): boolean {
  if (role === 'super_admin') return true;
  const def = ROLE_DEFINITIONS[role as AdminRole];
  if (!def) return false;
  return def.permissions.includes(permission);
}

/**
 * Returns all permissions for a given role
 */
export function getRolePermissions(role: AdminRole | string): Permission[] {
  if (role === 'super_admin') return Object.keys(PERMISSION_DEFINITIONS) as Permission[];
  const def = ROLE_DEFINITIONS[role as AdminRole];
  return def ? def.permissions : [];
}

/**
 * Check if a role can manage another role
 * (e.g. only super_admin can create or edit super_admin or admin; admin cannot modify super_admin)
 */
export function canManageRole(actorRole: AdminRole | string, targetRole: AdminRole | string): boolean {
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'admin') {
    return targetRole !== 'super_admin' && targetRole !== 'admin';
  }
  return false;
}

/**
 * Get landing page based on role
 */
export function getDefaultLandingPage(role: AdminRole | string): string {
  const def = ROLE_DEFINITIONS[role as AdminRole];
  return def ? def.defaultLandingPage : '/dashboard';
}

/**
 * Maps a pathname to the primary permission required to view it
 */
export function getRequiredPermissionForPath(pathname: string): Permission | null {
  if (pathname === '/dashboard') return 'analytics:view';
  if (pathname.startsWith('/dashboard/support')) return 'support:view';
  if (pathname.startsWith('/dashboard/map')) return 'map:view';
  if (pathname.startsWith('/dashboard/notifications')) return 'notifications:view';
  if (pathname.startsWith('/dashboard/versions')) return 'versions:view';
  if (pathname.startsWith('/dashboard/database')) return 'database:view';
  if (pathname.startsWith('/dashboard/logs')) return 'logs:view';
  if (pathname.startsWith('/dashboard/staging')) return 'staging:manage';
  if (pathname.startsWith('/dashboard/users')) return 'users:view';
  if (pathname.startsWith('/dashboard/doors')) return 'doors:view';
  if (pathname.startsWith('/dashboard/rings')) return 'rings:view';
  if (pathname.startsWith('/dashboard/blocklist')) return 'blocklist:view';
  if (pathname.startsWith('/dashboard/system')) return 'system:view';
  if (pathname.startsWith('/dashboard/staff')) return 'staff:view';
  return null;
}
