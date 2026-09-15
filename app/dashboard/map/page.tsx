'use client';

import React, { useState, useEffect, Component, ReactNode } from 'react';
import { MapPin, RefreshCw, Flame, DoorClosed, Navigation, Sparkles, AlertTriangle } from 'lucide-react';
import DoorHeatmap from '@/components/DoorHeatmap';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Map component error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('tk_google_maps_key');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-surface-card rounded-2xl border border-surface-border text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Map Display Exception</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            A client-side exception occurred while rendering the map ({this.state.error?.message || 'External script error'}).
            Click below to clear stored map configuration and restore default OpenStreetMap.
          </p>
          <div className="pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Reset Map & Switch to OpenStreetMap
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MapPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/map');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            Location & Usage Heatmap
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Real-time geospatial density of registered smart doors, caller activity, and regional usage
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMapData}
            className="px-3 py-1.5 bg-surface-card hover:bg-slate-100 dark:hover:bg-surface-border text-slate-700 dark:text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer font-medium shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Coordinates</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Verified Doors</span>
            <DoorClosed className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {data?.summary?.doorsWithLocation ?? 0}
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1.5">
              / {data?.summary?.totalDoors ?? 0} total
            </span>
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Geotagged Rings</span>
            <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {data?.summary?.ringsWithLocation ?? 0}
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Heat Data Points</span>
            <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {data?.summary?.totalHeatPoints ?? 0}
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Primary Focus</span>
            <Navigation className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
            {data?.center ? `${data.center.lat.toFixed(3)}, ${data.center.lng.toFixed(3)}` : 'Detecting...'}
          </div>
        </div>
      </div>

      {/* Interactive Map Component with Error Boundary */}
      <MapErrorBoundary>
        <DoorHeatmap
          doors={data?.doors || []}
          heatPoints={data?.heatPoints || []}
          defaultCenter={data?.center}
          onRefresh={loadMapData}
        />
      </MapErrorBoundary>
    </div>
  );
}
