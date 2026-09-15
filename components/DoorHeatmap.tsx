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
  AlertTriangle,
  Trash2,
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
    gm_authFailure?: () => void;
  }
}

interface HeatmapOverlayOptions {
  radius?: number;
  intensity?: number;
  opacity?: number;
  visible?: boolean;
}

interface ICanvasHeatmapOverlay {
  setRadius: (r: number) => void;
  setIntensity: (int: number) => void;
  setOpacity: (op: number) => void;
  setVisible: (v: boolean) => void;
  setPoints: (pts: any[]) => void;
  setMap: (map: any) => void;
  draw: () => void;
}

// Generate 256-step heatmap color palette (cyan -> blue -> green -> yellow -> red)
function createHeatmapPalette(): Uint8ClampedArray {
  if (typeof document === 'undefined') return new Uint8ClampedArray(1024);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(1024);

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(0, 255, 255, 0)');
  grad.addColorStop(0.2, 'rgba(0, 255, 255, 0.7)');
  grad.addColorStop(0.4, 'rgba(0, 255, 128, 0.8)');
  grad.addColorStop(0.6, 'rgba(255, 255, 0, 0.85)');
  grad.addColorStop(0.8, 'rgba(255, 128, 0, 0.95)');
  grad.addColorStop(1.0, 'rgba(255, 0, 0, 1.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

// Custom Google Maps HTML5 Canvas Heatmap Overlay (Replaces deprecated HeatmapLayer)
function createCanvasHeatmapOverlay(
  googleMaps: any,
  map: any,
  points: HeatPoint[],
  options: HeatmapOverlayOptions = {}
): ICanvasHeatmapOverlay | null {
  if (!googleMaps || !googleMaps.OverlayView) return null;

  function HeatmapOverlay(this: any) {
    this.points = points || [];
    this.radius = options.radius || 35;
    this.intensity = options.intensity ?? 0.8;
    this.opacity = options.opacity ?? 0.8;
    this.visible = options.visible ?? true;
    this.canvas = null as HTMLCanvasElement | null;
    this.ctx = null as CanvasRenderingContext2D | null;
    this.palette = createHeatmapPalette();
    this.setMap(map);
  }

  HeatmapOverlay.prototype = new googleMaps.OverlayView();

  HeatmapOverlay.prototype.onAdd = function () {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const panes = this.getPanes();
    if (panes?.overlayLayer) {
      panes.overlayLayer.appendChild(canvas);
    }
  };

  HeatmapOverlay.prototype.draw = function () {
    if (!this.canvas || !this.ctx) return;
    if (!this.visible) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const projection = this.getProjection();
    if (!projection) return;

    const mapInstance = this.getMap();
    if (!mapInstance) return;

    const bounds = mapInstance.getBounds();
    if (!bounds) return;

    const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
    const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
    if (!sw || !ne) return;

    const left = Math.min(sw.x, ne.x);
    const top = Math.min(sw.y, ne.y);
    const width = Math.max(1, Math.round(Math.abs(ne.x - sw.x)));
    const height = Math.max(1, Math.round(Math.abs(sw.y - ne.y)));

    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    if (!this.points || this.points.length === 0) return;

    // 1. Draw radial gradient alpha circles
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const lat = typeof p.lat === 'number' ? p.lat : parseFloat(p.lat);
      const lng = typeof p.lng === 'number' ? p.lng : parseFloat(p.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      const latLng = new googleMaps.LatLng(lat, lng);
      const pixel = projection.fromLatLngToDivPixel(latLng);
      if (!pixel) continue;

      const x = pixel.x - left;
      const y = pixel.y - top;

      if (x < -this.radius || x > width + this.radius || y < -this.radius || y > height + this.radius) {
        continue;
      }

      const radGrad = ctx.createRadialGradient(x, y, 0, x, y, this.radius);
      const weight = p.weight || 1;
      const alpha = Math.min(1, Math.max(0.15, (weight * 0.25) * this.intensity));
      radGrad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(x, y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Colorize alpha channels
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const pal = this.palette;
      const op = this.opacity;

      for (let j = 0; j < data.length; j += 4) {
        const a = data[j + 3];
        if (a > 0) {
          const offset = a * 4;
          data[j] = pal[offset];
          data[j + 1] = pal[offset + 1];
          data[j + 2] = pal[offset + 2];
          data[j + 3] = Math.round(pal[offset + 3] * op);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignore if canvas data read failed
    }
  };

  HeatmapOverlay.prototype.onRemove = function () {
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  };

  HeatmapOverlay.prototype.setRadius = function (r: number) {
    this.radius = r;
    this.draw();
  };

  HeatmapOverlay.prototype.setIntensity = function (int: number) {
    this.intensity = int;
    this.draw();
  };

  HeatmapOverlay.prototype.setOpacity = function (op: number) {
    this.opacity = op;
    this.draw();
  };

  HeatmapOverlay.prototype.setVisible = function (v: boolean) {
    this.visible = v;
    this.draw();
  };

  HeatmapOverlay.prototype.setPoints = function (pts: any[]) {
    this.points = pts || [];
    this.draw();
  };

  return new (HeatmapOverlay as any)();
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
  const [mapError, setMapError] = useState<string | null>(null);

  // Map instance references
  const googleMapInstanceRef = useRef<any>(null);
  const googleHeatmapOverlayRef = useRef<ICanvasHeatmapOverlay | null>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const leafletMapInstanceRef = useRef<any>(null);
  const leafletHeatLayerRef = useRef<any>(null);
  const leafletMarkersRef = useRef<any[]>([]);

  // Load stored Google Maps API key
  useEffect(() => {
    try {
      const storedKey =
        localStorage.getItem('tk_google_maps_key') ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        '';
      if (storedKey) {
        setGoogleKey(storedKey);
        setMapProvider('google');
      }
    } catch {
      // LocalStorage access safe
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

    if (window.google?.maps?.Map) {
      setGoogleLoaded(true);
      return;
    }

    // Capture auth failure cleanly without crashing
    window.gm_authFailure = () => {
      console.warn('Google Maps API authentication failure detected');
      setMapError(
        'Google Maps authentication failed. Please verify that your API key is valid and Maps JavaScript API is enabled in Google Cloud Console.'
      );
    };

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (script && !script.src.includes(`key=${googleKey}`)) {
      script.remove();
      script = null;
    }

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&callback=initGoogleMapCallback`;
      script.async = true;
      script.defer = true;

      script.onerror = () => {
        setMapError('Failed to load Google Maps script. Check your internet connection or adblocker.');
      };

      window.initGoogleMapCallback = () => {
        setGoogleLoaded(true);
        setMapError(null);
      };

      document.head.appendChild(script);
    } else if (window.google?.maps?.Map) {
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

    try {
      // Clear any DOM residue from other map renderers
      mapContainerRef.current.innerHTML = '';
      mapContainerRef.current.className = 'w-full h-full z-10';

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

      // Custom Canvas Heatmap Overlay (No deprecated HeatmapLayer)
      const overlay = createCanvasHeatmapOverlay(window.google.maps, map, heatPoints, {
        radius,
        intensity,
        opacity: intensity,
        visible: showHeat,
      });
      googleHeatmapOverlayRef.current = overlay;

      // Keep overlay updated during map interaction
      const boundsListener = map.addListener('bounds_changed', () => {
        overlay?.draw();
      });

      // Door Markers & InfoWindows
      googleMarkersRef.current.forEach((m) => m?.setMap?.(null));
      googleMarkersRef.current = [];

      if (showPins) {
        validDoors.forEach((door) => {
          const lat = parseFloat(String(door.lat));
          const lng = parseFloat(String(door.lng));
          if (isNaN(lat) || isNaN(lng)) return;

          const marker = new window.google.maps.Marker({
            position: { lat, lng },
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

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #0f172a; padding: 4px; min-width: 160px;">
                <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 2px;">
                  ${door.display_name || door.label}
                </div>
                <div style="color: #64748b; font-size: 11px;">
                  ${door.address_line || 'Verified Door'}
                </div>
                <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-weight: 600;">
                  <span>Total Calls:</span>
                  <span style="color: #2563eb;">${door.ring_count || 0}</span>
                </div>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open({
              anchor: marker,
              map: map,
            });
            setSelectedDoor(door);
          });

          googleMarkersRef.current.push(marker);
        });
      }

      return () => {
        window.google?.maps?.event?.removeListener?.(boundsListener);
        overlay?.setMap(null);
        googleMarkersRef.current.forEach((m) => m?.setMap?.(null));
        googleMarkersRef.current = [];
      };
    } catch (err: any) {
      console.error('Google Maps initialization failed:', err);
      setMapError(`Google Maps initialization failed: ${err.message || err}. Reverting to OpenStreetMap.`);
      setMapProvider('leaflet');
    }
  }, [mapProvider, googleLoaded, center, validDoors, heatPoints, theme]);

  // Leaflet Renderer
  useEffect(() => {
    if (mapProvider !== 'leaflet' || !leafletLoaded || !mapContainerRef.current) return;

    try {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
      }

      // Clear container DOM
      mapContainerRef.current.innerHTML = '';
      mapContainerRef.current.className = 'w-full h-full z-10';

      const L = window.L;
      if (!L) return;

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
          const lat = parseFloat(String(door.lat));
          const lng = parseFloat(String(door.lng));
          if (isNaN(lat) || isNaN(lng)) return;

          const marker = L.circleMarker([lat, lng], {
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
    } catch (err: any) {
      console.error('Leaflet initialization failed:', err);
    }
  }, [mapProvider, leafletLoaded, center, validDoors, heatPoints, theme]);

  // Adjust heat radius / opacity in real-time
  useEffect(() => {
    if (googleHeatmapOverlayRef.current) {
      googleHeatmapOverlayRef.current.setRadius(radius);
      googleHeatmapOverlayRef.current.setIntensity(intensity);
      googleHeatmapOverlayRef.current.setOpacity(intensity);
      googleHeatmapOverlayRef.current.setVisible(showHeat);
    }
    if (googleMarkersRef.current) {
      googleMarkersRef.current.forEach((m) => m?.setVisible?.(showPins));
    }
  }, [radius, intensity, showHeat, showPins]);

  const saveGoogleKey = (key: string) => {
    const trimmed = key.trim();
    setGoogleKey(trimmed);
    try {
      localStorage.setItem('tk_google_maps_key', trimmed);
    } catch {}
    setShowKeyInput(false);
    setMapError(null);

    if (!trimmed) {
      setMapProvider('leaflet');
      return;
    }

    setMapProvider('google');

    // If script was already loaded with a different key, reload cleanly
    if (typeof window !== 'undefined') {
      const existingScript = document.getElementById('google-maps-script') as HTMLScriptElement | null;
      if (existingScript && !existingScript.src.includes(`key=${trimmed}`)) {
        window.location.reload();
      }
    }
  };

  const clearGoogleKey = () => {
    setGoogleKey('');
    try {
      localStorage.removeItem('tk_google_maps_key');
    } catch {}
    setShowKeyInput(false);
    setMapError(null);
    setMapProvider('leaflet');
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
      {/* Error / Warning Alert Banner */}
      {mapError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{mapError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setMapError(null);
                setMapProvider('leaflet');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
            >
              Switch to OpenStreetMap
            </button>
            <button
              type="button"
              onClick={() => setShowKeyInput(true)}
              className="px-3 py-1.5 bg-white dark:bg-surface-card hover:bg-slate-100 dark:hover:bg-surface-border text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-surface-border rounded-xl font-medium transition-colors cursor-pointer"
            >
              Edit API Key
            </button>
          </div>
        </div>
      )}

      {/* Map Control Bar */}
      <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider Toggle */}
          <div className="p-1 bg-surface-darker rounded-xl border border-surface-border flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMapError(null);
                setMapProvider('leaflet');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                mapProvider === 'leaflet'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              OpenStreetMap / CartoDB
            </button>
            <button
              type="button"
              onClick={() => {
                setMapError(null);
                if (!googleKey) setShowKeyInput(true);
                setMapProvider('google');
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                mapProvider === 'google'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>Google Maps</span>
              {!googleKey && (
                <span className="text-[10px] px-1 bg-amber-500/20 text-amber-600 dark:text-amber-300 rounded font-normal">
                  Key required
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="p-2 bg-surface-darker hover:bg-slate-100 dark:hover:bg-surface-border text-slate-700 dark:text-slate-300 rounded-xl border border-surface-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Configure Google Maps API Key"
          >
            <Key className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="hidden sm:inline font-medium">API Key</span>
          </button>

          <button
            type="button"
            onClick={handleCenterOnArea}
            className="px-3 py-1.5 bg-surface-darker hover:bg-slate-100 dark:hover:bg-surface-border text-slate-700 dark:text-slate-300 rounded-xl border border-surface-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
          >
            <Compass className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Focus Active Area</span>
          </button>
        </div>

        {/* Heatmap Filters & Density Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={showHeat}
              onChange={(e) => setShowHeat(e.target.checked)}
              className="rounded border-surface-border text-brand-600 focus:ring-0 cursor-pointer"
            />
            <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Heat Glow</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={showPins}
              onChange={(e) => setShowPins(e.target.checked)}
              className="rounded border-surface-border text-brand-600 focus:ring-0 cursor-pointer"
            />
            <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>Door Pins</span>
          </label>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-surface-darker px-3 py-1.5 rounded-xl border border-surface-border">
            <span>Radius:</span>
            <input
              type="range"
              min="15"
              max="65"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              className="w-16 accent-brand-600 cursor-pointer"
            />
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{radius}px</span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 bg-surface-darker hover:bg-slate-100 dark:hover:bg-surface-border text-slate-700 dark:text-slate-300 rounded-xl border border-surface-border transition-colors cursor-pointer"
              title="Refresh Heatmap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Google Key Configuration Drawer */}
      {showKeyInput && (
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col sm:flex-row items-center gap-3 shadow-md">
          <div className="flex-1 w-full">
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 block font-medium">
              Google Maps JavaScript API Key (Maps JavaScript API enabled in Google Cloud Console):
            </label>
            <input
              type="text"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-surface-darker border border-slate-200 dark:border-surface-border rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto self-end">
            {googleKey && (
              <button
                type="button"
                onClick={clearGoogleKey}
                className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Key</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => saveGoogleKey(googleKey)}
              className="w-full sm:w-auto px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save & Load</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Display Viewport */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-border shadow-2xl h-[560px] bg-slate-100 dark:bg-surface-darkest">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-20 p-3 bg-white/95 dark:bg-surface-card/90 backdrop-blur-md rounded-xl border border-slate-200 dark:border-surface-border text-xs space-y-2 shadow-lg max-w-xs">
          <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between gap-3">
            <span>Location Density Heatmap</span>
            <span className="text-[10px] text-brand-600 dark:text-brand-400 font-mono font-semibold">
              {validDoors.length} verified doors
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-cyan-400 via-yellow-400 to-red-500" />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 w-full">
              <span>Low Usage</span>
              <span>High Ring Activity</span>
            </div>
          </div>
          <div className="text-[10.5px] text-slate-600 dark:text-slate-400 leading-tight">
            Heat density reflects door installations and cumulative visitor rings in real-time.
          </div>
        </div>
      </div>

      {/* Selected Door Drawer / Quick Metrics */}
      {selectedDoor && (
        <div className="p-4 bg-surface-card rounded-2xl border border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                {selectedDoor.display_name || selectedDoor.label}
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/20 dark:text-brand-400 dark:border-transparent font-medium">
                {selectedDoor.label}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{selectedDoor.address_line || `Coordinates: ${selectedDoor.lat}, ${selectedDoor.lng}`}</span>
            </p>
            {selectedDoor.owner_email && (
              <p className="text-[11px] text-slate-500">
                Owner: <span className="text-slate-800 dark:text-slate-300 font-medium">{selectedDoor.owner_email}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-surface-darker rounded-xl border border-surface-border text-center min-w-[70px]">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Total Calls</span>
              <span className="text-base font-bold text-slate-900 dark:text-white block mt-0.5">
                {selectedDoor.ring_count || 0}
              </span>
            </div>
            <div className="p-2.5 bg-surface-darker rounded-xl border border-surface-border text-center min-w-[70px]">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Answered</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {selectedDoor.answered_count || 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDoor(null)}
              className="p-2 hover:bg-surface-darker rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
