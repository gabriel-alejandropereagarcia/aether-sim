import { describe, expect, it } from 'vitest';
import { EARTH_ANALOG_SITES, MonthlyClimatology, PLANETARY_TARGETS } from '../../data/planetaryData';
import {
  ANALOG_WEIGHTS,
  buildScanGrid,
  CLASSIC_PUBLISHED_ANALOGS,
  haversineKm,
  isLikelySeaCell,
  NOVELTY_RADIUS_KM,
  rankCandidates,
  ScanCellData,
  scoreAnalogCandidate,
  scoreAridity,
  scoreDiurnalSwing,
  scoreInsolation,
  scorePressure,
  scoreTerrain,
  scoreThermal,
  wrapLongitude,
} from '../analogFinder';
import { createCustomProbeSite, deriveProbeFidelityScores } from '../../services/nasaPowerClient';
import punaSnapshot from '../../data/punaScanSnapshot.json';

const MARS = PLANETARY_TARGETS.find((t) => t.id === 'mars-jezero')!;
const MOON = PLANETARY_TARGETS.find((t) => t.id === 'moon-shackleton')!;
const CURATED = EARTH_ANALOG_SITES.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon }));

function flatClim(over: Partial<Record<keyof MonthlyClimatology, number>> = {}): MonthlyClimatology {
  const base = { T2M: 5, T2M_MAX: 15, T2M_MIN: -5, PRECTOTCORR: 0.5, ALLSKY_SFC_SW_DWN: 6, WS10M: 4, RH2M: 35, PS: 62, ...over };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Array(12).fill(v)])) as unknown as MonthlyClimatology;
}

function makeCell(
  id: string,
  lat: number,
  lon: number,
  clim: MonthlyClimatology,
  centerM = 4000,
  armDeltaM = 30,
): ScanCellData {
  return {
    id,
    row: 0,
    col: 0,
    lat,
    lon,
    powerGridElevationM: centerM,
    rawClimatology: clim,
    dem: {
      centerM,
      northM: centerM + armDeltaM,
      southM: centerM - armDeltaM,
      eastM: centerM + armDeltaM,
      westM: centerM - armDeltaM,
      sampleOffsetKm: 1,
    },
  };
}

describe('Analog Finder: grid', () => {
  it('builds row-major cell centres inside the bbox', () => {
    const cells = buildScanGrid({ south: -27.5, north: -22.5, west: -69, east: -65.5 }, 6, 5);
    expect(cells).toHaveLength(30);
    expect(cells[0]).toMatchObject({ id: 'r0c0', row: 0, col: 0 });
    expect(cells[0].lat).toBeCloseTo(-23, 4); // north - 0.5 * 1.0
    expect(cells[0].lon).toBeCloseTo(-69 + 3.5 / 12, 4);
    const last = cells[cells.length - 1];
    expect(last.lat).toBeCloseTo(-27, 4);
    expect(last.lon).toBeCloseTo(-65.5 - 3.5 / 12, 4);
    cells.forEach((c) => {
      expect(c.lat).toBeGreaterThan(-27.5);
      expect(c.lat).toBeLessThan(-22.5);
      expect(c.lon).toBeGreaterThan(-69);
      expect(c.lon).toBeLessThan(-65.5);
    });
  });

  it('wraps longitudes into [-180, 180], including antimeridian-crossing boxes', () => {
    expect(wrapLongitude(190)).toBeCloseTo(-170);
    expect(wrapLongitude(-190)).toBeCloseTo(170);
    expect(wrapLongitude(540)).toBeCloseTo(180);
    const cells = buildScanGrid({ south: 0, north: 2, west: 179, east: -179 }, 2, 1);
    expect(cells[0].lon).toBeCloseTo(179.5);
    expect(cells[1].lon).toBeCloseTo(-179.5);
  });

  it('haversine matches a known distance (1 deg latitude ~ 111.2 km)', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });
});

