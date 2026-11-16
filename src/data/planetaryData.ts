import verifiedEarthTelemetry from './verifiedEarthTelemetry.json';

export type PlanetaryBody = 'MOON' | 'MARS';

export interface TraversePoint {
  distanceKm: number;
  lat?: number;
  lon?: number;
  elevationM: number;
  slopeDeg: number;
  roughnessIndex: number;
  label?: string;
}

export interface BekkerWongParams {
  /** Cohesive modulus of deformation (kN/m^(n+1)) */
  kc: number;
  /** Frictional modulus of deformation (kN/m^(n+2)) */
  kPhi: number;
  /** Sinkage exponent (dimensionless) */
  n: number;
  /** Soil cohesion (kPa) */
  cohesionKpa: number;
  /** Internal friction angle (degrees) */
  frictionAngleDeg: number;
  /** Surface wheel-regolith friction coefficient */
  frictionCoeffMu: number;
  /** Bulk density (kg/m^3) */
  bulkDensityKgM3: number;
  /** Real part of relative dielectric permittivity */
  dielectricConstant: number;
  /** Literature provenance for terramechanical moduli */
  sourceNote: string;
}

export interface MonthlyClimatology {
  T2M: number[];
  T2M_MAX: number[];
  T2M_MIN: number[];
  PRECTOTCORR: number[];
  ALLSKY_SFC_SW_DWN: number[];
  WS10M: number[];
  RH2M: number[];
  PS: number[];
}

export interface PartnerAgencyMetric {
  agency: string;
  instrument: string;
  metricLabel: string;
  metricValue: string;
  description: string;
  isSynthetic: boolean;
}

export interface PlanetaryTarget {
  id: string;
  name: string;
  shortName: string;
  body: PlanetaryBody;
  bodyRadiusKm: number;
  missionContext: string;
  citation: string;
  doi: string;
  isTraverseParameterized: boolean;
  lat: number;
  lon: number;
  elevationM: number;
  gravityMs2: number;
  pressurePa: number;
  meanTempC: number;
  tempRangeC: string;
  solarIrradianceWm2: number;
  wmtsLayer: string;
  wmtsUrlTemplate: string;
  landingEllipseKm: [number, number];
  geologySummary: string;
  keyChallenge: string;
  regolith: BekkerWongParams;
  traverse: TraversePoint[];
}

export type EarthDataSourceTag =
  | 'VERIFIED_POWER_AND_COPERNICUS_DEM'
  | 'LIVE_API_MEASURED'
  | 'OFFLINE_SYNTHETIC';

export interface EarthAnalogSite {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  /** Real Copernicus DEM GLO-90 point elevation (m) */
  elevationM: number;
  /** NASA POWER 0.5x0.625 deg grid cell mean elevation (m) */
  powerGridElevationM: number;
  /** ISA lapse-rate & hypsometric corrected mean surface pressure (mbar) */
  pressureMbar: number;
  primaryTargetBody: PlanetaryBody | 'BOTH';
  bestMatchedTargets: string[];
  geologyType: string;
  mineralogy: string;
  astrobiologyContext: string;
  partnerAgencyData: PartnerAgencyMetric[];
  regolith: BekkerWongParams;
  rawGridClimatology: MonthlyClimatology;
  climatology: MonthlyClimatology;
  traverse: TraversePoint[];
  fidelityScores: {
    geomorphology: number;
    regolithMechanics: number;
    thermalAtmosphere: number;
    geochemistryDielectric: number;
    astrobiology: number;
  };
  fieldLogistics: {
    nearestBase: string;
    accessDifficulty: string;
    permitStatus: string;
    recommendedSeason: string;
  };
  dataSourceTag: EarthDataSourceTag;
  isCustomProbe?: boolean;
}

export const MONTHS_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

const ISA_LAPSE_RATE_K_PER_M = 0.0065;
const HYPSOMETRIC_EXPONENT = 5.25588;

/**
 * Applies International Standard Atmosphere (ISA) tropospheric lapse-rate
 * temperature and barometric pressure correction between NASA POWER's grid elevation
 * and the exact DEM site elevation.
 */
export function applyIsaLapseRateCorrection(
  raw: MonthlyClimatology,
  gridElevationM: number,
  siteElevationM: number,
): MonthlyClimatology {
  const deltaH = siteElevationM - gridElevationM;
  if (!Number.isFinite(deltaH) || Math.abs(deltaH) < 1) {
    return raw;
  }

  const deltaT = -ISA_LAPSE_RATE_K_PER_M * deltaH;
  return {
    T2M: raw.T2M.map((t) => Number((t + deltaT).toFixed(2))),
    T2M_MAX: raw.T2M_MAX.map((t) => Number((t + deltaT).toFixed(2))),
    T2M_MIN: raw.T2M_MIN.map((t) => Number((t + deltaT).toFixed(2))),
    PRECTOTCORR: [...raw.PRECTOTCORR],
    ALLSKY_SFC_SW_DWN: [...raw.ALLSKY_SFC_SW_DWN],
    WS10M: [...raw.WS10M],
    RH2M: [...raw.RH2M],
    PS: raw.PS.map((pKpa, idx) => {
      const tGridK = Math.max(180, raw.T2M[idx] + 273.15);
      const ratio = Math.max(0.25, (tGridK - ISA_LAPSE_RATE_K_PER_M * deltaH) / tGridK);
      return Number((pKpa * Math.pow(ratio, HYPSOMETRIC_EXPONENT)).toFixed(2));
    }),
  };
}

/**
 * Signed slope (deg) along the direction of travel for 100 m-spaced elevation samples,
 * using one-sided differences at the ends and central differences inside.
 * Positive = uphill, negative = downhill.
 */
export function computeSignedSlopesDeg(elevationsM: number[]): number[] {
  const last = elevationsM.length - 1;
  return elevationsM.map((elev, idx) => {
    const prevElev = idx > 0 ? elevationsM[idx - 1] : elev;
    const nextElev = idx < last ? elevationsM[idx + 1] : elev;
    const dxMeters = idx === 0 || idx === last ? 100 : 200;
    const deltaElev = nextElev - prevElev;
    return Number(((Math.atan2(deltaElev, dxMeters) * 180) / Math.PI).toFixed(1));
  });
}

/**
 * Constructs a 21-point (0.0 - 2.0 km) traverse from verified GPS coordinates & DEM elevations.
 */
