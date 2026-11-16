/**
 * Live regional scan client for the Analog Finder.
 *
 * - NASA POWER climatology (same endpoint/params as the single-point probe), one request per cell,
 *   with a concurrency limit, per-request timeout and AbortSignal support.
 * - Copernicus GLO-90 elevations via Open-Meteo (max 100 coordinates per request -> chunked):
 *   5 samples per cell (centre + ~1 km N/S/E/W) for local slope / relief.
 *
 * Cells whose POWER or DEM request fails are SKIPPED and counted; nothing is filled with
 * synthetic data. Measured API limits (Nov 2026): Open-Meteo elevation caps a request at
 * 100 coordinates and bills 1 rate-limit unit per coordinate (600 units / minute window),
 * so an 8x8 scan (320 coordinates) can only be run about once per minute.
 */
import {
  buildDemSampleCoords,
  buildScanGrid,
  CellDemSamples,
  ScanBbox,
  ScanCellData,
  ScanGridCell,
} from '../engine/analogFinder';
import { buildNasaPowerClimatologyUrl, parseNasaPowerClimatologyStrict } from './nasaPowerClient';

export const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
export const OPEN_METEO_MAX_COORDS = 100;
export const DEM_SAMPLE_OFFSET_KM = 1;
export const SCAN_POWER_CONCURRENCY = 5;
export const SCAN_REQUEST_TIMEOUT_MS = 20000;

export interface RegionScanFailure {
  id: string;
  lat: number;
  lon: number;
  reason: string;
}

export interface RegionScanProgress {
  completed: number;
  total: number;
  failed: number;
  phase: 'DEM' | 'POWER' | 'DONE';
}

export interface RegionScanResult {
  generatedAtUtc: string;
  bbox: ScanBbox;
  cols: number;
  rows: number;
  source: string;
  cells: ScanCellData[];
  failures: RegionScanFailure[];
  durationMs: number;
}

