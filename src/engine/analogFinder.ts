/**
 * AETHER-SIM Analog Finder engine (pure functions, no network access).
 *
 * Scans a lat/lon bounding box on a regular grid and ranks each cell with an
 * "Analog Similarity Index" (ASI, 0-100) against a selected Moon/Mars target.
 *
 * IMPORTANT: the ASI is a HEURISTIC SCREENING INDEX WITH TRANSPARENT WEIGHTS.
 * It shortlists terrestrial locations worth a closer look (remote sensing,
 * field reconnaissance). It is not a verified or validated analog fidelity
 * metric: geology, mineralogy and regolith mechanics are NOT observed by the
 * inputs (NASA POWER climatology + Copernicus GLO-90 DEM).
 */
import {
  applyIsaLapseRateCorrection,
  MonthlyClimatology,
  PlanetaryBody,
  PlanetaryTarget,
} from '../data/planetaryData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanBbox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface ScanGridCell {
  id: string;
  row: number;
  col: number;
  lat: number;
  lon: number;
}

/** Copernicus GLO-90 DEM samples (m) at the cell centre and ~1 km N/S/E/W. */
export interface CellDemSamples {
  centerM: number;
  northM: number;
  southM: number;
  eastM: number;
  westM: number;
  /** Distance of the N/S/E/W samples from the centre (km). */
  sampleOffsetKm: number;
}

/** Raw per-cell inputs as fetched (this is what the bundled snapshot stores). */
export interface ScanCellData extends ScanGridCell {
  /** NASA POWER grid-cell mean elevation (m), from geometry.coordinates[2]. */
  powerGridElevationM: number;
  /** Uncorrected NASA POWER monthly climatology at grid elevation. */
  rawClimatology: MonthlyClimatology;
  dem: CellDemSamples;
}

/** Physical metrics derived from ScanCellData (ISA-corrected to DEM centre). */
export interface CellMetrics {
  demElevationM: number;
  pressureMbar: number;
  meanTempC: number;
  coldestMonthMinC: number;
  meanPrecipMmDay: number;
  meanRhPct: number;
  meanDiurnalSwingC: number;
  meanInsolationKwhM2Day: number;
  meanAbsSlopeDeg: number;
  localReliefM: number;
}

export type AnalogComponentKey =
  | 'pressure'
  | 'thermal'
  | 'aridity'
  | 'diurnalSwing'
  | 'insolation'
  | 'terrain';

export type AnalogComponents = Record<AnalogComponentKey, number>;

export interface AnalogScore {
  /** Analog Similarity Index 0-100 (weighted sum of components). */
  index: number;
  components: AnalogComponents;
  weights: Record<AnalogComponentKey, number>;
  metrics: CellMetrics;
}

