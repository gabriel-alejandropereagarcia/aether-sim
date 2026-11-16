import {
  applyIsaLapseRateCorrection,
  buildTraverseFromCoordsAndElevations,
  EarthAnalogSite,
  MONTHS_SHORT,
  MonthlyClimatology,
  TraversePoint,
} from '../data/planetaryData';

export { applyIsaLapseRateCorrection };

export interface DemSamplePoint {
  distanceKm: number;
  lat: number;
  lon: number;
  elevationM: number;
}

export interface NasaPowerFetchResult {
  rawClimatology: MonthlyClimatology;
  climatology: MonthlyClimatology;
  powerGridElevationM: number;
  elevationM: number;
  pressureMbar: number;
  traversePoints?: DemSamplePoint[];
  status: 'LIVE_NASA_POWER' | 'OFFLINE_FALLBACK';
  demStatus: 'LIVE_COPERNICUS_DEM' | 'CACHED_COPERNICUS_DEM' | 'UNAVAILABLE_FALLBACK';
  latencyMs: number;
  endpointUrl: string;
}

// NASA POWER climatology responses routinely take several seconds; a short timeout
// would turn slow-but-valid answers into synthetic offline fallbacks.
export const API_TIMEOUT_MS = 15000;

/**
 * Derives terrain elevation (m) from surface barometric pressure (kPa)
 * using the US Standard Atmosphere barometric hypsometric equation.
 */
export function deriveElevationFromPressureKpa(pressureKpa: number): number {
  if (!Number.isFinite(pressureKpa) || pressureKpa <= 0) return 0;
  const ratio = Math.min(Math.max(pressureKpa / 101.325, 0.15), 1.15);
  const meters = 44330 * (1 - Math.pow(ratio, 0.190263));
  return Math.round(meters);
}

export function buildEarth2KmCoords(
  lat: number,
  lon: number,
  azimuthDeg = 45,
): { distanceKm: number; lat: number; lon: number }[] {
  const rad = (azimuthDeg * Math.PI) / 180;
  const kmPerDegLat = 110.574;
  const kmPerDegLon = Math.max(12, 111.32 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 21 }, (_, idx) => {
    const dKm = idx * 0.1;
    return {
      distanceKm: Number(dKm.toFixed(1)),
      lat: Number((lat + (Math.cos(rad) * dKm) / kmPerDegLat).toFixed(5)),
      lon: Number((lon + (Math.sin(rad) * dKm) / kmPerDegLon).toFixed(5)),
    };
  });
}

export const NASA_POWER_CLIMATOLOGY_PARAMETERS =
  'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M,RH2M,PS';

/** NASA POWER climatology point endpoint (same request used by the probe and the region scan). */
export function buildNasaPowerClimatologyUrl(lat: number, lon: number): string {
  const clampedLat = Math.max(-89.9, Math.min(89.9, lat));
  const clampedLon = Math.max(-179.9, Math.min(179.9, lon));
  return (
    `https://power.larc.nasa.gov/api/temporal/climatology/point` +
    `?parameters=${NASA_POWER_CLIMATOLOGY_PARAMETERS}` +
    `&community=RE&longitude=${clampedLon.toFixed(4)}&latitude=${clampedLat.toFixed(4)}&format=JSON`
  );
}

/**
 * Strict parser for a NASA POWER climatology payload: returns null when any monthly value
 * is missing or a fill value (<= -900), instead of substituting synthetic numbers.
 */
export function parseNasaPowerClimatologyStrict(
  powerJson: unknown,
): { rawClimatology: MonthlyClimatology; powerGridElevationM: number } | null {
  const json = powerJson as {
    geometry?: { coordinates?: unknown[] };
    properties?: { parameter?: Record<string, Record<string, unknown>> };
  } | null;
  const params = json?.properties?.parameter;
  const gridElev = json?.geometry?.coordinates?.[2];
  if (!params || typeof gridElev !== 'number' || !Number.isFinite(gridElev)) return null;
  const keys = NASA_POWER_CLIMATOLOGY_PARAMETERS.split(',') as (keyof MonthlyClimatology)[];
  const out = {} as MonthlyClimatology;
  for (const key of keys) {
    const block = params[key];
    const arr: number[] = [];
    for (const month of MONTHS_SHORT) {
      const v = block?.[month];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= -900) return null;
      arr.push(Number(v.toFixed(2)));
    }
    out[key] = arr;
  }
  return { rawClimatology: out, powerGridElevationM: Number(gridElev.toFixed(1)) };
}