export interface RegionScanOptions {
  bbox: ScanBbox;
  cols: number;
  rows: number;
  signal?: AbortSignal;
  onProgress?: (p: RegionScanProgress) => void;
  concurrency?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const SOURCE_LABEL =
  'NASA POWER climatology (temporal/climatology/point, community=RE) + Copernicus GLO-90 DEM via Open-Meteo elevation API';

function abortError(): Error {
  const err = new Error('Region scan aborted');
  err.name = 'AbortError';
  return err;
}

/** fetch + JSON with a per-request timeout chained to an outer AbortSignal. */
async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  outer: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) throw abortError();
    outer.addEventListener('abort', onAbort, { once: true });
  }
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (outer?.aborted) throw abortError();
    if (controller.signal.aborted) throw new Error(`timeout after ${timeoutMs} ms`);
    throw err;
  } finally {
    globalThis.clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

/** Fetches DEM samples for all cells; returns a map cellId -> samples (missing = failed). */
async function fetchDemSamples(
  cells: ScanGridCell[],
  opts: Required<Pick<RegionScanOptions, 'timeoutMs' | 'fetchImpl'>> & { signal?: AbortSignal },
): Promise<{ samples: Map<string, CellDemSamples>; errors: Map<string, string> }> {
  const coords: { cellId: string; lat: number; lon: number }[] = [];
  for (const cell of cells) {
    const s = buildDemSampleCoords(cell.lat, cell.lon, DEM_SAMPLE_OFFSET_KM);
    for (const [lat, lon] of [s.center, s.north, s.south, s.east, s.west]) {
      coords.push({ cellId: cell.id, lat, lon });
    }
  }
  const elevations: (number | null)[] = Array(coords.length).fill(null);
  const errors = new Map<string, string>();

  for (let i = 0; i < coords.length; i += OPEN_METEO_MAX_COORDS) {
    const chunk = coords.slice(i, i + OPEN_METEO_MAX_COORDS);
    const url =
      `${OPEN_METEO_ELEVATION_URL}?latitude=${chunk.map((c) => c.lat).join(',')}` +
      `&longitude=${chunk.map((c) => c.lon).join(',')}`;
    try {
      const json = (await fetchJsonWithTimeout(url, opts.timeoutMs, opts.signal, opts.fetchImpl)) as {
        elevation?: unknown[];
      };
      if (!Array.isArray(json?.elevation) || json.elevation.length !== chunk.length) {
        throw new Error('invalid elevation array');
      }
      json.elevation.forEach((v, j) => {
        elevations[i + j] = typeof v === 'number' && Number.isFinite(v) ? v : null;
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      chunk.forEach((c) => errors.set(c.cellId, `DEM: ${(err as Error).message}`));
    }
  }

  const samples = new Map<string, CellDemSamples>();
  cells.forEach((cell, idx) => {
    const e = elevations.slice(idx * 5, idx * 5 + 5);
    if (e.some((v) => v === null)) {
      if (!errors.has(cell.id)) errors.set(cell.id, 'DEM: missing elevation sample');
      return;
    }
    const [centerM, northM, southM, eastM, westM] = e as number[];
    samples.set(cell.id, { centerM, northM, southM, eastM, westM, sampleOffsetKm: DEM_SAMPLE_OFFSET_KM });
  });
  return { samples, errors };
}

/** Runs `worker` over `items` with at most `limit` in flight. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      if (signal?.aborted) throw abortError();
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/** Scans a region live. Rejects with an AbortError if `signal` is aborted. */
export async function scanRegionLive(options: RegionScanOptions): Promise<RegionScanResult> {
  const {
    bbox,
    cols,
    rows,
    signal,
    onProgress,
    concurrency = SCAN_POWER_CONCURRENCY,
    timeoutMs = SCAN_REQUEST_TIMEOUT_MS,
    fetchImpl = globalThis.fetch.bind(globalThis),
  } = options;
  const startedAt = Date.now();
  const grid = buildScanGrid(bbox, cols, rows);
  const total = grid.length;

  onProgress?.({ completed: 0, total, failed: 0, phase: 'DEM' });
  const dem = await fetchDemSamples(grid, { timeoutMs, fetchImpl, signal });

  const failures: RegionScanFailure[] = [];
  const results = new Map<string, ScanCellData>();
  let completed = 0;

  const demFailed = grid.filter((c) => !dem.samples.has(c.id));
  demFailed.forEach((c) =>
    failures.push({ id: c.id, lat: c.lat, lon: c.lon, reason: dem.errors.get(c.id) ?? 'DEM: unavailable' }),
  );
  completed += demFailed.length;
  onProgress?.({ completed, total, failed: failures.length, phase: 'POWER' });

  const powerCells = grid.filter((c) => dem.samples.has(c.id));
  await runPool(
    powerCells,
    concurrency,
    async (cell) => {
      try {
        const json = await fetchJsonWithTimeout(
          buildNasaPowerClimatologyUrl(cell.lat, cell.lon),
          timeoutMs,
          signal,
          fetchImpl,
        );
        const parsed = parseNasaPowerClimatologyStrict(json);
        if (!parsed) throw new Error('missing/fill values in POWER payload');
        results.set(cell.id, { ...cell, ...parsed, dem: dem.samples.get(cell.id)! });
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        failures.push({ id: cell.id, lat: cell.lat, lon: cell.lon, reason: `POWER: ${(err as Error).message}` });
      }
      completed++;
      onProgress?.({ completed, total, failed: failures.length, phase: 'POWER' });
    },
    signal,
  );

  onProgress?.({ completed: total, total, failed: failures.length, phase: 'DONE' });
  return {
    generatedAtUtc: new Date().toISOString(),
    bbox,
    cols,
    rows,
    source: SOURCE_LABEL,
    // Preserve grid order (row-major) regardless of completion order
    cells: grid.filter((c) => results.has(c.id)).map((c) => results.get(c.id)!),
    failures,
    durationMs: Date.now() - startedAt,
  };
}
