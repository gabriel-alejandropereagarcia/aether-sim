import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Info,
  Loader2,
  Radar,
  RefreshCw,
  Sparkles,
  Square,
  Telescope,
} from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';
import {
  ANALOG_COMPONENT_LABELS,
  ANALOG_WEIGHTS,
  AnalogComponentKey,
  EARTH_THERMAL_FLOOR_C,
  NOVELTY_RADIUS_KM,
  rankCandidates,
  RankedCandidate,
  ScanBbox,
  ScanCellData,
  targetMeanAbsSlopeDeg,
} from '../engine/analogFinder';
import { RegionScanProgress, RegionScanResult, scanRegionLive } from '../services/regionScanClient';
import { analogIndexColor, MapScanCandidate } from './DualPlanetaryMap';
import punaSnapshotJson from '../data/punaScanSnapshot.json';

const PUNA_SNAPSHOT = punaSnapshotJson as unknown as RegionScanResult;

type PresetId = 'puna' | 'atacama' | 'altiplano' | 'iceland' | 'current-view';

const REGION_PRESETS: { id: PresetId; label: string; bbox: ScanBbox | null }[] = [
  { id: 'puna', label: 'Puna de Atacama (NW Argentina)', bbox: { south: -27.5, north: -22.5, west: -69.0, east: -65.5 } },
  { id: 'atacama', label: 'Atacama (Chile)', bbox: { south: -26.0, north: -20.0, west: -70.4, east: -68.0 } },
  { id: 'altiplano', label: 'Altiplano (Bolivia)', bbox: { south: -22.5, north: -16.5, west: -69.5, east: -66.0 } },
  { id: 'iceland', label: 'Iceland Highlands', bbox: { south: 63.8, north: 65.6, west: -20.0, east: -15.0 } },
  { id: 'current-view', label: 'Current Earth map view', bbox: null },
];

const GRID_OPTIONS = [5, 6, 8] as const;
const MAX_VIEW_SPAN_DEG = 40;
const POWER_CELL_DEG = 0.5;
const TABLE_ROWS_DEFAULT = 12;

const COMPONENT_COLORS: Record<AnalogComponentKey, string> = {
  pressure: '#22d3ee',
  thermal: '#60a5fa',
  aridity: '#f59e0b',
  diurnalSwing: '#a78bfa',
  insolation: '#facc15',
  terrain: '#10b981',
};

const COMPONENT_FORMULAS: Record<AnalogComponentKey, string> = {
  pressure: '100*clamp((1013 - P_mbar)/(1013 - 500)); ISA-corrected to DEM elevation',
  thermal: `100*clamp((25 - Tobs)/(25 - Teff)); Tobs = 0.5*mean T2M + 0.5*coldest-month T2M_MIN; Teff = max(target mean T, ${EARTH_THERMAL_FLOOR_C} C)`,
  aridity: '100*(0.6*clamp(1 - P/3 mm/day) + 0.4*clamp((80 - RH)/70))',
  diurnalSwing: '100*clamp((mean(T2M_MAX - T2M_MIN) - 5)/25)',
  insolation: '100*clamp((ALLSKY_SFC_SW_DWN - 3)/(7.5 - 3)) kWh/m2/day',
  terrain: '100*clamp(1 - |s - t|/(3 + t)); s = cell mean |slope| over ~1 km DEM baselines, t = target traverse mean |slope|',
};

const formatBbox = (b: ScanBbox) =>
  `${b.south.toFixed(2)}..${b.north.toFixed(2)} lat, ${b.west.toFixed(2)}..${b.east.toFixed(2)} lon`;

const formatUtc = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

interface ScanDataset extends RegionScanResult {
  kind: 'SNAPSHOT' | 'LIVE';
  label: string;
}

interface AnalogFinderPanelProps {
  selectedTarget: PlanetaryTarget;
  curatedSites: EarthAnalogSite[];
  selectedSiteId: string;
  onProbeCoordinate: (lat: number, lon: number) => void;
  getEarthViewBbox: () => ScanBbox | null;
  onScanDisplayChange: (display: { bbox: ScanBbox; candidates: MapScanCandidate[] } | null) => void;
  isProbing: boolean;
}