function parseMonthlyArray(
  paramBlock: Record<string, number> | undefined,
  fallbackArray?: number[],
): number[] {
  return MONTHS_SHORT.map((monthKey, idx) => {
    const raw = paramBlock?.[monthKey];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= -900) {
      return fallbackArray?.[idx] ?? 0;
    }
    return Number(raw.toFixed(2));
  });
}

/**
 * Fetches live 21-point 2.0 km Copernicus DEM GLO-90 elevation profile via Open-Meteo Elevation API.
 */
async function fetchCopernicusDemTraverse(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<{ points: DemSamplePoint[]; demStatus: 'LIVE_COPERNICUS_DEM' | 'UNAVAILABLE_FALLBACK' }> {
  const coords = buildEarth2KmCoords(lat, lon, 45);
  const lats = coords.map((c) => c.lat).join(',');
  const lons = coords.map((c) => c.lon).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;

  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`DEM HTTP ${res.status}`);
    const json = await res.json();
    const elevations = json?.elevation as number[] | undefined;
    if (!Array.isArray(elevations) || elevations.length !== coords.length) {
      throw new Error('Invalid DEM elevation array');
    }
    return {
      points: coords.map((c, idx) => ({
        distanceKm: c.distanceKm,
        lat: c.lat,
        lon: c.lon,
        elevationM: Number((elevations[idx] ?? 0).toFixed(1)),
      })),
      demStatus: 'LIVE_COPERNICUS_DEM',
    };
  } catch {
    return {
      points: coords.map((c) => ({
        distanceKm: c.distanceKm,
        lat: c.lat,
        lon: c.lon,
        elevationM: 0,
      })),
      demStatus: 'UNAVAILABLE_FALLBACK',
    };
  }
}

/**
 * Fetches live 12-month climatology from NASA POWER API (+ Copernicus GLO-90 DEM for custom probes)
 * with AbortController cancellation and ISA lapse-rate altitude correction.
 */
