'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, AdminRole, Permission, getDefaultLandingPage } from '@/lib/rbac';

export default function ForbiddenPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const required = searchParams.get('required') as Permission | null;
  const path = searchParams.get('path') || '/';
  const role = (searchParams.get('role') || 'support_executive') as AdminRole;

  const roleDef = ROLE_DEFINITIONS[role];
  const permDef = required ? PERMISSION_DEFINITIONS[required] : null;
  const homePath = getDefaultLandingPage(role);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface-card border border-surface-border rounded-2xl p-8 text-center shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 mx-auto flex items-center justify-center mb-6">
          <Lock className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Access Restricted (403)
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          You do not have permission to access <code className="px-1.5 py-0.5 rounded bg-surface-darker text-slate-700 dark:text-slate-300 text-xs font-mono">{path}</code>.
        </p>

        {/* Role & Permission info */}
        <div className="bg-surface-darker border border-surface-border rounded-xl p-4 text-left mb-6 space-y-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your Current Role</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${roleDef?.badgeClass || 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                {roleDef?.name || role}
              </span>
            </div>
          </div>

          {permDef && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Required Permission</div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                {permDef.name} (<span className="font-mono text-[11px] text-brand-500">{permDef.id}</span>)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {permDef.description}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-surface-darker hover:bg-slate-200 dark:hover:bg-slate-800 border border-surface-border rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <a
            href={homePath}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-brand-600/20 transition-all flex items-center gap-1.5 cursor-pointer keep-white"
          >
            <Home className="w-4 h-4 text-white" />
            <span className="text-white">Go to Your Home</span>
          </a>
        </div>
      </div>
    </div>
  );
}