export function buildTraverseFromCoordsAndElevations(
  points: { distanceKm: number; lat: number; lon: number; elevationM: number }[],
  milestoneLabels: Record<number, string> = {},
): TraversePoint[] {
  const slopes = computeSignedSlopesDeg(points.map((p) => p.elevationM));
  return points.map((pt, idx) => {
    const slopeDeg = slopes[idx];
    // Deterministic roughness proxy scaled from local terrain slope gradient
    const roughnessIndex = Number(
      Math.min(0.95, Math.max(0.18, 0.24 + Math.abs(slopeDeg) * 0.032)).toFixed(2),
    );

    return {
      distanceKm: pt.distanceKm,
      lat: pt.lat,
      lon: pt.lon,
      elevationM: Number(pt.elevationM.toFixed(1)),
      slopeDeg,
      roughnessIndex,
      label: milestoneLabels[idx],
    };
  });
}

/**
 * Helper for planetary target traverses parameterized from published stratigraphic/altimetry ranges.
 */
export function buildPlanetaryTraverse(
  baseElevationM: number,
  relativeElevationsM: number[],
  roughnessProfile: number[],
  milestoneLabels: Record<number, string> = {},
): TraversePoint[] {
  const slopes = computeSignedSlopesDeg(relativeElevationsM);
  return relativeElevationsM.map((relElev, idx) => {
    const distanceKm = Number((idx * 0.1).toFixed(1));
    const slopeDeg = slopes[idx];

    return {
      distanceKm,
      elevationM: Number((baseElevationM + relElev).toFixed(1)),
      slopeDeg,
      roughnessIndex: Number((roughnessProfile[idx] ?? 0.45).toFixed(2)),
      label: milestoneLabels[idx],
    };
  });
}

export const MOON_TREK_WMTS =
  'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';

export const MARS_TREK_WMTS =
  'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';

