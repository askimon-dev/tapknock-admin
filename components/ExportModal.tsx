'use client';

import React, { useState } from 'react';
import {
  Download,
  X,
  FileSpreadsheet,
  FileJson,
  PhoneCall,
  DoorClosed,
  Users,
  BarChart3,
  Database,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'overview' | 'doors' | 'rings' | 'users' | 'all';
}

export default function ExportModal({ isOpen, onClose, defaultType = 'rings' }: ExportModalProps) {
  const [source, setSource] = useState<'prod' | 'staging'>('prod');
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerDownload = (type: string, format: 'csv' | 'json') => {
    const key = `${type}-${format}`;
    setDownloading(key);
    const url = `/api/export?type=${type}&source=${source}&format=${format}`;
    
    // Create an invisible anchor to initiate native browser download
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(null);
    }, 1500);
  };

  const handleDownloadAll = async () => {
    setDownloading('all-batch');
    const items = ['overview', 'doors', 'rings', 'users'];
    for (const item of items) {
      triggerDownload(item, 'csv');
      await new Promise((r) => setTimeout(r, 600));
    }
    setDownloading(null);
  };

  const exportOptions = [
    {
      id: 'rings',
      title: 'Calls & Rings Audit',
      description: 'Full interaction records with caller GPS, duration, outcomes, trust levels, and media logs.',
      icon: PhoneCall,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      badge: 'Most Detailed',
    },
    {
      id: 'doors',
      title: 'Doors & Smart Access Points',
      description: 'Registered doors, QR codes, GPS coordinates, geofence radius, owner emails, and lifetime calls.',
      icon: DoorClosed,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      badge: 'Geotagged',
    },
    {
      id: 'users',
      title: 'Users & Accounts Directory',
      description: 'Resident accounts, verified emails, addresses, postal areas, and doors owned.',
      icon: Users,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      badge: 'Directory',
    },
    {
      id: 'overview',
      title: 'Executive Analytics Summary',
      description: 'High-level KPIs, pickup answer rates, daily ring volumes, and outcome distributions.',
      icon: BarChart3,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      badge: 'KPI Report',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-card border border-surface-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-surface-border mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Export Detailed Analytics Data
              </h2>
              <p className="text-xs text-slate-400">
                Generate UTF-8 CSV spreadsheets (Excel/Sheets ready) or complete JSON bundles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-darker transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Source Switcher */}
        <div className="mb-5 p-3.5 bg-surface-darker rounded-2xl border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-brand-400" />
            <div>
              <span className="text-xs font-semibold text-white block">Data Source</span>
              <span className="text-[11px] text-slate-400 block">
                Select whether to export live production data or historical staging test data
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-surface-card rounded-xl border border-surface-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSource('prod')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                source === 'prod'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Production (Live)
            </button>
            <button
              type="button"
              onClick={() => setSource('staging')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                source === 'staging'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Staging (Test Data)
            </button>
          </div>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {exportOptions.map((opt) => {
            const Icon = opt.icon;
            const isCsvLoading = downloading === `${opt.id}-csv`;
            const isJsonLoading = downloading === `${opt.id}-json`;

            return (
              <div
                key={opt.id}
                className="p-4 bg-surface-darker/60 rounded-2xl border border-surface-border hover:border-surface-border/80 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg border ${opt.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-white text-xs">{opt.title}</h4>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-card text-slate-400 border border-surface-border">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    {opt.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-surface-border/50">
                  <button
                    type="button"
                    onClick={() => triggerDownload(opt.id, 'csv')}
                    disabled={isCsvLoading}
                    className="flex-1 py-1.5 px-2.5 bg-surface-card hover:bg-surface-border text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isCsvLoading ? 'Exporting...' : 'Export CSV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerDownload(opt.id, 'json')}
                    disabled={isJsonLoading}
                    className="py-1.5 px-2.5 bg-surface-card hover:bg-surface-border text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
                    title="Download JSON format"
                  >
                    <FileJson className="w-3.5 h-3.5 text-blue-400" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Master Bundle Actions */}
        <div className="p-4 bg-gradient-to-r from-brand-600/10 via-surface-darker to-brand-600/10 rounded-2xl border border-brand-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-0.5 text-left">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Complete Analytics Bundle (Data Lake Export)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Download all relational datasets in a unified JSON database bundle or batch download all CSV spreadsheets.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloading === 'all-batch'}
              className="flex-1 sm:flex-initial py-2 px-3 bg-surface-card hover:bg-surface-border text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Batch All CSVs</span>
            </button>

            <button
              type="button"
              onClick={() => triggerDownload('all', 'json')}
              disabled={downloading === 'all-json'}
              className="flex-1 sm:flex-initial py-2 px-3.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-brand-600/20 transition-all cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Complete JSON Bundle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