export async function fetchNasaPowerClimatology(
  lat: number,
  lon: number,
  fallbackSite?: EarthAnalogSite,
  externalSignal?: AbortSignal,
): Promise<NasaPowerFetchResult> {
  const clampedLat = Math.max(-89.9, Math.min(89.9, lat));
  const clampedLon = Math.max(-179.9, Math.min(179.9, lon));

  const endpointUrl = buildNasaPowerClimatologyUrl(clampedLat, clampedLon);

  const startedAt = performance.now();
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const powerPromise = fetch(endpointUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
      return res.json();
    });

    const demPromise = fallbackSite
      ? Promise.resolve(null)
      : fetchCopernicusDemTraverse(clampedLat, clampedLon, controller.signal);

    const [powerJson, demRes] = await Promise.all([powerPromise, demPromise]);
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    const params = powerJson?.properties?.parameter as Record<string, Record<string, number>> | undefined;
    if (!params) throw new Error('Malformed NASA POWER response payload');

    const rawGridElev = powerJson?.geometry?.coordinates?.[2];
    const rawClimatology: MonthlyClimatology = {
      T2M: parseMonthlyArray(params.T2M, fallbackSite?.rawGridClimatology.T2M),
      T2M_MAX: parseMonthlyArray(params.T2M_MAX, fallbackSite?.rawGridClimatology.T2M_MAX),
      T2M_MIN: parseMonthlyArray(params.T2M_MIN, fallbackSite?.rawGridClimatology.T2M_MIN),
      PRECTOTCORR: parseMonthlyArray(params.PRECTOTCORR, fallbackSite?.rawGridClimatology.PRECTOTCORR),
      ALLSKY_SFC_SW_DWN: parseMonthlyArray(
        params.ALLSKY_SFC_SW_DWN,
        fallbackSite?.rawGridClimatology.ALLSKY_SFC_SW_DWN,
      ),
      WS10M: parseMonthlyArray(params.WS10M, fallbackSite?.rawGridClimatology.WS10M),
      RH2M: parseMonthlyArray(params.RH2M, fallbackSite?.rawGridClimatology.RH2M),
      PS: parseMonthlyArray(params.PS, fallbackSite?.rawGridClimatology.PS),
    };

    const meanPsKpa = rawClimatology.PS.reduce((acc, v) => acc + v, 0) / 12;
    const powerGridElevationM =
      typeof rawGridElev === 'number' && Number.isFinite(rawGridElev)
        ? Number(rawGridElev.toFixed(1))
        : fallbackSite?.powerGridElevationM ?? deriveElevationFromPressureKpa(meanPsKpa);

    const demOriginElev =
      demRes && demRes.demStatus === 'LIVE_COPERNICUS_DEM'
        ? demRes.points[0].elevationM
        : undefined;

    const siteElevationM = fallbackSite
      ? fallbackSite.elevationM
      : demOriginElev ?? powerGridElevationM;

    const climatology = applyIsaLapseRateCorrection(
      rawClimatology,
      powerGridElevationM,
      siteElevationM,
    );
    const correctedMeanPsKpa = climatology.PS.reduce((acc, v) => acc + v, 0) / 12;

    return {
      rawClimatology,
      climatology,
      powerGridElevationM,
      elevationM: Math.round(siteElevationM),
      pressureMbar: Math.round(correctedMeanPsKpa * 10),
      traversePoints: demRes?.points,
      status: 'LIVE_NASA_POWER',
      demStatus: fallbackSite
        ? 'CACHED_COPERNICUS_DEM'
        : demRes?.demStatus ?? 'UNAVAILABLE_FALLBACK',
      latencyMs: Math.round(performance.now() - startedAt),
      endpointUrl,
    };
  } catch {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    if (fallbackSite) {
      return {
        rawClimatology: fallbackSite.rawGridClimatology,
        climatology: fallbackSite.climatology,
        powerGridElevationM: fallbackSite.powerGridElevationM,
        elevationM: fallbackSite.elevationM,
        pressureMbar: fallbackSite.pressureMbar,
        status: 'OFFLINE_FALLBACK',
        demStatus: 'CACHED_COPERNICUS_DEM',
        latencyMs: Math.round(performance.now() - startedAt),
        endpointUrl,
      };
    }

    // Minimal honest zeroed/neutral offline fallback when probing an unknown point offline
    const fallbackGrid = {
      T2M: Array(12).fill(15),
      T2M_MAX: Array(12).fill(21),
      T2M_MIN: Array(12).fill(9),
      PRECTOTCORR: Array(12).fill(1.2),
      ALLSKY_SFC_SW_DWN: Array(12).fill(4.8),
      WS10M: Array(12).fill(4.0),
      RH2M: Array(12).fill(55),
      PS: Array(12).fill(101.3),
    };
    return {
      rawClimatology: fallbackGrid,
      climatology: fallbackGrid,
      powerGridElevationM: 0,
      elevationM: 0,
      pressureMbar: 1013,
      status: 'OFFLINE_FALLBACK',
      demStatus: 'UNAVAILABLE_FALLBACK',
      latencyMs: Math.round(performance.now() - startedAt),
      endpointUrl,
    };
  }
}

/** Upper bound shared with the curated-site fidelity formulas (planetaryData deriveFidelityScores). */
export const PROBE_FIDELITY_MAX = 96;