describe('Analog Finder: components', () => {
  it('are clamped 0-100 and monotonic in the expected direction', () => {
    const series = (f: (x: number) => number, xs: number[]) => xs.map(f);
    const nonIncreasing = (a: number[]) => a.every((v, i) => i === 0 || v <= a[i - 1] + 1e-9);
    const nonDecreasing = (a: number[]) => a.every((v, i) => i === 0 || v >= a[i - 1] - 1e-9);

    const p = series(scorePressure, [1100, 1013, 900, 700, 550, 500, 300]);
    expect(nonDecreasing(p)).toBe(true); // lower pressure -> higher score
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(100);

    const t = series((x) => scoreThermal(x, x - 10, MARS.meanTempC), [30, 20, 5, -5, -20, -40]);
    expect(nonDecreasing(t)).toBe(true); // colder -> higher score
    expect(Math.min(...t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...t)).toBeLessThanOrEqual(100);

    expect(nonIncreasing(series((x) => scoreAridity(x, 30), [0, 0.5, 1, 2, 3, 5]))).toBe(true);
    expect(nonIncreasing(series((x) => scoreAridity(0.5, x), [5, 20, 40, 60, 80, 95]))).toBe(true);
    expect(scoreAridity(0, 5)).toBe(100);
    expect(scoreAridity(10, 95)).toBe(0);

    expect(nonDecreasing(series(scoreDiurnalSwing, [0, 5, 10, 20, 30, 40]))).toBe(true);
    expect(nonDecreasing(series(scoreInsolation, [1, 3, 5, 7.5, 9]))).toBe(true);

    const tgt = 1.65;
    const terr = series((x) => scoreTerrain(tgt + x, tgt), [0, 0.5, 1, 3, 10]);
    expect(terr[0]).toBe(100);
    expect(nonIncreasing(terr)).toBe(true);
    expect(scoreTerrain(tgt - 1, tgt)).toBeCloseTo(scoreTerrain(tgt + 1, tgt), 9);
  });

  it('caps the thermal target at the Earth floor (lunar -135 C behaves like -30 C)', () => {
    expect(scoreThermal(-10, -30, MOON.meanTempC)).toBeCloseTo(scoreThermal(-10, -30, -30), 9);
    expect(scoreThermal(-30, -30, MOON.meanTempC)).toBe(100);
  });

  it('weights sum to 1 for both bodies and differ between Moon and Mars', () => {
    for (const body of ['MOON', 'MARS'] as const) {
      const sum = Object.values(ANALOG_WEIGHTS[body]).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
    expect(ANALOG_WEIGHTS.MARS.pressure).toBeGreaterThan(ANALOG_WEIGHTS.MOON.pressure);
    expect(ANALOG_WEIGHTS.MOON.terrain).toBeGreaterThan(ANALOG_WEIGHTS.MARS.terrain);
    expect(ANALOG_WEIGHTS.MOON.diurnalSwing).toBeGreaterThan(ANALOG_WEIGHTS.MARS.diurnalSwing);
  });

  it('index equals the weighted sum of components and stays within 0-100', () => {
    const cell = makeCell('a', -25, -67, flatClim());
    for (const target of [MARS, MOON]) {
      const s = scoreAnalogCandidate(cell, target);
      const w = ANALOG_WEIGHTS[target.body];
      const manual = (Object.keys(w) as (keyof typeof w)[]).reduce((acc, k) => acc + w[k] * s.components[k], 0);
      expect(s.index).toBeCloseTo(manual, 0);
      expect(s.index).toBeGreaterThanOrEqual(0);
      expect(s.index).toBeLessThanOrEqual(100);
    }
  });
});

describe('Analog Finder: ranking & novelty', () => {
  it('ranks harsher cells first and flags novelty against curated + classic analogs', () => {
    const harsh = makeCell('harsh', -25.9, -66.2, flatClim({ PS: 55, T2M: -4, T2M_MIN: -20, PRECTOTCORR: 0.1, RH2M: 20 }), 4800);
    const mild = makeCell('mild', -26.4, -65.8, flatClim({ PS: 85, T2M: 18, T2M_MAX: 26, T2M_MIN: 10, PRECTOTCORR: 2.5, RH2M: 70 }), 1200);
    // Next to the curated Llullaillaco site -> not novel
    const nearCurated = makeCell('near', -24.7, -68.55, flatClim({ PS: 56 }), 4700);
    // Next to the classic Death Valley entry -> not novel
    const nearClassic = makeCell('dv', 36.3, -116.8, flatClim({ PS: 100, T2M: 25 }), 0, 40);
    const sea = { ...makeCell('sea', -24, -72, flatClim(), 0, 0) };
    expect(isLikelySeaCell(sea.dem)).toBe(true);

    const ranked = rankCandidates([mild, nearClassic, harsh, nearCurated, sea], MARS, CURATED);
    expect(ranked.map((r) => r.cell.id)).not.toContain('sea');
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].index).toBeGreaterThanOrEqual(ranked[i].index);
    const byId = Object.fromEntries(ranked.map((r) => [r.cell.id, r]));
    expect(byId.harsh.index).toBeGreaterThan(byId.mild.index);
    expect(byId.harsh.isNovel).toBe(true);
    expect(byId.mild.isNovel).toBe(true);
    expect(byId.near.isNovel).toBe(false);
    expect(byId.near.nearestCatalogued?.id).toBe('llullaillaco');
    expect(byId.dv.isNovel).toBe(false);
    expect(byId.dv.nearestCatalogued!.distanceKm).toBeLessThan(NOVELTY_RADIUS_KM);
    expect(CLASSIC_PUBLISHED_ANALOGS).toHaveLength(10);
  });
});