export const AnalogFinderPanel: React.FC<AnalogFinderPanelProps> = ({
  selectedTarget,
  curatedSites,
  selectedSiteId,
  onProbeCoordinate,
  getEarthViewBbox,
  onScanDisplayChange,
  isProbing,
}) => {
  const [presetId, setPresetId] = useState<PresetId>('puna');
  const [gridSize, setGridSize] = useState<number>(6);
  const [dataset, setDataset] = useState<ScanDataset>(() => ({
    ...PUNA_SNAPSHOT,
    kind: 'SNAPSHOT',
    label: 'Puna de Atacama (NW Argentina)',
  }));
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<RegionScanProgress | null>(null);
  const [message, setMessage] = useState<{ tone: 'warn' | 'info'; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const scanAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => scanAbortRef.current?.abort(), []);

  const catalogue = useMemo(
    () => curatedSites.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon })),
    [curatedSites],
  );

  // Re-ranks instantly whenever the selected Moon/Mars target changes
  const ranked = useMemo<RankedCandidate[]>(
    () => rankCandidates(dataset.cells as ScanCellData[], selectedTarget, catalogue),
    [dataset, selectedTarget, catalogue],
  );

  useEffect(() => {
    onScanDisplayChange({
      bbox: dataset.bbox,
      candidates: ranked.map((r) => ({
        id: r.cell.id,
        lat: r.cell.lat,
        lon: r.cell.lon,
        rank: r.rank,
        index: r.index,
        isNovel: r.isNovel,
      })),
    });
  }, [dataset.bbox, ranked, onScanDisplayChange]);

  const weights = ANALOG_WEIGHTS[selectedTarget.body];
  const componentKeys = Object.keys(weights) as AnalogComponentKey[];
  const novelCount = ranked.filter((r) => r.isNovel).length;
  const excludedSea = dataset.cells.length - ranked.length;
  const tSlope = targetMeanAbsSlopeDeg(selectedTarget);

  const handleScan = useCallback(async () => {
    const preset = REGION_PRESETS.find((p) => p.id === presetId)!;
    const bbox = preset.bbox ?? getEarthViewBbox();
    if (!bbox) {
      setMessage({ tone: 'warn', text: 'Earth map view not ready yet; try again in a moment.' });
      return;
    }
    const lonSpan = bbox.east >= bbox.west ? bbox.east - bbox.west : bbox.east + 360 - bbox.west;
    const latSpan = bbox.north - bbox.south;
    if (lonSpan > MAX_VIEW_SPAN_DEG || latSpan > MAX_VIEW_SPAN_DEG) {
      setMessage({
        tone: 'warn',
        text: `Map view spans ${latSpan.toFixed(0)} x ${lonSpan.toFixed(0)} deg; zoom in to <= ${MAX_VIEW_SPAN_DEG} deg before scanning.`,
      });
      return;
    }

    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;
    setIsScanning(true);
    setMessage(
      lonSpan / gridSize < POWER_CELL_DEG || latSpan / gridSize < POWER_CELL_DEG
        ? {
            tone: 'info',
            text: 'Grid spacing is finer than the NASA POWER 0.5 x 0.625 deg grid: neighbouring cells share climatology (DEM still differs).',
          }
        : null,
    );
    setProgress({ completed: 0, total: gridSize * gridSize, failed: 0, phase: 'DEM' });

    try {
      const result = await scanRegionLive({
        bbox,
        cols: gridSize,
        rows: gridSize,
        signal: controller.signal,
        onProgress: (p) => {
          if (!controller.signal.aborted) setProgress(p);
        },
      });
      if (controller.signal.aborted) return;
      if (result.cells.length === 0) {
        setMessage({
          tone: 'warn',
          text: `Live scan returned no usable cells (${result.failures.length} failed${result.failures[0] ? `: ${result.failures[0].reason}` : ''}). Keeping previous results.`,
        });
      } else {
        setDataset({ ...result, kind: 'LIVE', label: preset.label });
        setShowAll(false);
        if (result.failures.length > 0) {
          setMessage({
            tone: 'warn',
            text: `${result.failures.length} of ${result.cols * result.rows} cells failed and were skipped (no synthetic fill). First: ${result.failures[0].reason}`,
          });
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setMessage({ tone: 'info', text: 'Scan cancelled. Previous results kept.' });
      } else {
        setMessage({ tone: 'warn', text: `Scan failed: ${(err as Error).message}. Previous results kept.` });
      }
    } finally {
      if (scanAbortRef.current === controller) {
        scanAbortRef.current = null;
        setIsScanning(false);
      }
    }
  }, [presetId, gridSize, getEarthViewBbox]);

  const handleCancel = useCallback(() => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    setIsScanning(false);
    setMessage({ tone: 'info', text: 'Scan cancelled. Previous results kept.' });
  }, []);

  const handleRestoreSnapshot = useCallback(() => {
    setDataset({ ...PUNA_SNAPSHOT, kind: 'SNAPSHOT', label: 'Puna de Atacama (NW Argentina)' });
    setMessage(null);
  }, []);

  const rows = showAll ? ranked : ranked.slice(0, TABLE_ROWS_DEFAULT);
  const progressPct = progress ? Math.round((progress.completed / Math.max(1, progress.total)) * 100) : 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-[#f8f3e6]/95 p-4 shadow-xl">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              DISCOVER
            </span>
            <h2 className="text-sm font-bold tracking-wide text-slate-100 sm:text-base">
              Analog Finder: Regional Scan for New Moon/Mars Analog Sites
            </h2>
          </div>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-400">
            Scans a region on a grid with NASA POWER climatology + Copernicus GLO-90 DEM and ranks every cell
            against <span className="font-mono text-slate-200">{selectedTarget.shortName}</span> with a heuristic
            screening index with transparent weights. Click a candidate to run the full four-module analysis on it.
          </p>
        </div>

        {/* Data source status */}
        <div className="flex flex-col items-end gap-1 font-mono text-[10px]">
          {dataset.kind === 'SNAPSHOT' ? (
            <span className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-amber-200">
              <Database className="h-3 w-3" /> BUNDLED SNAPSHOT | {formatUtc(dataset.generatedAtUtc)}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-emerald-300">
              <Radar className="h-3 w-3" /> LIVE SCAN | {formatUtc(dataset.generatedAtUtc)} | {(dataset.durationMs / 1000).toFixed(1)} s
            </span>
          )}
          <span className="text-slate-500">
            {dataset.label} | {dataset.cols}x{dataset.rows} grid | {dataset.cells.length} cells
            {dataset.failures.length > 0 ? ` | ${dataset.failures.length} failed` : ''}
            {excludedSea > 0 ? ` | ${excludedSea} sea excluded` : ''}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2 font-mono text-[11px]">
        <label className="flex items-center gap-1.5 text-slate-400">
          <Telescope className="h-3.5 w-3.5 text-cyan-400" /> Region
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value as PresetId)}
            disabled={isScanning}
            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-500"
          >
            {REGION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 text-slate-400">
          Grid
          {GRID_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={isScanning}
              onClick={() => setGridSize(n)}
              className={`rounded px-2 py-1 font-semibold transition ${
                gridSize === n
                  ? 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                  : 'border border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {n}x{n}
            </button>
          ))}
        </div>

        {isScanning ? (
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/15 px-2.5 py-1 font-semibold text-red-200 hover:bg-red-500/25"
          >
            <Square className="h-3.5 w-3.5" /> Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={handleScan}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-400/60 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)] hover:bg-emerald-500/25"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {dataset.kind === 'SNAPSHOT' ? 'Re-scan live' : 'Scan live'}
          </button>
        )}

        {dataset.kind === 'LIVE' && !isScanning && (
          <button
            type="button"
            onClick={handleRestoreSnapshot}
            className="rounded px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            Restore snapshot
          </button>
        )}

        <span className="text-slate-500">
          {gridSize * gridSize} cells: {gridSize * gridSize} NASA POWER + {gridSize * gridSize * 5} DEM samples
        </span>

        {(isScanning || (progress && progress.phase !== 'DONE')) && progress && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-cyan-300">
              {progress.phase === 'DEM' ? 'DEM' : 'POWER'} {progress.completed}/{progress.total}
            </span>
            {progress.failed > 0 && <span className="text-amber-300">{progress.failed} failed</span>}
          </div>
        )}
      </div>

      {message && (
        <p
          className={`mt-2 flex items-start gap-1.5 font-mono text-[11px] ${
            message.tone === 'warn' ? 'text-amber-300' : 'text-slate-400'
          }`}
        >
          {message.tone === 'warn' ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> : <Info className="mt-0.5 h-3 w-3 shrink-0" />}
          {message.text}
        </p>
      )}

      {/* Weight legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-400">
        <span className="font-semibold text-slate-300">{selectedTarget.body} WEIGHTS:</span>
        {componentKeys.map((k) => (
          <span key={k} className="flex items-center gap-1" title={COMPONENT_FORMULAS[k]}>
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COMPONENT_COLORS[k] }} />
            {ANALOG_COMPONENT_LABELS[k]} {Math.round(weights[k] * 100)}%
          </span>
        ))}
        <span className="text-slate-500">
          | target mean |slope| {tSlope.toFixed(2)}° | NEW = &gt; {NOVELTY_RADIUS_KM} km from every catalogued analog
        </span>
      </div>

      {/* Ranked table */}
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[860px] border-collapse font-mono text-[11px]">
          <thead className="bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Lat, Lon</th>
              <th className="px-2 py-1.5 text-right">DEM m</th>
              <th className="px-2 py-1.5 text-right">P mbar</th>
              <th className="px-2 py-1.5 text-right">Mean T °C</th>
              <th className="px-2 py-1.5 text-right">Precip mm/d</th>
              <th className="px-2 py-1.5 text-right">|Slope| °</th>
              <th className="px-2 py-1.5 text-right">Index</th>
              <th className="px-2 py-1.5 text-left">Components</th>
              <th className="px-2 py-1.5 text-left">Nearest catalogued analog</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const probeId = `custom-probe-${r.cell.lat.toFixed(2)}-${r.cell.lon.toFixed(2)}`;
              const isSelected = probeId === selectedSiteId;
              return (
                <tr
                  key={r.cell.id}
                  onClick={() => onProbeCoordinate(r.cell.lat, r.cell.lon)}
                  title="Probe this cell with all four modules"
                  className={`cursor-pointer border-t border-slate-800/80 transition hover:bg-cyan-500/10 ${
                    isSelected ? 'bg-cyan-500/15' : ''
                  }`}
                >
                  <td className="px-2 py-1 text-slate-300">{r.rank}</td>
                  <td className="px-2 py-1 text-slate-200">
                    {r.cell.lat.toFixed(3)}, {r.cell.lon.toFixed(3)}
                  </td>
                  <td className="px-2 py-1 text-right text-emerald-300">{r.metrics.demElevationM}</td>
                  <td className="px-2 py-1 text-right text-cyan-300">{r.metrics.pressureMbar}</td>
                  <td className="px-2 py-1 text-right text-slate-200">{r.metrics.meanTempC.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right text-slate-200">{r.metrics.meanPrecipMmDay.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right text-slate-200">{r.metrics.meanAbsSlopeDeg.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right">
                    <span className="font-bold" style={{ color: analogIndexColor(r.index) }}>
                      {r.index.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-end gap-0.5" aria-label="Component scores">
                      {componentKeys.map((k) => (
                        <div
                          key={k}
                          title={`${ANALOG_COMPONENT_LABELS[k]}: ${r.components[k].toFixed(0)} / 100 (weight ${Math.round(weights[k] * 100)}%)`}
                          className="flex h-4 w-2.5 items-end overflow-hidden rounded-sm bg-slate-800"
                        >
                          <div
                            className="w-full"
                            style={{ height: `${Math.max(4, r.components[k])}%`, backgroundColor: COMPONENT_COLORS[k] }}
                          />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-1.5">
                      {r.isNovel && (
                        <span className="flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-bold text-emerald-300">
                          <Sparkles className="h-2.5 w-2.5" /> NEW
                        </span>
                      )}
                      <span className="truncate text-slate-400" title={r.nearestCatalogued?.name}>
                        {r.nearestCatalogued
                          ? `${r.nearestCatalogued.distanceKm.toFixed(0)} km | ${r.nearestCatalogued.name}`
                          : 'n/a'}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-3 text-center text-slate-500">
                  No land cells with complete data in this scan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
        <span>
          {ranked.length} candidates ranked | {novelCount} NEW | region {formatBbox(dataset.bbox)}
          {isProbing ? ' | probing selected candidate...' : ''}
        </span>
        {ranked.length > TABLE_ROWS_DEFAULT && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-cyan-400 hover:text-cyan-300">
            {showAll ? `Show top ${TABLE_ROWS_DEFAULT}` : `Show all ${ranked.length}`}
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        Heuristic screening index with transparent weights (hover a weight for its formula). Inputs are climatology and
        terrain only; geology, mineralogy and regolith are not observed, so every candidate needs remote-sensing and field
        follow-up. Pressure and temperature are ISA lapse-rate corrected from the NASA POWER grid elevation to the DEM
        elevation. DEM slopes use ~1 km baselines vs the 100 m target traverse.
      </p>
    </section>
  );
};

export default AnalogFinderPanel;
