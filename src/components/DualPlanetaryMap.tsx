import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  Crosshair,
  Globe2,
  Layers,
  MapPin,
  Orbit,
  Radio,
  Satellite,
  Search,
} from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';
import { ScanBbox, wrapLongitude } from '../engine/analogFinder';

/** Minimal candidate shape drawn on the Earth map by the Analog Finder. */
export interface MapScanCandidate {
  id: string;
  lat: number;
  lon: number;
  rank: number;
  index: number;
  isNovel: boolean;
}

/** Colour ramp for the Analog Similarity Index (0-100). */
export function analogIndexColor(index: number): string {
  if (index >= 80) return '#10b981';
  if (index >= 70) return '#84cc16';
  if (index >= 60) return '#f59e0b';
  if (index >= 50) return '#f97316';
  return '#ef4444';
}

/** Converts Leaflet bounds to a [-180, 180]-wrapped, latitude-clamped scan bbox. */
function boundsToScanBbox(bounds: L.LatLngBounds): ScanBbox {
  const south = Math.max(-85, bounds.getSouth());
  const north = Math.min(85, bounds.getNorth());
  const spanLon = bounds.getEast() - bounds.getWest();
  if (spanLon >= 360) return { south, north, west: -180, east: 180 };
  return { south, north, west: wrapLongitude(bounds.getWest()), east: wrapLongitude(bounds.getEast()) };
}

type EarthLayerMode = 'DARK_TACTICAL' | 'GIBS_BLUE_MARBLE' | 'GIBS_LST_DAY' | 'GIBS_ASTER_GDEM';

interface DualPlanetaryMapProps {
  sites: EarthAnalogSite[];
  probedSites: EarthAnalogSite[];
  selectedSite: EarthAnalogSite;
  onSelectSite: (siteId: string) => void;
  selectedTarget: PlanetaryTarget;
  onProbeCoordinate: (lat: number, lon: number) => void;
  isProbing: boolean;
  powerEndpointUrl: string;
  /** Analog Finder scan region (drawn as a dashed rectangle). */
  scanBbox?: ScanBbox | null;
  /** Analog Finder candidate cells, coloured by Analog Similarity Index; click = probe. */
  scanCandidates?: MapScanCandidate[];
  /** Reports the current Earth map view bounds (wrapped to [-180, 180]) on init and every move. */
  onEarthBoundsChange?: (bbox: ScanBbox) => void;
}

const EARTH_LAYERS: Record<
  EarthLayerMode,
  { label: string; badge: string; url: string; maxNativeZoom: number; attribution: string }
> = {
  DARK_TACTICAL: {
    label: 'Tactical Dark Terrain',
    badge: 'DARK',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 16,
    attribution: 'Esri World Dark Gray Canvas',
  },
  GIBS_BLUE_MARBLE: {
    label: 'NASA GIBS Blue Marble (Cloud-Free)',
    badge: 'GIBS BM',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    maxNativeZoom: 8,
    attribution: 'NASA EOSDIS GIBS / Blue Marble Next Gen',
  },
  GIBS_LST_DAY: {
    label: 'NASA GIBS Land Surface Temp',
    badge: 'GIBS LST',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2025-07-15/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    maxNativeZoom: 7,
    attribution: 'NASA EOSDIS GIBS / MODIS LST',
  },
  GIBS_ASTER_GDEM: {
    label: 'NASA ASTER GDEM Shaded Relief',
    badge: 'ASTER',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Color_Shaded_Relief/default/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
    maxNativeZoom: 12,
    attribution: 'NASA / METI ASTER GDEM v3',
  },
};

/**
 * Generates geodesic planetary polyline coordinates using the true planetary body radius
 * (1,737.4 km for Moon, 3,389.5 km for Mars) instead of Earth's radius.
 */
function buildPlanetaryTraverseLatLngs(
  lat: number,
  lon: number,
  bodyRadiusKm: number,
  azimuthDeg = 62,
): [number, number][] {
  const rad = (azimuthDeg * Math.PI) / 180;
  const kmPerDegLat = (Math.PI * bodyRadiusKm) / 180;
  const kmPerDegLon = Math.max(kmPerDegLat * 0.12, kmPerDegLat * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 21 }, (_, idx) => {
    const distKm = idx * 0.1;
    const dLat = (Math.cos(rad) * distKm) / kmPerDegLat;
    const dLon = (Math.sin(rad) * distKm) / kmPerDegLon;
    return [Math.max(-89.9, Math.min(89.9, lat + dLat)), lon + dLon];
  });
}