describe('Analog Finder: bundled Puna snapshot', () => {
  const cells = punaSnapshot.cells as ScanCellData[];

  it('parses with raw per-cell data and no precomputed scores', () => {
    expect(typeof punaSnapshot.generatedAtUtc).toBe('string');
    expect(Number.isNaN(Date.parse(punaSnapshot.generatedAtUtc))).toBe(false);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(c.rawClimatology.PS).toHaveLength(12);
      expect(c.rawClimatology.T2M_MIN).toHaveLength(12);
      expect(Number.isFinite(c.dem.centerM)).toBe(true);
      expect(Number.isFinite(c.powerGridElevationM)).toBe(true);
      expect((c as unknown as Record<string, unknown>).index).toBeUndefined();
    }
  });

  it('yields non-empty, target-dependent rankings for a Mars and a Moon target', () => {
    const mars = rankCandidates(cells, MARS, CURATED);
    const moon = rankCandidates(cells, MOON, CURATED);
    expect(mars.length).toBeGreaterThan(0);
    expect(moon.length).toBeGreaterThan(0);
    expect(mars[0].index).toBeGreaterThan(0);
    expect(mars.map((r) => r.cell.id)).not.toEqual(moon.map((r) => r.cell.id));
  });
});

describe('Custom probe fidelity scoring', () => {
  it('is not structurally capped below curated sites for an extreme high, cold, hyper-arid site', () => {
    const extreme = deriveProbeFidelityScores({
      elevationM: 5200,
      meanTempC: -8,
      meanPrecipMmDay: 0.05,
      meanRhPct: 12,
      maxAbsSlopeDeg: 16,
      traverseReliefM: 180,
    });
    const curatedMax = Math.max(...EARTH_ANALOG_SITES.map((s) => s.fidelityScores.thermalAtmosphere));
    expect(extreme.thermalAtmosphere).toBeGreaterThanOrEqual(curatedMax);
    expect(extreme.geomorphology).toBeGreaterThanOrEqual(95);
    expect(extreme.geochemistryDielectric).toBeGreaterThanOrEqual(90);
    expect(extreme.regolithMechanics).toBeGreaterThanOrEqual(90);
    expect(extreme.astrobiology).toBeGreaterThanOrEqual(85);

    const temperate = deriveProbeFidelityScores({
      elevationM: 200,
      meanTempC: 18,
      meanPrecipMmDay: 3.5,
      meanRhPct: 78,
      maxAbsSlopeDeg: 1,
      traverseReliefM: 5,
    });
    for (const k of Object.keys(extreme) as (keyof typeof extreme)[]) {
      expect(extreme[k]).toBeGreaterThan(temperate[k]);
      expect(extreme[k]).toBeLessThanOrEqual(96);
    }
  });

  it('createCustomProbeSite keeps using the derived scores', () => {
    const grid = flatClim({ PS: 55, T2M: -6, T2M_MAX: 8, T2M_MIN: -20, PRECTOTCORR: 0.05, RH2M: 15 });
    const site = createCustomProbeSite(-24.7, -68.3, {
      rawClimatology: grid,
      climatology: grid,
      powerGridElevationM: 4900,
      elevationM: 5100,
      pressureMbar: 550,
      status: 'LIVE_NASA_POWER',
      demStatus: 'UNAVAILABLE_FALLBACK',
      latencyMs: 100,
      endpointUrl: 'https://power.larc.nasa.gov/api/temporal/climatology/point',
    });
    expect(site.fidelityScores.thermalAtmosphere).toBeGreaterThanOrEqual(93);
  });
});