export const PLANETARY_TARGETS: PlanetaryTarget[] = [
  {
    id: 'moon-shackleton',
    name: 'Shackleton-de Gerlache Connecting Ridge (Artemis III South Pole)',
    shortName: 'Shackleton Ridge (Moon)',
    body: 'MOON',
    bodyRadiusKm: 1737.4,
    missionContext: 'NASA Artemis III Candidate Region — High-Illumination Polar Ridge & PSR Boundary',
    citation: 'Zuber et al. (2012) Nature 486:378; Mazarico et al. (2011) Icarus 211:1066 (LOLA)',
    doi: '10.1038/nature11216',
    isTraverseParameterized: true,
    lat: -89.54,
    lon: 129.78,
    elevationM: 2120,
    gravityMs2: 1.62,
    pressurePa: 0,
    meanTempC: -135,
    tempRangeC: '-233 C (PSR) to -43 C (Sunlit Crest)',
    solarIrradianceWm2: 1361,
    wmtsLayer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    wmtsUrlTemplate: MOON_TREK_WMTS,
    landingEllipseKm: [0.4, 0.25],
    geologySummary:
      'Highland anorthositic massif crest (+2.1 km above lunar datum) bridging Shackleton and de Gerlache craters with ~5 deg ridge flats flanked by >15 deg PSR walls.',
    keyChallenge:
      'Grazing solar elevation (<3 deg), extreme thermal gradients across short distances, and cohesive high-friction polar regolith.',
    regolith: {
      kc: 1.4,
      kPhi: 820,
      n: 1.0,
      cohesionKpa: 0.52,
      frictionAngleDeg: 42,
      frictionCoeffMu: 0.68,
      bulkDensityKgM3: 1580,
      dielectricConstant: 3.1,
      sourceNote: 'Carrier et al. (1991), Lunar Sourcebook Ch. 9 (kc=0.14 N/cm^2, k_phi=0.82 N/cm^3, n=1.0).',
    },
    traverse: buildPlanetaryTraverse(
      2120,
      [0, 5, 11, 18, 25, 32, 38, 43, 47, 50, 52, 53, 51, 45, 34, 18, -2, -24, -44, -60, -72],
      [0.32, 0.34, 0.36, 0.38, 0.39, 0.37, 0.35, 0.32, 0.30, 0.28, 0.29, 0.31, 0.35, 0.42, 0.54, 0.65, 0.72, 0.75, 0.71, 0.66, 0.61],
      {
        0: 'Connecting Ridge Pad (LOLA +2,120 m)',
        6: 'Gentle Sunlit Crest (<5 deg)',
        11: 'Peak Illumination Relay',
        16: 'PSR Margin Descent (>12 deg)',
        20: 'Cold-Trap Core Margin',
      },
    ),
  },
  {
    id: 'moon-marius',
    name: 'Marius Hills Pit & Lava Tube Skylight',
    shortName: 'Marius Hills Skylight (Moon)',
    body: 'MOON',
    bodyRadiusKm: 1737.4,
    missionContext: 'JAXA SELENE / NASA LROC Skylight Subsurface Cave Access Target',
    citation: 'Haruyama et al. (2009) GRL 36:L21206; Robinson et al. (2012) PSS 69:18 (58x49 m, ~40 m deep)',
    doi: '10.1029/2009GL040635',
    isTraverseParameterized: true,
    lat: 14.09,
    lon: -56.77,
    elevationM: -1820,
    gravityMs2: 1.62,
    pressurePa: 0,
    meanTempC: -20,
    tempRangeC: '-173 C (Night) to +118 C (Noon); ~+17 C inside Tube',
    solarIrradianceWm2: 1361,
    wmtsLayer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    wmtsUrlTemplate: MOON_TREK_WMTS,
    landingEllipseKm: [0.6, 0.4],
    geologySummary:
      'Collapsed mare basalt skylight (58 x 49 m rim, 40 m floor depth per LRO NAC high-Sun imaging) hosted within an ancient sinuous volcanic rille.',
    keyChallenge:
      'Steep basaltic collapse rim, sharp vesicular clasts, and tether/abseil transition over vertical overhang.',
    regolith: {
      kc: 2.1,
      kPhi: 960,
      n: 0.95,
      cohesionKpa: 0.45,
      frictionAngleDeg: 40,
      frictionCoeffMu: 0.72,
      bulkDensityKgM3: 1720,
      dielectricConstant: 6.4,
      sourceNote: 'Carrier et al. (1991) dense mare basaltic regolith upper bound + LROC NAC floor boulder estimates.',
    },
    traverse: buildPlanetaryTraverse(
      -1820,
      [0, 2, 5, 8, 12, 16, 19, 21, 18, 12, 2, -16, -38, -40, -39, -35, -26, -15, -6, -2, 0],
      [0.34, 0.36, 0.40, 0.44, 0.48, 0.54, 0.62, 0.71, 0.80, 0.88, 0.93, 0.95, 0.91, 0.85, 0.80, 0.74, 0.66, 0.56, 0.48, 0.42, 0.38],
      {
        0: 'Mare Basalt Staging',
        7: 'Rille Margin Approach',
        11: 'Skylight Rim Anchor (0 m drop)',
        13: 'Pit Floor (-40 m LRO NAC depth)',
        20: 'Opposite Mare Rim',
      },
    ),
  },
  {
    id: 'moon-aristarchus',
    name: 'Aristarchus Plateau Pyroclastic Deposit',
    shortName: 'Aristarchus Plateau (Moon)',
    body: 'MOON',
    bodyRadiusKm: 1737.4,
    missionContext: 'Lunar Endurance / ISRU Pyroclastic Glass-Bead Oxygen & Volatile Prospecting',
    citation: 'Campbell et al. (2008) Geology 36:135; Glotch et al. (2010) Science 329:1510',
    doi: '10.1130/G24310A.1',
    isTraverseParameterized: true,
    lat: 24.01,
    lon: -51.4,
    elevationM: 950,
    gravityMs2: 1.62,
    pressurePa: 0,
    meanTempC: -28,
    tempRangeC: '-175 C (Night) to +112 C (Noon)',
    solarIrradianceWm2: 1361,
    wmtsLayer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    wmtsUrlTemplate: MOON_TREK_WMTS,
    landingEllipseKm: [0.8, 0.5],
    geologySummary:
      'Extensive dark-mantle pyroclastic glass-bead blanket (>10 m radar-measured thickness) overlying uplifted crustal block near Vallis Schroteri.',
    keyChallenge:
      'Ultra-loose, low-cohesion glass-bead pyroclastics causing elevated wheel sinkage and fine abrasive dust adhesion.',
    regolith: {
      kc: 0.9,
      kPhi: 540,
      n: 1.08,
      cohesionKpa: 0.28,
      frictionAngleDeg: 35,
      frictionCoeffMu: 0.56,
      bulkDensityKgM3: 1460,
      dielectricConstant: 4.8,
      sourceNote: 'Carrier et al. (1991) loose pyroclastic / rim crest lower bound (kc=0.09 N/cm^2, k_phi=0.54 N/cm^3).',
    },
    traverse: buildPlanetaryTraverse(
      950,
      [0, 3, 7, 12, 18, 24, 30, 36, 41, 45, 48, 50, 49, 46, 42, 39, 37, 38, 41, 45, 49],
      [0.24, 0.26, 0.29, 0.32, 0.35, 0.38, 0.40, 0.42, 0.43, 0.41, 0.38, 0.35, 0.34, 0.37, 0.40, 0.43, 0.45, 0.41, 0.37, 0.34, 0.32],
      {
        0: 'Dark Mantle Entry',
        6: 'Pyroclastic Blanket Slope',
        11: 'Vallis Schroteri Shoulder',
        16: 'Glass-Bead Trench Station',
        20: 'ISRU Prospecting Beacon',
      },
    ),
  },
  {
    id: 'mars-jezero',
    name: 'Jezero Crater Western Delta Scarp (Hawksbill Gap)',
    shortName: 'Jezero Delta Scarp (Mars)',
    body: 'MARS',
    bodyRadiusKm: 3389.5,
    missionContext: 'NASA Mars 2020 Perseverance Delta Front Climb (Hawksbill Gap Section)',
    citation: 'Stack et al. (2020) Space Sci. Rev. 216:127; Mangold et al. (2021) Science 374:abj4325',
    doi: '10.1126/science.abj4325',
    isTraverseParameterized: true,
    lat: 18.44,
    lon: 77.45,
    elevationM: -2555,
    gravityMs2: 3.721,
    pressurePa: 610,
    meanTempC: -62,
    tempRangeC: '-102 C (Dawn) to -14 C (Midday)',
    solarIrradianceWm2: 589,
    wmtsLayer: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    wmtsUrlTemplate: MARS_TREK_WMTS,
    landingEllipseKm: [1.5, 1.0],
    geologySummary:
      'Lacustrine-fluvial clay/carbonate delta ramp ascending ~60 m from -2,555 m crater-floor contact up stratified mudstones and sandstone benches (-2,495 m MOLA datum).',
    keyChallenge:
      'Boulder-strewn delta ramps flanked by wind-rippled aeolian sand traps inducing wheel slip.',
    regolith: {
      kc: 1.8,
      kPhi: 740,
      n: 0.92,
      cohesionKpa: 0.95,
      frictionAngleDeg: 36,
      frictionCoeffMu: 0.61,
      bulkDensityKgM3: 1520,
      dielectricConstant: 4.5,
      sourceNote: 'Arvidson et al. (2014) / Sullivan et al. (2011) MER/MSL sandy-regolith terramechanics range.',
    },
    traverse: buildPlanetaryTraverse(
      -2555,
      [0, 2, 4, 7, 11, 16, 22, 28, 33, 38, 42, 46, 49, 51, 53, 55, 57, 58, 59, 60, 60],
      [0.42, 0.45, 0.50, 0.55, 0.61, 0.67, 0.72, 0.70, 0.65, 0.60, 0.55, 0.52, 0.49, 0.54, 0.58, 0.62, 0.60, 0.55, 0.50, 0.46, 0.43],
      {
        0: 'Seitah Dune Contact (-2,555 m)',
        5: 'Delta Ramp Base',
        10: 'Hawksbill Gap Mudstones (-2,513 m)',
        15: 'Rocky Top Bench',
        20: 'Upper Delta Margin (-2,495 m)',
      },
    ),
  },
  {
    id: 'mars-arcadia',
    name: 'Arcadia Planitia Subsurface Ice Sheet Plain',
    shortName: 'Arcadia Ice Plain (Mars)',
    body: 'MARS',
    bodyRadiusKm: 3389.5,
    missionContext: 'Human Mars ISRU Shallow Water-Ice Mining Candidate (SHARAD / MOLA)',
    citation: 'Plaut et al. (2009) GRL 36:L02203; Piqueux et al. (2019) GRL 46:14290',
    doi: '10.1029/2019GL083947',
    isTraverseParameterized: true,
    lat: 39.2,
    lon: -172.0,
    elevationM: -3890,
    gravityMs2: 3.721,
    pressurePa: 720,
    meanTempC: -74,
    tempRangeC: '-118 C (Winter) to -22 C (Summer)',
    solarIrradianceWm2: 520,
    wmtsLayer: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    wmtsUrlTemplate: MARS_TREK_WMTS,
    landingEllipseKm: [3.2, 2.1],
    geologySummary:
      'Smooth mid-latitude volcanic-sedimentary plain underlain by buried glacier-like water ice sheets within 0.5-2.0 m of desiccated dust overburden.',
    keyChallenge:
      'GPR dielectric attenuation across permafrost boundaries and rotary cryo-drill bit binding at -75 C.',
    regolith: {
      kc: 3.4,
      kPhi: 1120,
      n: 0.82,
      cohesionKpa: 1.85,
      frictionAngleDeg: 38,
      frictionCoeffMu: 0.58,
      bulkDensityKgM3: 1640,
      dielectricConstant: 3.3,
      sourceNote: 'Ice-cemented Martian permafrost overburden stiffness approximation (Piqueux et al. 2019 thermal inertia).',
    },
    traverse: buildPlanetaryTraverse(
      -3890,
      [0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 7, 6, 7, 8, 9, 10, 11, 10, 9, 10, 11],
      [0.18, 0.20, 0.22, 0.24, 0.26, 0.28, 0.27, 0.23, 0.21, 0.24, 0.25, 0.23, 0.21, 0.24, 0.27, 0.26, 0.23, 0.21, 0.20, 0.21, 0.23],
      {
        0: 'Ice-Sheet Landing Zone',
        6: 'Polygonal Patterned Ground',
        11: 'SHARAD Shallow-Ice Anomaly',
        16: 'ISRU Rodwell Borehole 1',
        20: 'Habitation Power Array',
      },
    ),
  },
  {
    id: 'mars-gale',
    name: 'Gale Crater — Mount Sharp Sulfate & Boxwork Ridge',
    shortName: 'Mount Sharp Boxwork (Mars)',
    body: 'MARS',
    bodyRadiusKm: 3389.5,
    missionContext: 'NASA MSL Curiosity Sulfate-Bearing & Boxwork Ridge Ascent',
    citation: 'Milliken et al. (2010) GRL 37:L04201; Vasavada (2022) Space Sci. Rev. 218:14',
    doi: '10.1007/s11214-022-00882-7',
    isTraverseParameterized: true,
    lat: -5.08,
    lon: 137.85,
    elevationM: -4040,
    gravityMs2: 3.721,
    pressurePa: 730,
    meanTempC: -56,
    tempRangeC: '-95 C (Night) to -5 C (Day)',
    solarIrradianceWm2: 590,
    wmtsLayer: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    wmtsUrlTemplate: MARS_TREK_WMTS,
    landingEllipseKm: [1.2, 0.8],
    geologySummary:
      'Elevated polygonal fracture-fill boxwork ridges rich in Mg-sulfates ascending ~135 m along Aeolis Mons above Gediz Vallis.',
    keyChallenge:
      'Knife-edged diagenetic sulfate ridges and sharp ventifact bedrock slabs threatening aluminum rover wheels.',
    regolith: {
      kc: 2.6,
      kPhi: 890,
      n: 0.88,
      cohesionKpa: 1.35,
      frictionAngleDeg: 39,
      frictionCoeffMu: 0.65,
      bulkDensityKgM3: 1690,
      dielectricConstant: 5.2,
      sourceNote: 'MSL Curiosity rover mobility over sulfate-cemented bedrock & regolith (Vasavada 2022).',
    },
    traverse: buildPlanetaryTraverse(
      -4040,
      [0, 4, 9, 16, 24, 33, 43, 52, 60, 66, 73, 82, 92, 101, 108, 114, 120, 126, 131, 133, 135],
      [0.48, 0.53, 0.59, 0.66, 0.73, 0.78, 0.81, 0.77, 0.72, 0.66, 0.72, 0.79, 0.84, 0.81, 0.76, 0.71, 0.75, 0.80, 0.77, 0.73, 0.69],
      {
        0: 'Gediz Vallis Margin (-4,040 m)',
        6: 'Sulfate Unit Transition',
        12: 'Boxwork Ridge Apex',
        16: 'Fracture-Fill Vein Wall',
        20: 'Upper Evaporite Bench (-3,905 m)',
      },
    ),
  },
];

