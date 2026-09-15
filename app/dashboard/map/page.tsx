'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, RefreshCw, Flame, DoorClosed, Navigation, Sparkles } from 'lucide-react';
import DoorHeatmap from '@/components/DoorHeatmap';

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
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-400" />
            Location & Usage Heatmap
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time geospatial density of registered smart doors, caller activity, and regional usage
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMapData}
            className="px-3 py-1.5 bg-surface-card hover:bg-surface-border text-slate-300 rounded-xl text-xs flex items-center gap-1.5 border border-surface-border transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Coordinates</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Verified Doors</span>
            <DoorClosed className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {data?.summary?.doorsWithLocation ?? 0}
            <span className="text-xs font-normal text-slate-500 ml-1.5">
              / {data?.summary?.totalDoors ?? 0} total
            </span>
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Geotagged Rings</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {data?.summary?.ringsWithLocation ?? 0}
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Heat Data Points</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {data?.summary?.totalHeatPoints ?? 0}
          </div>
        </div>

        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Primary Focus</span>
            <Navigation className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white mt-1 truncate">
            {data?.center ? `${data.center.lat.toFixed(3)}, ${data.center.lng.toFixed(3)}` : 'Detecting...'}
          </div>
        </div>
      </div>

      {/* Interactive Map Component */}
      <DoorHeatmap
        doors={data?.doors || []}
        heatPoints={data?.heatPoints || []}
        defaultCenter={data?.center}
        onRefresh={loadMapData}
      />
    </div>
  );
}
