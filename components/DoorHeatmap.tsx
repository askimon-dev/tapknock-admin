'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  MapPin,
  Flame,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  Key,
  CheckCircle2,
  Eye,
  Sliders,
  Compass,
  PhoneCall,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
  label: string;
}

interface DoorMapItem {
  id: string;
  label: string;
  display_name?: string;
  address_line?: string;
  lat: number | string;
  lng: number | string;
  is_active: boolean | number;
  ring_count: number;
  answered_count: number;
  missed_count: number;
  owner_email?: string;
  owner_name?: string;
  public_code?: string;
}

declare global {
  interface Window {
    google?: any;
    L?: any;
    initGoogleMapCallback?: () => void;
  }
}

export default function DoorHeatmap({
  doors = [],
  heatPoints = [],
  defaultCenter = { lat: 24.0813, lng: 88.2447 },
  onRefresh,
}: {
  doors?: DoorMapItem[];
  heatPoints?: HeatPoint[];
  defaultCenter?: { lat: number; lng: number };
  onRefresh?: () => void;
}) {
  const { theme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapProvider, setMapProvider] = useState<'google' | 'leaflet'>('leaflet');
  const [googleKey, setGoogleKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [radius, setRadius] = useState<number>(35);
  const [intensity, setIntensity] = useState<number>(0.8);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [showHeat, setShowHeat] = useState<boolean>(true);
  const [selectedDoor, setSelectedDoor] = useState<DoorMapItem | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Map instance references
  const googleMapInstanceRef = useRef<any>(null);
  const googleHeatmapLayerRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const leafletMapInstanceRef = useRef<any>(null);
  const leafletHeatLayerRef = useRef<any>(null);
  const leafletMarkersRef = useRef<any[]>([]);

  // Load stored Google Maps API key
  useEffect(() => {
    const storedKey =
      localStorage.getItem('tk_google_maps_key') ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      '';
    if (storedKey) {
      setGoogleKey(storedKey);
      setMapProvider('google');
    }
  }, []);

  // Filter valid door points
  const validDoors = useMemo(() => {
    return doors.filter((d) => {
      const lat = parseFloat(String(d.lat));
      const lng = parseFloat(String(d.lng));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }, [doors]);

  // Center calculation
  const center = useMemo(() => {
    if (validDoors.length > 0) {
      const sumLat = validDoors.reduce((acc, d) => acc + parseFloat(String(d.lat)), 0);
      const sumLng = validDoors.reduce((acc, d) => acc + parseFloat(String(d.lng)), 0);
      return { lat: sumLat / validDoors.length, lng: sumLng / validDoors.length };
    }
    if (heatPoints.length > 0) {
      const sumLat = heatPoints.reduce((acc, p) => acc + p.lat, 0);
      const sumLng = heatPoints.reduce((acc, p) => acc + p.lng, 0);
      return { lat: sumLat / heatPoints.length, lng: sumLng / heatPoints.length };
    }
    return defaultCenter;
  }, [validDoors, heatPoints, defaultCenter]);

  // Load Google Maps script when provider is 'google' and key is provided
  useEffect(() => {
    if (mapProvider !== 'google' || !googleKey) return;

    if (window.google?.maps?.visualization) {
      setGoogleLoaded(true);
      return;
    }

    const scriptId = 'google-maps-heatmap-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=visualization&callback=initGoogleMapCallback`;
      script.async = true;
      script.defer = true;
      window.initGoogleMapCallback = () => {
        setGoogleLoaded(true);
      };
      document.head.appendChild(script);
    } else if (window.google?.maps) {
      setGoogleLoaded(true);
    }
  }, [mapProvider, googleKey]);

  // Load Leaflet and Leaflet.heat scripts
  useEffect(() => {
    if (mapProvider !== 'leaflet') return;

    if (window.L && (window.L as any).heatLayer) {
      setLeafletLoaded(true);
      return;
    }

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Leaflet JS
    const loadLeaflet = () => {
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          // Leaflet.heat
          if (!document.getElementById('leaflet-heat-js')) {
            const heatScript = document.createElement('script');
            heatScript.id = 'leaflet-heat-js';
            heatScript.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
            heatScript.onload = () => setLeafletLoaded(true);
            document.head.appendChild(heatScript);
          } else {
            setLeafletLoaded(true);
          }
        };
        document.head.appendChild(script);
      } else if (window.L) {
        setLeafletLoaded(true);
      }
    };

    loadLeaflet();
  }, [mapProvider]);

  // Google Maps Renderer
  useEffect(() => {
    if (mapProvider !== 'google' || !googleLoaded || !mapContainerRef.current) return;

    const darkStyle = [
      { elementType: 'geometry', stylers: [{ color: '#1a2336' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#131b2e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#93a3b8' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#253554' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1525' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    ];

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: center,
      zoom: validDoors.length > 0 ? 14 : 11,
      styles: theme === 'dark' ? darkStyle : [],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
    });
    googleMapInstanceRef.current = map;

    // Heatmap points
    const googleHeatData = heatPoints.map((p) => ({
      location: new window.google.maps.LatLng(p.lat, p.lng),
      weight: p.weight,
    }));

    const heatmap = new window.google.maps.visualization.HeatmapLayer({
      data: googleHeatData,
      radius: radius,
      opacity: intensity,
      map: showHeat ? map : null,
      gradient: [
        'rgba(0, 255, 255, 0)',
        'rgba(0, 255, 255, 1)',
        'rgba(0, 191, 255, 1)',
        'rgba(0, 128, 255, 1)',
        'rgba(0, 0, 255, 1)',
        'rgba(255, 255, 0, 1)',
        'rgba(255, 128, 0, 1)',
        'rgba(255, 0, 0, 1)',
      ],
    });
    googleHeatmapLayerRef.current = heatmap;

    // Door Markers
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];

    if (showPins) {
      validDoors.forEach((door) => {
        const marker = new window.google.maps.Marker({
          position: { lat: parseFloat(String(door.lat)), lng: parseFloat(String(door.lng)) },
          map: map,
          title: door.display_name || door.label,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3b82f6',
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#ffffff',
          },
        });

        marker.addListener('click', () => {
          setSelectedDoor(door);
        });

        googleMarkersRef.current.push(marker);
      });
    }

    return () => {
      heatmap.setMap(null);
      googleMarkersRef.current.forEach((m) => m.setMap(null));
    };
  }, [mapProvider, googleLoaded, center, validDoors, heatPoints, theme]);

  // Leaflet Renderer
  useEffect(() => {
    if (mapProvider !== 'leaflet' || !leafletLoaded || !mapContainerRef.current) return;

    if (leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.remove();
      leafletMapInstanceRef.current = null;
    }

    const L = window.L;
    const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], validDoors.length > 0 ? 14 : 11);
    leafletMapInstanceRef.current = map;

    // Basemap tiles (CartoDB dark or voyager light)
    const tileUrl =
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    }).addTo(map);

    // Heat Layer
    if (showHeat && L.heatLayer) {
      const heatArray = heatPoints.map((p) => [p.lat, p.lng, p.weight]);
      const heat = L.heatLayer(heatArray, {
        radius: radius,
        blur: 20,
        maxZoom: 17,
        max: 5.0,
        gradient: {
          0.2: '#00ffff',
          0.4: '#0077ff',
          0.6: '#ffff00',
          0.8: '#ff7700',
          1.0: '#ff0000',
        },
      }).addTo(map);
      leafletHeatLayerRef.current = heat;
    }

    // Door Markers
    leafletMarkersRef.current = [];
    if (showPins) {
      validDoors.forEach((door) => {
        const marker = L.circleMarker([parseFloat(String(door.lat)), parseFloat(String(door.lng))], {
          radius: 8,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #1e293b; padding: 2px;">
            <strong style="font-size: 14px; color: #0f172a;">${door.display_name || door.label}</strong><br/>
            <span style="color: #64748b;">${door.address_line || 'Location verified'}</span>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-weight: 600;">
              Calls / Rings: ${door.ring_count || 0}
            </div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedDoor(door);
        });

        leafletMarkersRef.current.push(marker);
      });
    }

    return () => {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
      }
    };
  }, [mapProvider, leafletLoaded, center, validDoors, heatPoints, theme]);

  // Adjust heat radius / opacity in real-time
  useEffect(() => {
    if (googleHeatmapLayerRef.current) {
      googleHeatmapLayerRef.current.set('radius', radius);
      googleHeatmapLayerRef.current.set('opacity', intensity);
      googleHeatmapLayerRef.current.setMap(showHeat ? googleMapInstanceRef.current : null);
    }
    if (googleMarkersRef.current) {
      googleMarkersRef.current.forEach((m) => m.setVisible(showPins));
    }
  }, [radius, intensity, showHeat, showPins]);

  const saveGoogleKey = (key: string) => {
    setGoogleKey(key);
    localStorage.setItem('tk_google_maps_key', key);
    setShowKeyInput(false);
    setMapProvider('google');
  };

  const handleCenterOnArea = () => {
    if (googleMapInstanceRef.current) {
      googleMapInstanceRef.current.panTo(center);
      googleMapInstanceRef.current.setZoom(14);
    }
    if (leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([center.lat, center.lng], 14);
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Control Bar */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Toggle */}
          <div className="p-1 bg-surface-darker rounded-xl border border-surface-border flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMapProvider('leaflet')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                mapProvider === 'leaflet'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OpenStreetMap / CartoDB
            </button>
            <button
              type="button"
              onClick={() => {
                if (!googleKey) setShowKeyInput(true);
                setMapProvider('google');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                mapProvider === 'google'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Google Maps</span>
              {!googleKey && (
                <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 rounded">
                  Key required
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="p-2 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-xl border border-surface-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Configure Google Maps API Key"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">API Key</span>
          </button>

          <button
            type="button"
            onClick={handleCenterOnArea}
            className="px-3 py-1.5 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-xl border border-surface-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-brand-400" />
            <span>Focus Active Area</span>
          </button>
        </div>

        {/* Heatmap Filters & Density Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showHeat}
              onChange={(e) => setShowHeat(e.target.checked)}
              className="rounded border-surface-border text-brand-600 focus:ring-0 cursor-pointer"
            />
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Heat Glow</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPins}
              onChange={(e) => setShowPins(e.target.checked)}
              className="rounded border-surface-border text-brand-600 focus:ring-0 cursor-pointer"
            />
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>Door Pins</span>
          </label>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-surface-darker px-3 py-1.5 rounded-xl border border-surface-border">
            <span>Radius:</span>
            <input
              type="range"
              min="15"
              max="65"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              className="w-16 accent-brand-500 cursor-pointer"
            />
            <span className="font-mono text-slate-200">{radius}px</span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 bg-surface-darker hover:bg-surface-border text-slate-300 rounded-xl border border-surface-border transition-colors cursor-pointer"
              title="Refresh Heatmap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Google Key Configuration Drawer */}
      {showKeyInput && (
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <label className="text-xs text-slate-400 mb-1 block">
              Google Maps JavaScript API Key (with Visualization library enabled):
            </label>
            <input
              type="text"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 bg-surface-darker border border-surface-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => saveGoogleKey(googleKey)}
            className="w-full sm:w-auto self-end px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Save & Load</span>
          </button>
        </div>
      )}

      {/* Map Display Viewport */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-border shadow-2xl h-[560px] bg-surface-darkest">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-20 p-3 bg-surface-card/90 backdrop-blur-md rounded-xl border border-surface-border text-xs space-y-2 shadow-lg max-w-xs">
          <div className="font-semibold text-white flex items-center justify-between gap-3">
            <span>Location Density Heatmap</span>
            <span className="text-[10px] text-brand-400 font-mono">
              {validDoors.length} verified doors
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-cyan-400 via-yellow-400 to-red-500" />
            <div className="flex justify-between text-[10px] text-slate-400 w-full">
              <span>Low Usage</span>
              <span>High Ring Activity</span>
            </div>
          </div>
          <div className="text-[10.5px] text-slate-400 leading-tight">
            Heat density reflects door installations and cumulative visitor rings in real-time.
          </div>
        </div>
      </div>

      {/* Selected Door Drawer / Quick Metrics */}
      {selectedDoor && (
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-base">
                {selectedDoor.display_name || selectedDoor.label}
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-medium">
                {selectedDoor.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{selectedDoor.address_line || `Coordinates: ${selectedDoor.lat}, ${selectedDoor.lng}`}</span>
            </p>
            {selectedDoor.owner_email && (
              <p className="text-[11px] text-slate-500">
                Owner: <span className="text-slate-300">{selectedDoor.owner_email}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-surface-darker rounded-xl border border-surface-border text-center min-w-[70px]">
              <span className="text-[10px] text-slate-400 block">Total Calls</span>
              <span className="text-base font-bold text-white block mt-0.5">
                {selectedDoor.ring_count || 0}
              </span>
            </div>
            <div className="p-2.5 bg-surface-darker rounded-xl border border-surface-border text-center min-w-[70px]">
              <span className="text-[10px] text-slate-400 block">Answered</span>
              <span className="text-base font-bold text-emerald-400 block mt-0.5">
                {selectedDoor.answered_count || 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDoor(null)}
              className="p-2 hover:bg-surface-darker rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