interface VerifiedTelemetryFile {
  generatedAtUtc: string;
  sites: Record<
    string,
    {
      lat: number;
      lon: number;
      azimuthDeg: number;
      powerGridElevationM: number;
      demElevationM: number;
      rawClimatology: MonthlyClimatology;
      traversePoints: { distanceKm: number; lat: number; lon: number; elevationM: number }[];
    }
  >;
}

const VERIFIED_DATA = verifiedEarthTelemetry as VerifiedTelemetryFile;

/**
 * Deterministically derives 5-axis baseline analog fidelity scores from verified physical
 * parameters (barometric pressure, temperature, precipitation, DEM slopes) and documented geology class.
 */
function deriveFidelityScores(
  rawElevM: number,
  climatology: MonthlyClimatology,
  traverse: TraversePoint[],
  geologyClass: {
    geomorBonus: number;
    geoChemScore: number;
    astroScore: number;
    mechScore: number;
  },
) {
  const meanTempC = climatology.T2M.reduce((a, b) => a + b, 0) / 12;
  const meanPrecip = climatology.PRECTOTCORR.reduce((a, b) => a + b, 0) / 12;
  const meanRh = climatology.RH2M.reduce((a, b) => a + b, 0) / 12;
  const maxSlope = Math.max(...traverse.map((p) => Math.abs(p.slopeDeg)));

  const altThermalFactor = Math.min(48, (Math.max(0, rawElevM) / 5200) * 48);
  const cryoFactor = meanTempC < 5 ? Math.min(38, (5 - meanTempC) * 1.45) : Math.max(0, 16 - (meanTempC - 5) * 0.7);
  const aridFactor = Math.max(0, 14 - meanPrecip * 6 - Math.max(0, meanRh - 40) * 0.2);
  const thermalAtmosphere = Math.round(Math.min(96, Math.max(25, 22 + altThermalFactor + cryoFactor + aridFactor)));

  const slopeMatchBonus = Math.min(28, maxSlope * 1.8);
  const geomorphology = Math.round(Math.min(96, Math.max(60, 56 + slopeMatchBonus + geologyClass.geomorBonus)));

  return {
    geomorphology,
    regolithMechanics: geologyClass.mechScore,
    thermalAtmosphere,
    geochemistryDielectric: geologyClass.geoChemScore,
    astrobiology: geologyClass.astroScore,
  };
}