export interface CataloguedAnalog {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface RankedCandidate extends AnalogScore {
  rank: number;
  cell: ScanCellData;
  isNovel: boolean;
  nearestCatalogued: { id: string; name: string; distanceKm: number } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ANALOG_COMPONENT_LABELS: Record<AnalogComponentKey, string> = {
  pressure: 'Low pressure',
  thermal: 'Thermal',
  aridity: 'Aridity',
  diurnalSwing: 'Diurnal swing',
  insolation: 'Insolation/UV',
  terrain: 'Terrain match',
};

/**
 * Target-dependent weights (each set sums to 1).
 * MARS: thin atmosphere, cold and dry dominate the analog value.
 * MOON: no atmosphere is reachable on Earth anyway, so terrain, aridity
 *       (volatile-free surfaces) and thermal cycling dominate.
 */
export const ANALOG_WEIGHTS: Record<PlanetaryBody, Record<AnalogComponentKey, number>> = {
  MARS: {
    pressure: 0.25,
    thermal: 0.2,
    aridity: 0.2,
    diurnalSwing: 0.1,
    insolation: 0.1,
    terrain: 0.15,
  },
  MOON: {
    pressure: 0.1,
    thermal: 0.15,
    aridity: 0.2,
    diurnalSwing: 0.2,
    insolation: 0.1,
    terrain: 0.25,
  },
};

/** Novelty radius: a candidate farther than this from every catalogued analog is flagged NEW. */
export const NOVELTY_RADIUS_KM = 60;

/** Coldest annual thermal blend reachable at accessible terrestrial field sites (Dry Valleys ~ -30 C). */
export const EARTH_THERMAL_FLOOR_C = -30;

/**
 * Classic published terrestrial analog sites (approximate coordinates), used
 * together with the curated catalogue to decide whether a candidate is "new".
 */
export const CLASSIC_PUBLISHED_ANALOGS: CataloguedAnalog[] = [
  { id: 'classic-atacama-yungay', name: 'Atacama Yungay (Chile)', lat: -24.08, lon: -69.93 },
  { id: 'classic-haughton', name: 'Haughton Crater, Devon Island (Canada)', lat: 75.38, lon: -89.68 },
  { id: 'classic-death-valley', name: 'Death Valley (USA)', lat: 36.25, lon: -116.82 },
  { id: 'classic-mauna-kea', name: 'Mauna Kea (Hawaii, USA)', lat: 19.82, lon: -155.47 },
  { id: 'classic-rio-tinto', name: 'Rio Tinto (Spain)', lat: 37.72, lon: -6.56 },
  { id: 'classic-dry-valleys', name: 'McMurdo Dry Valleys (Antarctica)', lat: -77.5, lon: 162.0 },
  { id: 'classic-askja', name: 'Askja (Iceland)', lat: 65.05, lon: -16.75 },
  { id: 'classic-mdrs-utah', name: 'Mars Desert Research Station (Utah, USA)', lat: 38.41, lon: -110.79 },
  { id: 'classic-lanzarote', name: 'Lanzarote (Canary Islands, Spain)', lat: 29.03, lon: -13.63 },
  { id: 'classic-qaidam', name: 'Qaidam Basin (China)', lat: 38.0, lon: 93.0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
const round = (v: number, d = 1) => Number(v.toFixed(d));

/** Wraps a longitude into [-180, 180]. */
export function wrapLongitude(lon: number): number {
  if (!Number.isFinite(lon)) return 0;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && lon > 0 ? 180 : wrapped;
}

/** Great-circle distance (km) on a spherical Earth (R = 6371 km). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Regular grid of cell centres; row 0 is the northernmost row, col 0 the westernmost. */
export function buildScanGrid(bbox: ScanBbox, cols: number, rows: number): ScanGridCell[] {
  const nCols = Math.max(1, Math.floor(cols));
  const nRows = Math.max(1, Math.floor(rows));
  const south = Math.min(bbox.south, bbox.north);
  const north = Math.max(bbox.south, bbox.north);
  const span = bbox.east >= bbox.west ? bbox.east - bbox.west : bbox.east + 360 - bbox.west;
  const dLat = (north - south) / nRows;
  const dLon = span / nCols;
  const cells: ScanGridCell[] = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      cells.push({
        id: `r${r}c${c}`,
        row: r,
        col: c,
        lat: round(north - (r + 0.5) * dLat, 4),
        lon: round(wrapLongitude(bbox.west + (c + 0.5) * dLon), 4),
      });
    }
  }
  return cells;
}

/** Offsets for the 4 DEM arm samples (~offsetKm N/S/E/W of the centre). */
export function buildDemSampleCoords(
  lat: number,
  lon: number,
  offsetKm = 1,
): { center: [number, number]; north: [number, number]; south: [number, number]; east: [number, number]; west: [number, number] } {
  const dLat = offsetKm / 110.574;
  const dLon = offsetKm / Math.max(1, 111.32 * Math.cos((lat * Math.PI) / 180));
  const r5 = (v: number) => round(v, 5);
  return {
    center: [r5(lat), r5(lon)],
    north: [r5(Math.min(89.99, lat + dLat)), r5(lon)],
    south: [r5(Math.max(-89.99, lat - dLat)), r5(lon)],
    east: [r5(lat), r5(wrapLongitude(lon + dLon))],
    west: [r5(lat), r5(wrapLongitude(lon - dLon))],
  };
}

/** Sea / no-data cells: Open-Meteo returns exactly 0 m over ocean for all samples. */
export function isLikelySeaCell(dem: CellDemSamples): boolean {
  return [dem.centerM, dem.northM, dem.southM, dem.eastM, dem.westM].every((v) => v === 0);
}

/** Mean absolute target traverse slope (deg); slopeDeg is signed so Math.abs is applied. */
export function targetMeanAbsSlopeDeg(target: PlanetaryTarget): number {
  return mean(target.traverse.map((p) => Math.abs(p.slopeDeg)));
}

/** Derives ISA-corrected physical metrics for a cell (grid elev = POWER, site elev = DEM centre). */
export function deriveCellMetrics(cell: ScanCellData): CellMetrics {
  const clim = applyIsaLapseRateCorrection(cell.rawClimatology, cell.powerGridElevationM, cell.dem.centerM);
  const { centerM, northM, southM, eastM, westM, sampleOffsetKm } = cell.dem;
  const offsetM = Math.max(1, sampleOffsetKm * 1000);
  const arms = [northM, southM, eastM, westM];
  // Mean absolute slope of the 4 centre-to-arm segments over ~1 km baselines
  const meanAbsSlopeDeg = mean(arms.map((z) => (Math.atan(Math.abs(z - centerM) / offsetM) * 180) / Math.PI));
  const all = [centerM, ...arms];
  return {
    demElevationM: Math.round(centerM),
    pressureMbar: round(mean(clim.PS) * 10, 0),
    meanTempC: round(mean(clim.T2M), 1),
    coldestMonthMinC: round(Math.min(...clim.T2M_MIN), 1),
    meanPrecipMmDay: round(mean(clim.PRECTOTCORR), 2),
    meanRhPct: round(mean(clim.RH2M), 1),
    meanDiurnalSwingC: round(mean(clim.T2M_MAX.map((tMax, i) => tMax - clim.T2M_MIN[i])), 1),
    meanInsolationKwhM2Day: round(mean(clim.ALLSKY_SFC_SW_DWN), 2),
    meanAbsSlopeDeg: round(meanAbsSlopeDeg, 2),
    localReliefM: Math.round(Math.max(...all) - Math.min(...all)),
  };
}

// ---------------------------------------------------------------------------
// Component formulas (each returns 0-100, clamped and monotonic)
// ---------------------------------------------------------------------------

/**
 * Low barometric pressure: P = ISA-corrected annual mean surface pressure (mbar).
 *   pressure = 100 * clamp((1013 - P) / (1013 - 500))
 * 1013 mbar (sea level) -> 0; 500 mbar (~5,500 m, upper limit of accessible terrain) -> 100.
 * Monotonically decreasing in P (lower pressure = closer to Mars / vacuum).
 */
export function scorePressure(pressureMbar: number): number {
  return 100 * clamp01((1013 - pressureMbar) / (1013 - 500));
}

/**
 * Thermal proximity: Tobs = 0.5 * annual mean T2M + 0.5 * coldest-month mean T2M_MIN (C).
 * Teff = max(target.meanTempC, EARTH_THERMAL_FLOOR_C = -30 C) because Earth cannot reach
 * lunar/martian means; the cap keeps the scale usable.
 *   thermal = 100 * clamp((25 - Tobs) / (25 - Teff))
 * Tobs >= 25 C -> 0; Tobs <= Teff -> 100. Monotonically decreasing in Tobs.
 */
export function scoreThermal(meanTempC: number, coldestMonthMinC: number, targetMeanTempC: number): number {
  const tEff = Math.max(targetMeanTempC, EARTH_THERMAL_FLOOR_C);
  const tObs = 0.5 * meanTempC + 0.5 * coldestMonthMinC;
  return 100 * clamp01((25 - tObs) / (25 - tEff));
}

/**
 * Aridity: P = mean PRECTOTCORR (mm/day), RH = mean RH2M (%).
 *   aridity = 100 * (0.6 * clamp(1 - P / 3) + 0.4 * clamp((80 - RH) / 70))
 * 3 mm/day (~1,100 mm/yr) -> 0 precipitation credit; RH 80% -> 0, RH <= 10% -> full credit.
 * Monotonically decreasing in both P and RH.
 */
export function scoreAridity(meanPrecipMmDay: number, meanRhPct: number): number {
  return 100 * (0.6 * clamp01(1 - meanPrecipMmDay / 3) + 0.4 * clamp01((80 - meanRhPct) / 70));
}

/**
 * Diurnal thermal swing: S = mean over months of (T2M_MAX - T2M_MIN) (C).
 *   diurnalSwing = 100 * clamp((S - 5) / (30 - 5))
 * 5 C (maritime) -> 0; 30 C (extreme high desert) -> 100. Monotonically increasing in S.
 */
export function scoreDiurnalSwing(meanDiurnalSwingC: number): number {
  return 100 * clamp01((meanDiurnalSwingC - 5) / (30 - 5));
}

/**
 * Insolation / UV proxy: I = annual mean ALLSKY_SFC_SW_DWN (kWh/m^2/day).
 *   insolation = 100 * clamp((I - 3) / (7.5 - 3))
 * Monotonically increasing in I. (Shortwave all-sky irradiance is a proxy; UV is not measured.)
 */
export function scoreInsolation(meanInsolationKwhM2Day: number): number {
  return 100 * clamp01((meanInsolationKwhM2Day - 3) / (7.5 - 3));
}

/**
 * Terrain match: s = cell mean absolute slope over ~1 km DEM baselines (deg),
 * t = target traverse mean |slopeDeg| (deg, 100 m spacing).
 *   terrain = 100 * clamp(1 - |s - t| / (3 + t))
 * Perfect match -> 100; monotonically decreasing in the mismatch |s - t|.
 * Scale caveat: ~1 km baselines smooth slopes relative to the 100 m target profile.
 */
export function scoreTerrain(cellMeanAbsSlopeDeg: number, targetMeanAbsSlope: number): number {
  return 100 * clamp01(1 - Math.abs(cellMeanAbsSlopeDeg - targetMeanAbsSlope) / (3 + targetMeanAbsSlope));
}

/**
 * Scores one cell against one target.
 *   index = sum_k ANALOG_WEIGHTS[target.body][k] * component_k   (0-100)
 */
export function scoreAnalogCandidate(cell: ScanCellData, target: PlanetaryTarget): AnalogScore {
  const m = deriveCellMetrics(cell);
  const weights = ANALOG_WEIGHTS[target.body];
  const raw: AnalogComponents = {
    pressure: scorePressure(m.pressureMbar),
    thermal: scoreThermal(m.meanTempC, m.coldestMonthMinC, target.meanTempC),
    aridity: scoreAridity(m.meanPrecipMmDay, m.meanRhPct),
    diurnalSwing: scoreDiurnalSwing(m.meanDiurnalSwingC),
    insolation: scoreInsolation(m.meanInsolationKwhM2Day),
    terrain: scoreTerrain(m.meanAbsSlopeDeg, targetMeanAbsSlopeDeg(target)),
  };
  const keys = Object.keys(weights) as AnalogComponentKey[];
  const index = keys.reduce((acc, k) => acc + weights[k] * raw[k], 0);
  const components = Object.fromEntries(keys.map((k) => [k, round(raw[k], 1)])) as AnalogComponents;
  return { index: round(index, 1), components, weights, metrics: m };
}

/** Nearest catalogued analog to a point (null if the catalogue is empty). */
export function nearestCataloguedAnalog(
  lat: number,
  lon: number,
  catalogue: CataloguedAnalog[],
): { id: string; name: string; distanceKm: number } | null {
  let best: { id: string; name: string; distanceKm: number } | null = null;
  for (const a of catalogue) {
    const d = haversineKm(lat, lon, a.lat, a.lon);
    if (!best || d < best.distanceKm) best = { id: a.id, name: a.name, distanceKm: round(d, 1) };
  }
  return best;
}

/**
 * Scores and ranks cells (sea / no-data cells excluded), sorted by index descending
 * (ties broken by cell id for determinism). `curatedSites` are merged with
 * CLASSIC_PUBLISHED_ANALOGS for the novelty test (> NOVELTY_RADIUS_KM from all).
 */
export function rankCandidates(
  cells: ScanCellData[],
  target: PlanetaryTarget,
  curatedSites: CataloguedAnalog[] = [],
): RankedCandidate[] {
  const catalogue = [...curatedSites, ...CLASSIC_PUBLISHED_ANALOGS];
  return cells
    .filter((c) => !isLikelySeaCell(c.dem))
    .map((cell) => {
      const score = scoreAnalogCandidate(cell, target);
      const nearest = nearestCataloguedAnalog(cell.lat, cell.lon, catalogue);
      return {
        ...score,
        rank: 0,
        cell,
        isNovel: !nearest || nearest.distanceKm > NOVELTY_RADIUS_KM,
        nearestCatalogued: nearest,
      };
    })
    .sort((a, b) => b.index - a.index || a.cell.id.localeCompare(b.cell.id))
    .map((c, idx) => ({ ...c, rank: idx + 1 }));
}
