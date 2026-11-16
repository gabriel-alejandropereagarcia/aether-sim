#!/usr/bin/env node
/**
 * AETHER-SIM Analog Finder snapshot builder (Node 18+, no dependencies).
 *
 * Mirrors src/services/regionScanClient.ts: scans a bounding box on a regular grid, fetching
 *  - NASA POWER climatology per cell (temporal/climatology/point, community=RE), concurrency 5
 *  - Copernicus GLO-90 elevations via Open-Meteo (<=100 coords/request): centre + ~1 km N/S/E/W
 * and writes RAW per-cell data (no scores; scores depend on the selected target and are computed
 * in the app). Failed cells are skipped and listed, never filled with synthetic values.
 *
 * Usage:
 *   node scripts/scanAnalogRegion.mjs [--cols 8] [--rows 8]
 *        [--bbox south,north,west,east] [--out src/data/punaScanSnapshot.json]
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PUNA_BBOX = { south: -27.5, north: -22.5, west: -69.0, east: -65.5 };
const bboxArg = arg('bbox', null);
const bbox = bboxArg
  ? (([south, north, west, east]) => ({ south, north, west, east }))(bboxArg.split(',').map(Number))
  : PUNA_BBOX;
const cols = Number(arg('cols', 8));
const rows = Number(arg('rows', 8));
const outPath = resolve(__dirname, '..', arg('out', 'src/data/punaScanSnapshot.json'));

const PARAMS = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M,RH2M,PS';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const CONCURRENCY = 5;
const TIMEOUT_MS = 30000;
const OFFSET_KM = 1;
const MAX_COORDS = 100;

const round = (v, d) => Number(v.toFixed(d));
const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

function buildGrid() {
  const dLat = (bbox.north - bbox.south) / rows;
  const span = bbox.east >= bbox.west ? bbox.east - bbox.west : bbox.east + 360 - bbox.west;
  const dLon = span / cols;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        id: `r${r}c${c}`,
        row: r,
        col: c,
        lat: round(bbox.north - (r + 0.5) * dLat, 4),
        lon: round(wrapLon(bbox.west + (c + 0.5) * dLon), 4),
      });
    }
  }
  return cells;
}

function demCoords(lat, lon) {
  const dLat = OFFSET_KM / 110.574;
  const dLon = OFFSET_KM / Math.max(1, 111.32 * Math.cos((lat * Math.PI) / 180));
  const r5 = (v) => round(v, 5);
  return [
    [r5(lat), r5(lon)],
    [r5(Math.min(89.99, lat + dLat)), r5(lon)],
    [r5(Math.max(-89.99, lat - dLat)), r5(lon)],
    [r5(lat), r5(wrapLon(lon + dLon))],
    [r5(lat), r5(wrapLon(lon - dLon))],
  ];
}

async function getJson(url, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
}

function parsePower(json) {
  const params = json?.properties?.parameter;
  const gridElev = json?.geometry?.coordinates?.[2];
  if (!params || typeof gridElev !== 'number' || !Number.isFinite(gridElev)) return null;
  const out = {};
  for (const key of PARAMS.split(',')) {
    const arr = [];
    for (const m of MONTHS) {
      const v = params[key]?.[m];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= -900) return null;
      arr.push(round(v, 2));
    }
    out[key] = arr;
  }
  return { rawClimatology: out, powerGridElevationM: round(gridElev, 1) };
}

async function main() {
  const startedAt = Date.now();
  const grid = buildGrid();
  console.log(`Scanning ${cols}x${rows} = ${grid.length} cells over`, bbox);

  // DEM (chunked, <=100 coordinates per request)
  const coords = grid.flatMap((cell) => demCoords(cell.lat, cell.lon).map(([lat, lon]) => ({ id: cell.id, lat, lon })));
  const elev = Array(coords.length).fill(null);
  const failures = [];
  for (let i = 0; i < coords.length; i += MAX_COORDS) {
    const chunk = coords.slice(i, i + MAX_COORDS);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((c) => c.lat).join(',')}&longitude=${chunk.map((c) => c.lon).join(',')}`;
    try {
      const json = await getJson(url);
      if (!Array.isArray(json?.elevation) || json.elevation.length !== chunk.length) throw new Error('invalid elevation array');
      json.elevation.forEach((v, j) => (elev[i + j] = typeof v === 'number' && Number.isFinite(v) ? v : null));
    } catch (err) {
      console.warn(`DEM chunk ${i / MAX_COORDS} failed: ${err.message}`);
    }
  }
  const demById = new Map();
  grid.forEach((cell, idx) => {
    const e = elev.slice(idx * 5, idx * 5 + 5);
    if (e.some((v) => v === null)) {
      failures.push({ id: cell.id, lat: cell.lat, lon: cell.lon, reason: 'DEM: unavailable' });
      return;
    }
    const [centerM, northM, southM, eastM, westM] = e;
    demById.set(cell.id, { centerM, northM, southM, eastM, westM, sampleOffsetKm: OFFSET_KM });
  });
  console.log(`DEM done in ${Date.now() - startedAt} ms (${demById.size}/${grid.length} cells)`);

  // NASA POWER (concurrency-limited)
  const results = new Map();
  const queue = grid.filter((c) => demById.has(c.id));
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length) {
        const cell = queue[next++];
        const url =
          `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=${PARAMS}` +
          `&community=RE&longitude=${cell.lon.toFixed(4)}&latitude=${cell.lat.toFixed(4)}&format=JSON`;
        try {
          const parsed = parsePower(await getJson(url));
          if (!parsed) throw new Error('missing/fill values in POWER payload');
          results.set(cell.id, { ...cell, ...parsed, dem: demById.get(cell.id) });
        } catch (err) {
          failures.push({ id: cell.id, lat: cell.lat, lon: cell.lon, reason: `POWER: ${err.message}` });
        }
        done++;
        process.stdout.write(`\rPOWER ${done}/${queue.length}`);
      }
    }),
  );
  process.stdout.write('\n');

  const durationMs = Date.now() - startedAt;
  const snapshot = {
    generatedAtUtc: new Date().toISOString(),
    bbox,
    cols,
    rows,
    source:
      'NASA POWER climatology (temporal/climatology/point, community=RE) + Copernicus GLO-90 DEM via Open-Meteo elevation API',
    cells: grid.filter((c) => results.has(c.id)).map((c) => results.get(c.id)),
    failures,
    durationMs,
  };
  await writeFile(outPath, JSON.stringify(snapshot, null, 1) + '\n', 'utf8');
  console.log(`Wrote ${snapshot.cells.length} cells (${failures.length} failed) to ${outPath} in ${durationMs} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