interface SiteSeed {
  id: string;
  name: string;
  region: string;
  country: string;
  primaryTargetBody: PlanetaryBody | 'BOTH';
  bestMatchedTargets: string[];
  geologyType: string;
  mineralogy: string;
  astrobiologyContext: string;
  partnerAgencyData: PartnerAgencyMetric[];
  regolith: BekkerWongParams;
  geologyClass: { geomorBonus: number; geoChemScore: number; astroScore: number; mechScore: number };
  fieldLogistics: EarthAnalogSite['fieldLogistics'];
  milestones: Record<number, string>;
}

const SITE_SEEDS: SiteSeed[] = [
  {
    id: 'llullaillaco',
    name: 'Volcan Llullaillaco High-Altitude Apron',
    region: 'Puna de Atacama, Salta',
    country: 'Argentina',
    primaryTargetBody: 'MARS',
    bestMatchedTargets: ['mars-jezero', 'mars-arcadia', 'mars-gale'],
    geologyType: 'Hyper-arid dacitic/andesitic volcanic scree, tephra permafrost & low-pressure Mars UV apron',
    mineralogy: 'Andesitic plagioclase, cristobalite, gypsum, trace perchlorates (Lynch et al. 2019)',
    astrobiologyContext: 'Extreme-altitude (>5,000 m) microbial limit under intense UV flux & freeze-thaw cycles (Costello et al. 2009).',
    partnerAgencyData: [
      {
        agency: 'CONAE (Argentina)',
        instrument: 'SAOCOM 1A/1B L-Band SAR (1.275 GHz)',
        metricLabel: 'Sensor Band & Mode',
        metricValue: 'L-Band Full-Pol (1.275 GHz)',
        description: 'CONAE SAOCOM 1A/1B provides L-band SAR penetration sensitive to subsurface moisture and soil roughness across the Argentine Puna.',
        isSynthetic: false,
      },
      {
        agency: 'ESA / Peer-Reviewed',
        instrument: 'Copernicus DEM GLO-90 + Lynch et al. (2019)',
        metricLabel: 'DEM Apron Transect',
        metricValue: '5,093 m -> 5,592 m',
        description: 'Actual 2.0 km elevation transect extracted from Copernicus GLO-90; Lynch et al. (2019, Astrobiology) characterize Llullaillaco Mars-analog soils.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 1.9,
      kPhi: 770,
      n: 0.91,
      cohesionKpa: 0.92,
      frictionAngleDeg: 37,
      frictionCoeffMu: 0.62,
      bulkDensityKgM3: 1510,
      dielectricConstant: 3.4,
      sourceNote: 'Dry volcanic sand/scree terramechanics range (Wong 2008, Table 2.1 sandy loam / dry volcanic soil).',
    },
    geologyClass: { geomorBonus: 14, geoChemScore: 86, astroScore: 95, mechScore: 91 },
    fieldLogistics: {
      nearestBase: 'Tolar Grande / Salar de Llullaillaco Track (Salta, AR)',
      accessDifficulty: 'High-Altitude 4x4 Expedition (Hypoxia Protocol Required)',
      permitStatus: 'Salta Provincial Mining & High-Andes Research Permit',
      recommendedSeason: 'May - October (Dry Austral Winter)',
    },
    milestones: {
      0: 'NW Volcanic Apron Base (5,093 m)',
      10: 'Mid-Apron Tephra Bench',
      20: 'High-UV Permafrost Crest (5,592 m)',
    },
  },
  {
    id: 'arizaro',
    name: 'Salar de Arizaro & Cono de Arita',
    region: 'Puna Saltena, Salta',
    country: 'Argentina',
    primaryTargetBody: 'MARS',
    bestMatchedTargets: ['mars-gale', 'mars-jezero'],
    geologyType: 'Endorheic chloride/sulfate evaporite playa & volcanic cinder edifice (Cono de Arita)',
    mineralogy: 'Halite, gypsum, mirabilite, ulexite, basaltic-andesitic pyroclastics (Alonso 2006)',
    astrobiologyContext: 'Hypersaline chaotropic brines & halophilic evaporite endoliths modeling drying Martian paleolakes.',
    partnerAgencyData: [
      {
        agency: 'CONAE (Argentina)',
        instrument: 'SAOCOM 1A/1B L-Band SAR',
        metricLabel: 'Wavelength / Penetration',
        metricValue: '23.5 cm (L-Band)',
        description: '23.5 cm L-band SAR penetrates dry evaporite salt crusts to map buried brine/paleochannel moisture gradients.',
        isSynthetic: false,
      },
      {
        agency: 'ESA Copernicus',
        instrument: 'Copernicus DEM GLO-90 + Sentinel-2 SWIR',
        metricLabel: 'DEM Basin Profile',
        metricValue: '3,549 m -> 3,469 m',
        description: 'Verified Copernicus GLO-90 transect descending from Cono de Arita flank onto Arizaro halite polygons.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 2.5,
      kPhi: 870,
      n: 0.87,
      cohesionKpa: 1.42,
      frictionAngleDeg: 38,
      frictionCoeffMu: 0.64,
      bulkDensityKgM3: 1680,
      dielectricConstant: 5.1,
      sourceNote: 'Evaporite salt-crust & compacted desert playa soil moduli range (Wong 2008).',
    },
    geologyClass: { geomorBonus: 16, geoChemScore: 95, astroScore: 88, mechScore: 89 },
    fieldLogistics: {
      nearestBase: 'Tolar Grande Logistics Hub (Salta, AR)',
      accessDifficulty: 'Moderate 4x4 Track via RP27',
      permitStatus: 'Salta Provincial Research & Environmental Clearance',
      recommendedSeason: 'April - November',
    },
    milestones: {
      0: 'Cono de Arita Apron (3,549 m)',
      10: 'Evaporite Margin Transition',
      20: 'Arizaro Halite Playa Floor (3,469 m)',
    },
  },
  {
    id: 'piedra-pomez',
    name: 'Campo de Piedra Pomez',
    region: 'Antofagasta de la Sierra, Catamarca',
    country: 'Argentina',
    primaryTargetBody: 'BOTH',
    bestMatchedTargets: ['mars-jezero', 'moon-aristarchus', 'mars-gale'],
    geologyType: 'Aeolian-sculpted rhyolitic ignimbrite yardangs & pumice mega-ripples',
    mineralogy: 'Rhyolitic glass, pumice, sanidine, biotite (de Silva et al. 2010)',
    astrobiologyContext: 'Wind-scoured ignimbrite cavities modeling UV-shielded endolithic habitats.',
    partnerAgencyData: [
      {
        agency: 'CONAE / Peer-Reviewed',
        instrument: 'SAOCOM L-Band + de Silva et al. (2010)',
        metricLabel: 'Aeolian Yardang Field',
        metricValue: '2.0 km DEM Corridor',
        description: 'Documented mega-ripple & ignimbrite yardang analog for Martian aeolian erosion (de Silva et al. 2010, JGR Planets).',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 1.1,
      kPhi: 590,
      n: 1.04,
      cohesionKpa: 0.35,
      frictionAngleDeg: 35,
      frictionCoeffMu: 0.57,
      bulkDensityKgM3: 1390,
      dielectricConstant: 3.9,
      sourceNote: 'Low-cohesion pumice/volcanic ash mobility approximation (Wong 2008).',
    },
    geologyClass: { geomorBonus: 26, geoChemScore: 82, astroScore: 79, mechScore: 88 },
    fieldLogistics: {
      nearestBase: 'El Penon / Antofagasta de la Sierra (Catamarca, AR)',
      accessDifficulty: '4x4 Sand-Track Navigation Required',
      permitStatus: 'Catamarca Protected Natural Area Permit',
      recommendedSeason: 'April - November',
    },
    milestones: {
      0: 'Pumice Ripple Entry (3,013 m)',
      10: 'Ignimbrite Yardang Corridor',
      20: 'Aeolian Basin Terminal (3,007 m)',
    },
  },
  {
    id: 'craters-of-the-moon',
    name: 'Craters of the Moon Lava Tubes',
    region: 'Snake River Plain, Idaho',
    country: 'United States',
    primaryTargetBody: 'MOON',
    bestMatchedTargets: ['moon-marius', 'moon-aristarchus'],
    geologyType: 'Holocene basaltic pahoehoe/aa flows, cinder cones, and intact lava tube skylights',
    mineralogy: 'Fe-rich olivine basalt, vesicular plagioclase, volcanic glass spatter',
    astrobiologyContext: 'Basaltic lava cave microclimates & chemolithotrophic biofilms (NASA FINESSE / BASALT).',
    partnerAgencyData: [
      {
        agency: 'NASA SSERVI',
        instrument: 'FINESSE & BASALT Field Campaigns (Heldmann et al.)',
        metricLabel: 'Analog Mission Context',
        metricValue: 'EVA + GPR Lava Tubes',
        description: 'Official NASA SSERVI analog testbed for lunar/Martian lava tube mapping, EVA science operations, and GPR.',
        isSynthetic: false,
      },
      {
        agency: 'USGS / JAXA Reference',
        instrument: 'Copernicus DEM + SELENE Gravimetry Analog',
        metricLabel: 'DEM Basalt Transect',
        metricValue: '1,740 m -> 1,766 m',
        description: 'Verified Copernicus GLO-90 basaltic lava field profile; benchmarked with Haruyama et al. (2009) lunar skylight studies.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 2.2,
      kPhi: 940,
      n: 0.94,
      cohesionKpa: 0.48,
      frictionAngleDeg: 41,
      frictionCoeffMu: 0.71,
      bulkDensityKgM3: 1710,
      dielectricConstant: 6.2,
      sourceNote: 'Crushed vesicular basaltic regolith mechanical range.',
    },
    geologyClass: { geomorBonus: 26, geoChemScore: 91, astroScore: 82, mechScore: 89 },
    fieldLogistics: {
      nearestBase: 'Arco, Idaho (30 km E)',
      accessDifficulty: 'Paved Access + Rough Lava Field Scramble',
      permitStatus: 'US National Park Service Scientific Research Permit',
      recommendedSeason: 'July - September (Dry Basalt Season)',
    },
    milestones: {
      0: 'Basalt Flow Staging (1,740 m)',
      10: 'Lava Tube Fracture Ridge',
      20: 'Cinder Margin (1,766 m)',
    },
  },
  {
    id: 'devon-island',
    name: 'Devon Island — Haughton Impact Crater',
    region: 'Nunavut, High Arctic',
    country: 'Canada',
    primaryTargetBody: 'BOTH',
    bestMatchedTargets: ['moon-shackleton', 'mars-arcadia'],
    geologyType: '23-km Miocene impact crater with polymict melt breccia & continuous periglacial permafrost',
    mineralogy: 'Carbonate-silicate impact breccia, shocked quartz, ground-ice wedges (Lee & Osinski 2005)',
    astrobiologyContext: 'Cryophilic endolithic communities in shocked breccia & Mars-analog permafrost drilling.',
    partnerAgencyData: [
      {
        agency: 'NASA / CSA',
        instrument: 'Haughton-Mars Project (Lee & Osinski 2005, MAPS)',
        metricLabel: 'Impact Structure',
        metricValue: '23 km Diameter Breccia',
        description: 'Long-running NASA/CSA polar impact analog for pressurized rovers, EVA suits, and cryogenic ground-ice drilling.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 3.1,
      kPhi: 1050,
      n: 0.85,
      cohesionKpa: 1.65,
      frictionAngleDeg: 40,
      frictionCoeffMu: 0.63,
      bulkDensityKgM3: 1620,
      dielectricConstant: 3.2,
      sourceNote: 'Periglacial breccia & frozen active-layer geotechnical range.',
    },
    geologyClass: { geomorBonus: 22, geoChemScore: 76, astroScore: 89, mechScore: 86 },
    fieldLogistics: {
      nearestBase: 'Resolute Bay (Air Charter, 165 km W)',
      accessDifficulty: 'Polar Airlift + Tracked ATV Support',
      permitStatus: 'Nunavut Research Institute & Impact Site Permit',
      recommendedSeason: 'March - May (Frozen) or July - August',
    },
    milestones: {
      0: 'Haughton Crater Rim Sector (138 m)',
      10: 'Impact Breccia Slope',
      20: 'Permafrost Terrace (175 m)',
    },
  },
  {
    id: 'atacama-yungay',
    name: 'Atacama — Yungay Hyper-Arid Core',
    region: 'Antofagasta Region',
    country: 'Chile',
    primaryTargetBody: 'MARS',
    bestMatchedTargets: ['mars-jezero', 'mars-gale'],
    geologyType: 'Hyper-arid alluvial fans, nitrate/perchlorate duricrusts, and Mars-like soil chemistry',
    mineralogy: 'Halite, anhydrite, perchlorates, smectite clays (Navarro-Gonzalez et al. 2003, Science)',
    astrobiologyContext: 'Hyper-arid dry limit for microbial biomass; Viking/MSL SAM organics benchmark (Science 302:1018).',
    partnerAgencyData: [
      {
        agency: 'NASA / Peer-Reviewed',
        instrument: 'ARADS / LITA + Navarro-Gonzalez et al. (2003)',
        metricLabel: 'Published Soil Benchmark',
        metricValue: 'Science 302:1018 (2003)',
        description: 'Benchmark NASA life-detection rover site (ARADS) with ultra-low organic carbon and oxidized perchlorate soils.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 2.0,
      kPhi: 790,
      n: 0.9,
      cohesionKpa: 1.15,
      frictionAngleDeg: 37,
      frictionCoeffMu: 0.6,
      bulkDensityKgM3: 1560,
      dielectricConstant: 3.8,
      sourceNote: 'Arid nitrate-cemented alluvial desert regolith range (Wong 2008).',
    },
    geologyClass: { geomorBonus: 18, geoChemScore: 96, astroScore: 98, mechScore: 88 },
    fieldLogistics: {
      nearestBase: 'Antofagasta / Yungay Field Station (75 km SE)',
      accessDifficulty: 'Easy 4x4 Access via Pan-American Hwy',
      permitStatus: 'Universidad de Antofagasta / CONAF Site Coordination',
      recommendedSeason: 'Year-Round (Optimal April - November)',
    },
    milestones: {
      0: 'Yungay Alluvial Pad (959 m)',
      10: 'Nitrate Duricrust Transect',
      20: 'Hyper-Arid Core (969 m)',
    },
  },
  {
    id: 'qaidam-dalangtan',
    name: 'Qaidam Basin — Dalangtan Playa',
    region: 'Qinghai-Tibetan Plateau',
    country: 'China',
    primaryTargetBody: 'MARS',
    bestMatchedTargets: ['mars-gale', 'mars-arcadia'],
    geologyType: 'High-altitude Mg-sulfate evaporite playa, salt polygons & wind-aligned yardangs',
    mineralogy: 'Kieserite, epsomite, mirabilite, gypsum, halite (Xiao et al. 2017, Earth-Sci. Rev.)',
    astrobiologyContext: 'Cold, high-UV Mg-sulfate brine systems analogous to Hesperian Gale Crater (Xiao et al. 2017).',
    partnerAgencyData: [
      {
        agency: 'ESA / Peer-Reviewed',
        instrument: 'Sentinel-2 SWIR + Xiao et al. (2017)',
        metricLabel: 'Reference Literature',
        metricValue: 'Earth-Sci. Rev. 164:84',
        description: 'Comprehensive Qaidam Basin Mars geomorphological & Mg-sulfate evaporite analog catalog.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 2.7,
      kPhi: 910,
      n: 0.86,
      cohesionKpa: 1.48,
      frictionAngleDeg: 38,
      frictionCoeffMu: 0.63,
      bulkDensityKgM3: 1670,
      dielectricConstant: 5.0,
      sourceNote: 'Sulfate playa crust geotechnical approximation (Wong 2008).',
    },
    geologyClass: { geomorBonus: 24, geoChemScore: 94, astroScore: 86, mechScore: 89 },
    fieldLogistics: {
      nearestBase: 'Mangya / Lenghu Field Camp (Qinghai)',
      accessDifficulty: '4x4 Desert Track (Spring Dust Storms)',
      permitStatus: 'Provincial Desert Research Permit',
      recommendedSeason: 'September - November & March - May',
    },
    milestones: {
      0: 'Dalangtan Playa Margin (2,713 m)',
      10: 'Sulfate Polygon Belt',
      20: 'Playa Yardang Bench (2,719 m)',
    },
  },
  {
    id: 'rio-tinto',
    name: 'Rio Tinto Acidic Basin',
    region: 'Iberian Pyrite Belt, Huelva',
    country: 'Spain',
    primaryTargetBody: 'MARS',
    bestMatchedTargets: ['mars-jezero', 'mars-gale'],
    geologyType: 'Acidic iron-sulfate gossan, jarosite-hematite crusts & hydrothermal terraces',
    mineralogy: 'Jarosite, hematite, goethite, copiapite, pyrite (Amils et al. 2014, Life)',
    astrobiologyContext: 'Fe/S-oxidizing acidophiles (pH 1.5-2.3) preserving biosignatures in jarosite (ExoMars analog).',
    partnerAgencyData: [
      {
        agency: 'ESA / CAB-INTA',
        instrument: 'ExoMars Ma_MISS & Raman Analog (Amils et al. 2014)',
        metricLabel: 'Geochemical Regime',
        metricValue: 'pH 1.5-2.3 Fe-Sulfates',
        description: 'European Space Agency primary terrestrial analog for Meridiani Planum & ExoMars subsurface drill biosignature triage.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 2.3,
      kPhi: 820,
      n: 0.9,
      cohesionKpa: 1.25,
      frictionAngleDeg: 37,
      frictionCoeffMu: 0.62,
      bulkDensityKgM3: 1840,
      dielectricConstant: 6.1,
      sourceNote: 'Ferricrete & iron-sulfate gossan soil modulus estimate.',
    },
    geologyClass: { geomorBonus: 14, geoChemScore: 97, astroScore: 96, mechScore: 81 },
    fieldLogistics: {
      nearestBase: 'Minas de Riotinto / CAB Mars Analog Hub',
      accessDifficulty: 'Road Accessible (Mining Heritage Tracks)',
      permitStatus: 'Centro de Astrobiologia (CAB-INTA) Research Permit',
      recommendedSeason: 'June - September (Dry Summer)',
    },
    milestones: {
      0: 'Jarosite Terrace Entry (340 m)',
      10: 'Gossan Slope',
      20: 'Hematite Ridge Crest (402 m)',
    },
  },
  {
    id: 'askja-holuhraun',
    name: 'Askja & Holuhraun Basaltic Highlands',
    region: 'Vatnajokull North Margin',
    country: 'Iceland',
    primaryTargetBody: 'BOTH',
    bestMatchedTargets: ['moon-aristarchus', 'moon-marius', 'mars-jezero'],
    geologyType: 'Fresh basaltic sand sheets, vesicular tephra & glacio-volcanic hyaloclastite',
    mineralogy: 'Tholeiitic basalt, olivine, clinopyroxene, palagonite (NASA SAND-E / RAVEN)',
    astrobiologyContext: 'Primary microbial succession on fresh basaltic tephra & lava (NASA PSTAR SAND-E).',
    partnerAgencyData: [
      {
        agency: 'NASA PSTAR',
        instrument: 'SAND-E & RAVEN Campaigns (Hughes et al. 2019)',
        metricLabel: 'Rover / Drone Analog',
        metricValue: 'Holuhraun Basalt Tephra',
        description: 'Official NASA PSTAR Mars/Moon rover mobility and aeolian basaltic sediment provenance testbed.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 1.0,
      kPhi: 560,
      n: 1.05,
      cohesionKpa: 0.32,
      frictionAngleDeg: 36,
      frictionCoeffMu: 0.58,
      bulkDensityKgM3: 1480,
      dielectricConstant: 5.5,
      sourceNote: 'Loose volcanic tephra & basaltic sand terramechanics range (Wong 2008).',
    },
    geologyClass: { geomorBonus: 24, geoChemScore: 89, astroScore: 76, mechScore: 94 },
    fieldLogistics: {
      nearestBase: 'Myvatn / Dreki Hut Highland Station',
      accessDifficulty: 'F-Road River-Crossing 4x4 Required',
      permitStatus: 'Vatnajokull National Park Research Permit',
      recommendedSeason: 'July - September (Snow-Free Highland Window)',
    },
    milestones: {
      0: 'Holuhraun Sand Plain (702 m)',
      10: 'Basalt Tephra Apron',
      20: 'Hyaloclastite Margin (718 m)',
    },
  },
  {
    id: 'dallol',
    name: 'Dallol Hydrothermal Field',
    region: 'Danakil Depression, Afar',
    country: 'Ethiopia',
    primaryTargetBody: 'MARS',
    bestMatchedTargets: ['mars-gale', 'mars-jezero'],
    geologyType: 'Hyper-acidic, hypersaline, hydrothermal salt domes & poly-extreme brine pools',
    mineralogy: 'Halite, sylvite, carnallite, jarosite, native sulfur (Belilla et al. 2019, Nature Ecol. Evol.)',
    astrobiologyContext: 'Multi-extreme habitability boundary (pH <0, >40% Mg/NaCl brines) where terrestrial life fails (Belilla et al. 2019).',
    partnerAgencyData: [
      {
        agency: 'Peer-Reviewed (Europlanet)',
        instrument: 'Belilla et al. (2019) Nature Ecology & Evolution',
        metricLabel: 'Habitability Limit',
        metricValue: 'doi:10.1038/s41559-019-1005-0',
        description: 'Demonstrates physical-chemical limits of life in chaotropic Mg-rich brines despite abundant liquid water.',
        isSynthetic: false,
      },
      {
        agency: 'ESA Copernicus DEM',
        instrument: 'GLO-90 vs POWER Grid Correction',
        metricLabel: 'DEM Salt Depression',
        metricValue: '-93 m -> -124 m (Grid: +1,063 m)',
        description: 'Critical showcase for ISA lapse-rate correction: POWER 0.5 deg grid averages 1,063 m escarpment, whereas Dallol sits below sea level.',
        isSynthetic: false,
      },
    ],
    regolith: {
      kc: 2.9,
      kPhi: 980,
      n: 0.84,
      cohesionKpa: 1.75,
      frictionAngleDeg: 39,
      frictionCoeffMu: 0.66,
      bulkDensityKgM3: 1790,
      dielectricConstant: 8.4,
      sourceNote: 'Salt-dome & mineral crust bearing capacity approximation.',
    },
    geologyClass: { geomorBonus: 18, geoChemScore: 90, astroScore: 97, mechScore: 77 },
    fieldLogistics: {
      nearestBase: 'Hamed Ela / Mekelle Expedition Staging',
      accessDifficulty: 'Extreme Thermal Protection & Local Escort',
      permitStatus: 'Ethiopian Geological Survey & Afar Clearance',
      recommendedSeason: 'November - February (Coolest Ambient Window)',
    },
    milestones: {
      0: 'Dallol Salt Dome Rim (-93 m)',
      10: 'Hydrothermal Terrace',
      20: 'Danakil Evaporite Floor (-124 m)',
    },
  },
];

export const EARTH_ANALOG_SITES: EarthAnalogSite[] = SITE_SEEDS.map((seed) => {
  const verified = VERIFIED_DATA.sites[seed.id];
  const elevationM = Math.round(verified.demElevationM);
  const powerGridElevationM = Math.round(verified.powerGridElevationM);
  const rawGridClimatology = verified.rawClimatology;
  const climatology = applyIsaLapseRateCorrection(
    rawGridClimatology,
    verified.powerGridElevationM,
    verified.demElevationM,
  );
  const meanPsKpa = climatology.PS.reduce((a, b) => a + b, 0) / 12;
  const pressureMbar = Math.round(meanPsKpa * 10);
  const traverse = buildTraverseFromCoordsAndElevations(verified.traversePoints, seed.milestones);
  const fidelityScores = deriveFidelityScores(
    verified.demElevationM,
    climatology,
    traverse,
    seed.geologyClass,
  );

  return {
    id: seed.id,
    name: seed.name,
    region: seed.region,
    country: seed.country,
    lat: verified.lat,
    lon: verified.lon,
    elevationM,
    powerGridElevationM,
    pressureMbar,
    primaryTargetBody: seed.primaryTargetBody,
    bestMatchedTargets: seed.bestMatchedTargets,
    geologyType: seed.geologyType,
    mineralogy: seed.mineralogy,
    astrobiologyContext: seed.astrobiologyContext,
    partnerAgencyData: seed.partnerAgencyData,
    regolith: seed.regolith,
    rawGridClimatology,
    climatology,
    traverse,
    fidelityScores,
    fieldLogistics: seed.fieldLogistics,
    dataSourceTag: 'VERIFIED_POWER_AND_COPERNICUS_DEM',
  };
});

/**
 * Re-derives 5-axis fidelity scores for a curated site after its climatology is refreshed,
 * so scores stay consistent with the climate data used by the other modules.
 * Returns the site's existing scores for non-curated (probe) sites.
 */
export function rederiveCuratedFidelityScores(
  site: EarthAnalogSite,
  climatology: MonthlyClimatology,
): EarthAnalogSite['fidelityScores'] {
  const seed = SITE_SEEDS.find((s) => s.id === site.id);
  if (!seed) return site.fidelityScores;
  return deriveFidelityScores(site.elevationM, climatology, site.traverse, seed.geologyClass);
}