/**
 * Continuous, telemetry-only fidelity scores for an uncatalogued probe (no random seeds,
 * no hard per-axis caps below the curated catalogue). Every axis can reach PROBE_FIDELITY_MAX (96),
 * the same ceiling as the curated formulas, so a genuinely extreme (high, cold, hyper-arid) site
 * is not structurally ranked below the curated ones.
 *
 *   arid  = 0.6 * clamp(1 - P/3) + 0.4 * clamp((80 - RH)/70)        P = mean precip mm/day, RH = mean RH2M %
 *   cold  = clamp((10 - Tmean)/25)                                    Tmean = ISA-corrected annual mean T2M (C)
 *   thermalAtmosphere      = clamp(22 + min(48, 48*max(0,z)/5200) + cryo + max(0, 14 - 6P - 0.2*max(0, RH-40)), 25, 96)
 *                            cryo = Tmean < 5 ? min(38, 1.45*(5 - Tmean)) : max(0, 16 - 0.7*(Tmean - 5))
 *                            (identical to the curated-site thermal formula; z = DEM elevation m)
 *   geomorphology          = clamp(56 + min(28, 1.8*maxSlope) + min(12, relief2km/15), 35, 96)
 *                            (curated formula with a DEM-relief term instead of a hand-set geology bonus)
 *   regolithMechanics      = clamp(50 + 46*arid, 35, 96)              dry unconsolidated surface proxy
 *   geochemistryDielectric = clamp(40 + 56*arid, 22, 96)              low-moisture dielectric proxy
 *   astrobiology           = clamp(30 + 40*arid + 26*cold, 22, 96)    low water-activity proxy
 * The regolith/geochemistry/astrobiology axes are climate PROXIES (not measured) and the probe
 * mineralogy/regolith text says so.
 */
export function deriveProbeFidelityScores(input: {
  elevationM: number;
  meanTempC: number;
  meanPrecipMmDay: number;
  meanRhPct: number;
  maxAbsSlopeDeg: number;
  traverseReliefM: number;
}): EarthAnalogSite['fidelityScores'] {
  const c01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const clampScore = (v: number, lo: number) =>
    Math.round(Math.min(PROBE_FIDELITY_MAX, Math.max(lo, Number.isFinite(v) ? v : lo)));
  const { elevationM, meanTempC, meanPrecipMmDay: p, meanRhPct: rh, maxAbsSlopeDeg, traverseReliefM } = input;

  const arid = 0.6 * c01(1 - p / 3) + 0.4 * c01((80 - rh) / 70);
  const cold = c01((10 - meanTempC) / 25);

  const altThermal = Math.min(48, (Math.max(0, elevationM) / 5200) * 48);
  const cryo =
    meanTempC < 5 ? Math.min(38, (5 - meanTempC) * 1.45) : Math.max(0, 16 - (meanTempC - 5) * 0.7);
  const aridThermal = Math.max(0, 14 - p * 6 - Math.max(0, rh - 40) * 0.2);

  return {
    geomorphology: clampScore(
      56 + Math.min(28, maxAbsSlopeDeg * 1.8) + Math.min(12, Math.max(0, traverseReliefM) / 15),
      35,
    ),
    regolithMechanics: clampScore(50 + 46 * arid, 35),
    thermalAtmosphere: clampScore(22 + altThermal + cryo + aridThermal, 25),
    geochemistryDielectric: clampScore(40 + 56 * arid, 22),
    astrobiology: clampScore(30 + 40 * arid + 26 * cold, 22),
  };
}

/**
 * Generates an EarthAnalogSite from a live NASA POWER + Copernicus DEM coordinate probe.
 */