/**
 * Generates a geodesic ellipse polygon scaled by true planetary body radius
 * (avoids Leaflet L.circle's Earth-6371 km assumption).
 */
function buildPlanetaryEllipsePolygon(
  lat: number,
  lon: number,
  semiMajorKm: number,
  semiMinorKm: number,
  bodyRadiusKm: number,
  steps = 36,
): [number, number][] {
  const kmPerDegLat = (Math.PI * bodyRadiusKm) / 180;
  const kmPerDegLon = Math.max(kmPerDegLat * 0.12, kmPerDegLat * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: steps }, (_, i) => {
    const theta = (i / steps) * 2 * Math.PI;
    const dLat = (semiMinorKm * Math.sin(theta)) / kmPerDegLat;
    const dLon = (semiMajorKm * Math.cos(theta)) / kmPerDegLon;
    return [Math.max(-89.95, Math.min(89.95, lat + dLat)), lon + dLon];
  });
}

function createPlanetaryGridLayer(body: 'MOON' | 'MARS'): L.GridLayer {
  const GridLayer = L.GridLayer.extend({
    createTile(coords: L.Coords) {
      const tile = document.createElement('canvas');
      tile.width = 256;
      tile.height = 256;
      const ctx = tile.getContext('2d');
      if (ctx) {
        ctx.fillStyle = body === 'MARS' ? '#1c0f0a' : '#0f131a';
        ctx.fillRect(0, 0, 256, 256);

        const seed = Math.abs(Math.sin(coords.x * 12.9898 + coords.y * 78.233 + coords.z * 31.7));
        ctx.strokeStyle = body === 'MARS' ? 'rgba(234, 88, 12, 0.16)' : 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(0, 0, 256, 256);

        ctx.beginPath();
        const cx = 64 + seed * 128;
        const cy = 64 + ((seed * 7) % 1) * 128;
        const r = 14 + seed * 32;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = body === 'MARS' ? 'rgba(251, 146, 60, 0.12)' : 'rgba(203, 213, 225, 0.12)';
        ctx.stroke();

        ctx.fillStyle = body === 'MARS' ? 'rgba(251, 146, 60, 0.25)' : 'rgba(148, 163, 184, 0.25)';
        ctx.font = '10px monospace';
        ctx.fillText(`${body} GRID z${coords.z}:${coords.x},${coords.y}`, 8, 18);
      }
      return tile;
    },
  });
  return new (GridLayer as unknown as new () => L.GridLayer)();
}