export function createCustomProbeSite(
  lat: number,
  lon: number,
  fetchResult: NasaPowerFetchResult,
): EarthAnalogSite {
  const { climatology, rawClimatology, powerGridElevationM, elevationM, pressureMbar, traversePoints } =
    fetchResult;
  const meanPrecip = climatology.PRECTOTCORR.reduce((a, b) => a + b, 0) / 12;
  const meanTemp = climatology.T2M.reduce((a, b) => a + b, 0) / 12;
  const meanRh = climatology.RH2M.reduce((a, b) => a + b, 0) / 12;

  const isHyperArid = meanPrecip < 0.45 && meanRh < 42;
  const isCryo = meanTemp < 2;
  const isHighAlt = elevationM > 2500;

  const points: TraversePoint[] =
    traversePoints && fetchResult.demStatus === 'LIVE_COPERNICUS_DEM'
      ? buildTraverseFromCoordsAndElevations(traversePoints, {
          0: 'Probe Insertion Point',
          10: '1.0 km DEM Midpoint',
          20: '2.0 km Terminal Waypoint',
        })
      : buildTraverseFromCoordsAndElevations(
          buildEarth2KmCoords(lat, lon, 45).map((c) => ({ ...c, elevationM })),
          { 0: 'Probe Point (DEM Offline)' },
        );

  const maxSlope = Math.max(...points.map((p) => Math.abs(p.slopeDeg)));
  const traverseElevs = points.map((p) => p.elevationM);
  const traverseReliefM = Math.max(...traverseElevs) - Math.min(...traverseElevs);
  const fidelityScores = deriveProbeFidelityScores({
    elevationM,
    meanTempC: meanTemp,
    meanPrecipMmDay: meanPrecip,
    meanRhPct: meanRh,
    maxAbsSlopeDeg: maxSlope,
    traverseReliefM,
  });

  return {
    id: `custom-probe-${lat.toFixed(2)}-${lon.toFixed(2)}`,
    name: `Live Probe (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
    region: 'Dynamic Coordinate Probe',
    country: fetchResult.status === 'LIVE_NASA_POWER' ? 'NASA POWER + Copernicus DEM' : 'Offline Probe',
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    elevationM,
    powerGridElevationM,
    pressureMbar,
    primaryTargetBody: isCryo || isHighAlt ? 'MARS' : 'BOTH',
    bestMatchedTargets: isCryo ? ['mars-arcadia', 'moon-shackleton'] : ['mars-jezero', 'moon-aristarchus'],
    geologyType:
      fetchResult.demStatus === 'LIVE_COPERNICUS_DEM'
        ? `Live coordinate probe (Copernicus GLO-90 DEM ${elevationM} m; NASA POWER grid ${powerGridElevationM} m corrected via ISA -6.5 C/km lapse rate).`
        : 'Coordinate probe (Copernicus DEM unavailable offline; barometric fallback active).',
    mineralogy:
      'In-situ spectral mineralogy not pre-cataloged for arbitrary coordinates — verify via MODIS/ASTER or local field sampling.',
    astrobiologyContext: isHyperArid || isCryo
      ? 'Arid/cold climatic envelope from NASA POWER indicates low liquid-water activity.'
      : 'Moderate/high moisture envelope; prioritize mechanical mobility over sterile astrobiology.',
    partnerAgencyData: [
      {
        agency: 'NASA POWER API (Live)',
        instrument: 'MERRA-2 / CERES Climatology Grid (0.5° × 0.625°)',
        metricLabel: 'Grid Elev -> ISA Lapse-Corrected',
        metricValue: `${powerGridElevationM} m -> ${elevationM} m (${pressureMbar} mbar)`,
        description: `Live climatology adjusted from grid cell elevation to local DEM altitude using standard -6.5 C/km tropospheric lapse rate.`,
        isSynthetic: false,
      },
      {
        agency: 'ESA Copernicus DEM',
        instrument: 'GLO-90 (90 m Global Elevation Grid)',
        metricLabel: '2.0 km Traverse Max Slope',
        metricValue: `${maxSlope.toFixed(1)}° (${fetchResult.demStatus === 'LIVE_COPERNICUS_DEM' ? 'Live' : 'Offline'})`,
        description: '21-point real topographic elevation transect sampled every 100 m via Open-Meteo Elevation service.',
        isSynthetic: false,
      },
    ],
    // Generic sandy-loam / arid regolith baseline (Wong 2008) flagged transparently for uncataloged probes
    regolith: {
      kc: isHyperArid ? 5.2 : 12.4,
      kPhi: isHyperArid ? 680 : 510,
      n: isHyperArid ? 0.9 : 0.78,
      cohesionKpa: isHyperArid ? 0.9 : 2.4,
      frictionAngleDeg: isHyperArid ? 35 : 31,
      frictionCoeffMu: isHyperArid ? 0.58 : 0.52,
      bulkDensityKgM3: 1550,
      dielectricConstant: isHyperArid ? 3.8 : 8.5,
      sourceNote: 'Baseline sandy-loam approximation (Wong 2008); site bevameter testing required.',
    },
    rawGridClimatology: rawClimatology,
    climatology,
    traverse: points,
    fidelityScores,
    fieldLogistics: {
      nearestBase: `Grid Cell (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
      accessDifficulty: 'Site-Specific Reconnaissance Required',
      permitStatus: 'Local Jurisdiction Verification Needed',
      recommendedSeason: 'Peak Months in 4D Matrix',
    },
    dataSourceTag: fetchResult.status === 'LIVE_NASA_POWER' ? 'LIVE_API_MEASURED' : 'OFFLINE_SYNTHETIC',
    isCustomProbe: true,
  };
}