export const DualPlanetaryMap: React.FC<DualPlanetaryMapProps> = ({
  sites,
  probedSites,
  selectedSite,
  onSelectSite,
  selectedTarget,
  onProbeCoordinate,
  isProbing,
  powerEndpointUrl,
  scanBbox,
  scanCandidates,
  onEarthBoundsChange,
}) => {
  const earthMapDivRef = useRef<HTMLDivElement | null>(null);
  const planetMapDivRef = useRef<HTMLDivElement | null>(null);
  const earthMapRef = useRef<L.Map | null>(null);
  const planetMapRef = useRef<L.Map | null>(null);
  const earthTileLayerRef = useRef<L.TileLayer | null>(null);
  const earthOverlayGroupRef = useRef<L.LayerGroup | null>(null);
  const planetBaseGroupRef = useRef<L.LayerGroup | null>(null);
  const planetOverlayGroupRef = useRef<L.LayerGroup | null>(null);
  const lastCenteredSiteIdRef = useRef<string | null>(null);
  const earthScanGroupRef = useRef<L.LayerGroup | null>(null);
  const lastFittedBboxKeyRef = useRef<string | null>(null);
  const onEarthBoundsChangeRef = useRef(onEarthBoundsChange);
  onEarthBoundsChangeRef.current = onEarthBoundsChange;

  const [earthLayerMode, setEarthLayerMode] = useState<EarthLayerMode>('DARK_TACTICAL');
  const [liveProbeActive, setLiveProbeActive] = useState<boolean>(true);
  const [manualLat, setManualLat] = useState<string>(selectedSite.lat.toFixed(2));
  const [manualLon, setManualLon] = useState<string>(selectedSite.lon.toFixed(2));

  useEffect(() => {
    setManualLat(selectedSite.lat.toFixed(2));
    setManualLon(selectedSite.lon.toFixed(2));
  }, [selectedSite.lat, selectedSite.lon]);

  // Initialize Earth Map
  useEffect(() => {
    if (!earthMapDivRef.current || earthMapRef.current) return;

    const map = L.map(earthMapDivRef.current, {
      center: [selectedSite.lat, selectedSite.lon],
      zoom: 6,
      minZoom: 2,
      maxZoom: 16,
      zoomControl: true,
    });

    const scanGroup = L.layerGroup().addTo(map);
    const overlayGroup = L.layerGroup().addTo(map);
    earthMapRef.current = map;
    earthOverlayGroupRef.current = overlayGroup;
    earthScanGroupRef.current = scanGroup;
    lastCenteredSiteIdRef.current = selectedSite.id;

    const reportBounds = () => onEarthBoundsChangeRef.current?.(boundsToScanBbox(map.getBounds()));
    map.on('moveend', reportBounds);
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
      reportBounds();
    }, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      map.off('moveend', reportBounds);
      map.remove();
      earthMapRef.current = null;
      earthScanGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach/Update Earth Click-to-Probe Listener
  useEffect(() => {
    const map = earthMapRef.current;
    if (!map) return;

    const handleClick = (ev: L.LeafletMouseEvent) => {
      if (!liveProbeActive) return;
      // Wrap longitude into [-180, 180] when clicking a repeated world copy
      const wrapped = ev.latlng.wrap();
      onProbeCoordinate(wrapped.lat, wrapped.lng);
    };

    map.on('click', handleClick);
    if (earthMapDivRef.current) {
      earthMapDivRef.current.style.cursor = liveProbeActive ? 'crosshair' : 'grab';
    }

    return () => {
      map.off('click', handleClick);
    };
  }, [liveProbeActive, onProbeCoordinate]);

  // Update Earth Tile Layer when Layer Mode changes
  useEffect(() => {
    const map = earthMapRef.current;
    if (!map) return;

    if (earthTileLayerRef.current) {
      map.removeLayer(earthTileLayerRef.current);
    }

    const cfg = EARTH_LAYERS[earthLayerMode];
    const layer = L.tileLayer(cfg.url, {
      maxZoom: 18,
      maxNativeZoom: cfg.maxNativeZoom,
      attribution: cfg.attribution,
      crossOrigin: true,
    });

    layer.addTo(map);
    earthTileLayerRef.current = layer;
  }, [earthLayerMode]);

  // Update Earth Markers & real 2.0 km DEM Traverse; only recenter when selectedSite.id changes
  useEffect(() => {
    const map = earthMapRef.current;
    const group = earthOverlayGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const allMarkers = [...sites, ...probedSites];
    allMarkers.forEach((site) => {
      const isSelected = site.id === selectedSite.id;
      const meanScore = Math.round(
        (site.fidelityScores.geomorphology +
          site.fidelityScores.regolithMechanics +
          site.fidelityScores.thermalAtmosphere +
          site.fidelityScores.geochemistryDielectric +
          site.fidelityScores.astrobiology) /
          5,
      );

      const marker = L.circleMarker([site.lat, site.lon], {
        radius: isSelected ? 8 : 5.5,
        color: isSelected
          ? '#22d3ee'
          : site.isCustomProbe
            ? '#38bdf8'
            : site.primaryTargetBody === 'MOON'
              ? '#cbd5e1'
              : '#f59e0b',
        weight: isSelected ? 2.5 : 1.5,
        dashArray: site.isCustomProbe && !isSelected ? '3 2' : undefined,
        fillColor: isSelected ? '#06b6d4' : '#0f172a',
        fillOpacity: 0.9,
      });

      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;"><strong>${site.name}</strong><br/>${site.country} | DEM ${site.elevationM} m | Score ${meanScore}%</div>`,
        { direction: 'top', offset: [0, -6] },
      );

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelectSite(site.id);
      });

      marker.addTo(group);
    });

    // Draw real 21-point 2.0 km Earth DEM Traverse coordinates
    const realEarthCoords: [number, number][] = selectedSite.traverse
      .filter((pt) => typeof pt.lat === 'number' && typeof pt.lon === 'number')
      .map((pt) => [pt.lat as number, pt.lon as number]);

    if (realEarthCoords.length >= 2) {
      L.polyline(realEarthCoords, {
        color: '#10b981',
        weight: 3.5,
        opacity: 0.95,
      })
        .bindTooltip('2.0 km Copernicus GLO-90 DEM Traverse')
        .addTo(group);
    }

    L.circle([selectedSite.lat, selectedSite.lon], {
      radius: 1600,
      color: '#22d3ee',
      weight: 1,
      dashArray: '4 4',
      fillOpacity: 0.06,
    }).addTo(group);

    if (lastCenteredSiteIdRef.current !== selectedSite.id) {
      lastCenteredSiteIdRef.current = selectedSite.id;
      map.setView([selectedSite.lat, selectedSite.lon], Math.max(map.getZoom(), 6), {
        animate: true,
      });
    }
  }, [sites, probedSites, selectedSite, onSelectSite]);

  // Analog Finder overlay: scan bbox rectangle + candidate cells coloured by index
  useEffect(() => {
    const map = earthMapRef.current;
    const group = earthScanGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!scanBbox) return;

    // Unwrap an antimeridian-crossing box so the rectangle is drawn the short way round
    const east = scanBbox.east >= scanBbox.west ? scanBbox.east : scanBbox.east + 360;
    const rectBounds = L.latLngBounds([scanBbox.south, scanBbox.west], [scanBbox.north, east]);
    L.rectangle(rectBounds, {
      color: '#22d3ee',
      weight: 1.2,
      dashArray: '6 4',
      fill: false,
      interactive: false,
    }).addTo(group);

    (scanCandidates ?? []).forEach((c) => {
      const lon = scanBbox.east < scanBbox.west && c.lon < scanBbox.west ? c.lon + 360 : c.lon;
      const color = analogIndexColor(c.index);
      const marker = L.circleMarker([c.lat, lon], {
        radius: c.rank <= 5 ? 7 : 5,
        color: c.isNovel ? '#ecfeff' : color,
        weight: c.rank <= 5 ? 2 : 1,
        fillColor: color,
        fillOpacity: 0.75,
      });
      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;"><strong>Candidate #${c.rank}</strong>${c.isNovel ? ' (NEW)' : ''}<br/>Analog Similarity Index ${c.index.toFixed(1)}<br/>${c.lat.toFixed(3)}°, ${c.lon.toFixed(3)}° | click to probe</div>`,
        { direction: 'top', offset: [0, -6] },
      );
      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onProbeCoordinate(c.lat, c.lon);
      });
      marker.addTo(group);
    });

    const bboxKey = `${scanBbox.south},${scanBbox.north},${scanBbox.west},${scanBbox.east}`;
    if (lastFittedBboxKeyRef.current !== bboxKey) {
      lastFittedBboxKeyRef.current = bboxKey;
      map.fitBounds(rectBounds, { padding: [12, 12], animate: true });
    }
  }, [scanBbox, scanCandidates, onProbeCoordinate]);

  // Initialize Moon/Mars Target Map (EPSG:4326 for NASA Trek WMTS alignment)
  useEffect(() => {
    if (!planetMapDivRef.current || planetMapRef.current) return;

    const map = L.map(planetMapDivRef.current, {
      crs: L.CRS.EPSG4326,
      center: [selectedTarget.lat, selectedTarget.lon],
      zoom: 4,
      minZoom: 1,
      maxZoom: 10,
      zoomControl: true,
      attributionControl: true,
    });

    const baseGroup = L.layerGroup().addTo(map);
    const overlayGroup = L.layerGroup().addTo(map);
    planetMapRef.current = map;
    planetBaseGroupRef.current = baseGroup;
    planetOverlayGroupRef.current = overlayGroup;

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 150);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      planetMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Planetary WMTS Layer + Geodesic Planetary Landing Ellipse + 2.0 km Traverse
  useEffect(() => {
    const map = planetMapRef.current;
    const baseGroup = planetBaseGroupRef.current;
    const overlayGroup = planetOverlayGroupRef.current;
    if (!map || !baseGroup || !overlayGroup) return;

    baseGroup.clearLayers();
    overlayGroup.clearLayers();

    createPlanetaryGridLayer(selectedTarget.body).addTo(baseGroup);

    L.tileLayer(selectedTarget.wmtsUrlTemplate, {
      maxZoom: 10,
      maxNativeZoom: 8,
      tileSize: 256,
      attribution: `NASA ${selectedTarget.body === 'MOON' ? 'Moon Trek LRO WAC' : 'Mars Trek Viking MDIM21'}`,
      crossOrigin: true,
    }).addTo(baseGroup);

    const [majorKm, minorKm] = selectedTarget.landingEllipseKm;
    const accentColor = selectedTarget.body === 'MARS' ? '#f97316' : '#e2e8f0';

    // Geodesic ellipse scaled by true planetary radius (Moon 1737.4 km, Mars 3389.5 km)
    const ellipsePts = buildPlanetaryEllipsePolygon(
      selectedTarget.lat,
      selectedTarget.lon,
      majorKm / 2,
      minorKm / 2,
      selectedTarget.bodyRadiusKm,
    );

    L.polygon(ellipsePts, {
      color: accentColor,
      weight: 1.5,
      dashArray: '5 4',
      fillColor: accentColor,
      fillOpacity: 0.12,
    })
      .bindTooltip(
        `Landing Ellipse: ${majorKm} × ${minorKm} km (${selectedTarget.body} R=${selectedTarget.bodyRadiusKm} km)`,
      )
      .addTo(overlayGroup);

    const targetTraverseCoords = buildPlanetaryTraverseLatLngs(
      selectedTarget.lat,
      selectedTarget.lon,
      selectedTarget.bodyRadiusKm,
      62,
    );

    L.polyline(targetTraverseCoords, {
      color: '#f59e0b',
      weight: 3.5,
      opacity: 0.95,
    })
      .bindTooltip(`2.0 km Planetary Traverse: ${selectedTarget.shortName}`)
      .addTo(overlayGroup);

    selectedTarget.traverse.forEach((pt, idx) => {
      if (!pt.label) return;
      const coord = targetTraverseCoords[idx];
      if (!coord) return;
      L.circleMarker(coord, {
        radius: 4.5,
        color: '#fef08a',
        weight: 1.5,
        fillColor: '#f59e0b',
        fillOpacity: 1,
      })
        .bindTooltip(`KM ${pt.distanceKm.toFixed(1)}: ${pt.label} (${pt.elevationM} m, ${pt.slopeDeg}°)`)
        .addTo(overlayGroup);
    });

    const targetZoom = Math.abs(selectedTarget.lat) > 85 ? 3 : 5;
    map.setView([selectedTarget.lat, selectedTarget.lon], targetZoom, { animate: true });
  }, [selectedTarget]);

  const handleManualProbeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number.parseFloat(manualLat);
    const lon = Number.parseFloat(manualLon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      onProbeCoordinate(Math.max(-85, Math.min(85, lat)), Math.max(-180, Math.min(180, lon)));
    }
  };

  const isPolarDistortion = Math.abs(selectedTarget.lat) > 80;
  const lapseOffsetM = selectedSite.elevationM - selectedSite.powerGridElevationM;

  return (
    <section className="rounded-xl border border-slate-800 bg-[#ffffff]/95 p-4 shadow-xl">
      {/* Module Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              Module 01
            </span>
            <h2 className="text-sm font-bold tracking-wide text-slate-100 sm:text-base">
              Dual Planetary Command Map &amp; Live NASA POWER Probe
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Click any coordinate on Earth to query live NASA POWER climatology + Copernicus GLO-90 DEM against{' '}
            <span className="font-mono text-slate-200">{selectedTarget.shortName}</span>.
          </p>
        </div>

        {/* GIBS Layer Switcher & Probe Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 p-1">
            <Layers className="ml-1.5 h-3.5 w-3.5 text-cyan-400" />
            {(Object.keys(EARTH_LAYERS) as EarthLayerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEarthLayerMode(mode)}
                className={`rounded px-2 py-1 font-mono text-[10px] font-semibold transition ${
                  earthLayerMode === mode
                    ? 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {EARTH_LAYERS[mode].badge}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLiveProbeActive((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold transition ${
              liveProbeActive
                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>{liveProbeActive ? 'LIVE PROBE: ON' : 'LIVE PROBE: OFF'}</span>
          </button>
        </div>
      </div>

      {/* Dual Synchronized Map Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT MAP: EARTH ANALOG + GIBS + LIVE PROBE */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-semibold text-slate-100">
                EARTH: {selectedSite.name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-300">
              <span>{selectedSite.lat.toFixed(2)}°, {selectedSite.lon.toFixed(2)}°</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400" title={`POWER Grid Cell: ${selectedSite.powerGridElevationM} m (ISA delta: ${lapseOffsetM >= 0 ? '+' : ''}${lapseOffsetM} m)`}>
                DEM {selectedSite.elevationM} m
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400" title="ISA lapse-rate corrected barometric pressure">
                {selectedSite.pressureMbar} mbar (ISA)
              </span>
            </div>
          </div>

          <div className="relative h-[340px] w-full">
            <div ref={earthMapDivRef} className="h-full w-full" />

            <div className="pointer-events-none absolute right-2.5 top-2.5 z-[400] flex flex-col items-end gap-1.5">
              <span className="rounded border border-slate-700/80 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                Layer: {EARTH_LAYERS[earthLayerMode].label}
              </span>
              <span className="rounded border border-emerald-500/40 bg-emerald-950/85 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                POWER Grid {selectedSite.powerGridElevationM}m -&gt; DEM {selectedSite.elevationM}m
              </span>
              {isProbing && (
                <span className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-950/90 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                  <Radio className="h-3 w-3 animate-spin" /> Probing POWER + DEM...
                </span>
              )}
            </div>

            <form
              onSubmit={handleManualProbeSubmit}
              className="absolute bottom-2.5 left-2.5 z-[400] flex items-center gap-1.5 rounded-md border border-slate-700/90 bg-slate-950 p-1.5"
            >
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              <input
                type="number"
                step="0.01"
                min={-85}
                max={85}
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                aria-label="Probe Latitude"
                className="w-20 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-100 outline-none focus:border-cyan-500"
                placeholder="Lat"
              />
              <input
                type="number"
                step="0.01"
                min={-180}
                max={180}
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                aria-label="Probe Longitude"
                className="w-20 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-100 outline-none focus:border-cyan-500"
                placeholder="Lon"
              />
              <button
                type="submit"
                className="flex items-center gap-1 rounded bg-cyan-400 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-950 hover:bg-cyan-300"
              >
                <Search className="h-3 w-3" />
                Probe
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT MAP: MOON / MARS TREK WMTS + GEODESIC 2.0 KM TRAVERSE */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <Orbit
                className={`h-4 w-4 ${
                  selectedTarget.body === 'MARS' ? 'text-orange-400' : 'text-slate-300'
                }`}
              />
              <span className="font-mono text-xs font-semibold text-slate-100">
                {selectedTarget.body} TARGET: {selectedTarget.shortName}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
              <span>{selectedTarget.lat.toFixed(2)}°, {selectedTarget.lon.toFixed(2)}°</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400">g = {selectedTarget.gravityMs2} m/s²</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-300">P = {selectedTarget.pressurePa} Pa</span>
            </div>
          </div>

          <div className="relative h-[340px] w-full">
            <div ref={planetMapDivRef} className="h-full w-full" />

            <div className="pointer-events-none absolute right-2.5 top-2.5 z-[400] flex flex-col items-end gap-1">
              <span className="rounded border border-slate-700/80 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                WMTS: {selectedTarget.wmtsLayer}
              </span>
              <span className="rounded border border-slate-700/80 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                Ellipse: {selectedTarget.landingEllipseKm[0]} × {selectedTarget.landingEllipseKm[1]} km (R={selectedTarget.bodyRadiusKm} km)
              </span>
              {isPolarDistortion && (
                <span className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-950/90 px-2 py-0.5 font-mono text-[10px] text-amber-200">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Polar Lat (&gt;80°): EPSG:4326 distorted; use Module 2 LOLA profile
                </span>
              )}
            </div>

            <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] max-w-[92%] rounded-md border border-slate-800/90 bg-slate-950/90 px-2.5 py-1.5 backdrop-blur">
              <p className="font-mono text-[10px] text-amber-300">
                {selectedTarget.missionContext} — Ref: {selectedTarget.citation}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300 line-clamp-2">
                {selectedTarget.geologySummary}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Space Agency Partner Data & Provenance Strip */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {selectedSite.partnerAgencyData.map((item, idx) => (
          <div
            key={`${item.agency}-${idx}`}
            className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-slate-900/65 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cyan-300">
                <Satellite className="h-3.5 w-3.5" />
                {item.agency}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                {item.instrument}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-400">{item.metricLabel}:</span>
              <span className="font-mono text-xs font-bold text-emerald-300">{item.metricValue}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">{item.description}</p>
          </div>
        ))}

        {selectedSite.partnerAgencyData.length < 3 && (
          <div className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-slate-900/65 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold text-amber-300">
                DATA PROVENANCE &amp; LOGISTICS
              </span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                {selectedSite.dataSourceTag}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">{selectedSite.geologyType}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-slate-500" title={powerEndpointUrl}>
              Season: {selectedSite.fieldLogistics.recommendedSeason} | {powerEndpointUrl}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
