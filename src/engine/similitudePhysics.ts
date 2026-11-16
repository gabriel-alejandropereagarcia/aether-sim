import {
  EarthAnalogSite,
  MONTHS_SHORT,
  PlanetaryTarget,
  TraversePoint,
} from '../data/planetaryData';

export type HardwareSystemType = 'ROVER' | 'CRYO_DRILL' | 'EVA_SUIT' | 'GPR_SENSOR';

export interface HardwareSpecs {
  systemType: HardwareSystemType;
  massKg: number;
  powerWatts: number;
  contactAreaCm2: number;
  wheelWidthCm: number;
}

export const SEASONAL_THRESHOLDS = {
  PEAK: 82,
  VALID: 68,
  MARGINAL: 52,
} as const;

export interface UnmitigableLimitation {
  id: string;
  phenomenon: string;
  planetaryCondition: string;
  earthLimitation: string;
  chamberMitigation: string;
  severity: 'CRITICAL' | 'HIGH';
}

export interface SimilitudeCalibrationResult {
  earthGravityMs2: number;
  targetGravityMs2: number;
  gravityRatio: number;
  offloadRatioPct: number;
  offloadMassKg: number;
  offloadForceNewtons: number;
  effectiveTargetWeightN: number;
  uncompensatedEarthWeightN: number;
  // Bekker-Wong terramechanics sinkage
  targetSinkageMm: number;
  earthUncompensatedSinkageMm: number;
  earthOffloadedSinkageMm: number;
  sinkageDistortionRatio: number;
  residualGeotechnicalBiasPct: number;
  tirePressureOrBallastAdjustmentPct: number;
  // Atmospheric convection & thermal bias (McAdams 1954 + ideal-gas density scaling)
  surfacePressurePa: number;
  targetPressurePa: number;
  meanAmbientTempC: number;
  meanWindSpeedMs: number;
  earthConvectionCoeffWm2K: number;
  targetConvectionCoeffWm2K: number;
  convectiveBiasWm2K: number;
  estimatedChassisAreaM2: number;
  surfaceDeltaTC: number;
  parasiticHeatLossWatts: number;
  requiredThermalShroudRValue: number;
  activeMakeUpHeaterWatts: number;
  // Residual-based similitude fidelity scores
  calibratedFidelityScore: number;
  uncompensatedFidelityScore: number;
  unmitigableLimitations: UnmitigableLimitation[];
}

export interface AlignedTraverseSample {
  distanceKm: number;
  targetRelElevM: number;
  earthRelElevM: number;
  targetSlopeDeg: number;
  earthSlopeDeg: number;
  targetRoughness: number;
  earthRoughness: number;
  targetRoverWhPerKm: number;
  earthRoverWhPerKm: number;
  targetEvaKcalPerHr: number;
  earthEvaKcalPerHr: number;
  targetLabel?: string;
  earthLabel?: string;
}

export interface TraverseComparisonResult {
  samples: AlignedTraverseSample[];
  elevationRmseM: number;
  slopeSimilarityPct: number;
  overallGeometricMatchPct: number;
  targetGainM: number;
  earthGainM: number;
  targetMaxSlopeDeg: number;
  earthMaxSlopeDeg: number;
  targetAvgRoverWhPerKm: number;
  earthAvgRoverWhPerKm: number;
  targetAvgEvaKcalPerHr: number;
  earthAvgEvaKcalPerHr: number;
}

export type TestDisciplineKey = 'GPR_RADAR' | 'CRYO_DRILL' | 'ROVER_MOBILITY' | 'EVA_SUIT' | 'OPTICAL_LIDAR';

export interface DisciplineMeta {
  key: TestDisciplineKey;
  label: string;
  shortLabel: string;
  criticalParameters: string;
}

export const TEST_DISCIPLINES: DisciplineMeta[] = [
  {
    key: 'GPR_RADAR',
    label: 'GPR / Subsurface Radar',
    shortLabel: 'GPR / Radar',
    criticalParameters: 'Precip, RH%, Dielectric Loss',
  },
  {
    key: 'CRYO_DRILL',
    label: 'Cryo-Drilling & ISRU',
    shortLabel: 'Cryo-Drill',
    criticalParameters: 'T2M_MIN, Sub-zero Stability',
  },
  {
    key: 'ROVER_MOBILITY',
    label: 'Rover Mobility & Slip',
    shortLabel: 'Rover Traction',
    criticalParameters: 'Surface Moisture, Wind Shear',
  },
  {
    key: 'EVA_SUIT',
    label: 'Spacesuit EVA Rehearsal',
    shortLabel: 'Spacesuit EVA',
    criticalParameters: 'Thermal Envelope, Wind Chill',
  },
  {
    key: 'OPTICAL_LIDAR',
    label: 'Optical LiDAR & Hazard Nav',
    shortLabel: 'Optical LiDAR',
    criticalParameters: 'Solar Irradiance, Dust/Haze',
  },
];

export interface MonthCellData {
  monthIndex: number;
  monthLabel: string;
  disciplineScores: Record<TestDisciplineKey, number>;
  compositeScore: number;
  classification: 'PEAK_ANALOG' | 'VALID' | 'MARGINAL' | 'CRITICAL_INVALID';
  t2m: number;
  t2mMin: number;
  t2mMax: number;
  precipMmDay: number;
  rhPct: number;
  solarKwhM2Day: number;
  windMs: number;
  pressureMbar: number;
  dielectricPenaltyPct: number;
  primaryLimitingFactor: string;
}

export interface SeasonalValidityResult {
  months: MonthCellData[];
  peakMonths: string[];
  invalidMonths: string[];
  annualMeanFidelity: number;
  bestSingleMonth: MonthCellData;
  worstSingleMonth: MonthCellData;
}

export interface TriadSiteAssignment {
  site: EarthAnalogSite;
  role: string;
  strengthAxes: string[];
  bestWindowMonths: string[];
  meanPeakFidelity: number;
}

export interface TriadCampaignResult {
  primary: TriadSiteAssignment;
  secondary: TriadSiteAssignment;
  tertiary: TriadSiteAssignment;
  singleSiteCoveragePct: number;
  triadCompositeCoveragePct: number;
  coverageGainPct: number;
  axisCoverage: {
    axis: string;
    weight: number;
    singleSiteScore: number;
    triadScore: number;
    leadSiteName: string;
  }[];
  trlProgressionSummary: string;
}

const SYSTEM_AXIS_WEIGHTS: Record<
  HardwareSystemType,
  Record<keyof EarthAnalogSite['fidelityScores'], number>
> = {
  ROVER: {
    geomorphology: 0.28,
    regolithMechanics: 0.34,
    thermalAtmosphere: 0.14,
    geochemistryDielectric: 0.14,
    astrobiology: 0.1,
  },
  CRYO_DRILL: {
    geomorphology: 0.12,
    regolithMechanics: 0.26,
    thermalAtmosphere: 0.3,
    geochemistryDielectric: 0.18,
    astrobiology: 0.14,
  },
  EVA_SUIT: {
    geomorphology: 0.32,
    regolithMechanics: 0.22,
    thermalAtmosphere: 0.26,
    geochemistryDielectric: 0.1,
    astrobiology: 0.1,
  },
  GPR_SENSOR: {
    geomorphology: 0.14,
    regolithMechanics: 0.14,
    thermalAtmosphere: 0.16,
    geochemistryDielectric: 0.38,
    astrobiology: 0.18,
  },
};

/**
 * Somigliana WGS84 normal gravity + free-air altitude correction (m/s^2).
 */
export function computeLocalEarthGravity(latDeg: number, elevationM: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const sinPhi2 = Math.sin(phi) ** 2;
  const g0 =
    9.7803253359 *
    ((1 + 0.00193185265241 * sinPhi2) / Math.sqrt(1 - 0.00669437999013 * sinPhi2));
  const freeAirCorrection = -3.086e-6 * elevationM;
  return Number((g0 + freeAirCorrection).toFixed(4));
}

/**
 * Bekker (1956) / Wong (2008) pressure-sinkage depth z0 (mm) using explicit wheel/contact width b (cm):
 *   p = (kc / b + k_phi) * z0^n  =>  z0 = (p / (kc / b + k_phi))^(1/n)
 * Units: W/A in kPa, b in m, kc in kN/m^(n+1), k_phi in kN/m^(n+2).
 */
export function computeBekkerWongSinkageMm(
  normalForceN: number,
  contactAreaCm2: number,
  wheelWidthCm: number,
  kc: number,
  kPhi: number,
  n: number,
): number {
  const areaM2 = Math.max(0.001, contactAreaCm2 / 10000);
  const widthM = Math.max(0.02, wheelWidthCm / 100);
  const groundPressureKpa = normalForceN / areaM2 / 1000;
  const soilModulus = Math.max(50, kc / widthM + kPhi);
  const sinkageM = Math.pow(groundPressureKpa / soilModulus, 1 / Math.max(0.45, n));
  return Number((sinkageM * 1000).toFixed(2));
}

/**
 * Pandolf, Givoni & Goldman (1977) metabolic cost (kcal/hr) with partial-gravity
 * partial-gravity load scaling for an EVA astronaut (75 kg body + 120 kg Earth suit mass).
 */
export function computePandolfEvaKcalPerHr(
  slopeDeg: number,
  roughnessIndex: number,
  gravityMs2: number,
  earthGravityMs2 = 9.80665,
  bodyMassKg = 75,
  suitEarthMassKg = 120,
  walkSpeedMs = 1.1,
): number {
  const gravRatio = Math.max(0.05, gravityMs2 / earthGravityMs2);
  const effBodyWeightKg = bodyMassKg * gravRatio;
  const effSuitLoadKg = suitEarthMassKg * gravRatio;
  const gradePct = Math.tan((Math.min(40, Math.max(0, slopeDeg)) * Math.PI) / 180) * 100;
  const terrainFactor = 1.2 + 0.6 * Math.max(0, Math.min(1, roughnessIndex));

  const loadRatioSq = (effSuitLoadKg / Math.max(10, effBodyWeightKg)) ** 2;
  const metabolicWatts =
    1.5 * bodyMassKg +
    2.0 * (effBodyWeightKg + effSuitLoadKg) * loadRatioSq +
    terrainFactor *
      (effBodyWeightKg + effSuitLoadKg) *
      (1.5 * walkSpeedMs * walkSpeedMs + 0.35 * walkSpeedMs * gradePct);

  // Convert Watts (J/s) to kcal/hr: 1 W = 0.859845 kcal/hr
  return Math.round(metabolicWatts * 0.859845);
}

/**
 * Computes first-order Earth-vs-target physics calibration metrics.
 * Fidelity scores are heuristic indices built from physical residuals with hand-chosen scaling factors.
 */
export function computeSimilitudeCalibration(
  hardware: HardwareSpecs,
  site: EarthAnalogSite,
  target: PlanetaryTarget,
): SimilitudeCalibrationResult {
  const earthGravityMs2 = computeLocalEarthGravity(site.lat, site.elevationM);
  const targetGravityMs2 = target.gravityMs2;
  const gravityRatio = targetGravityMs2 / earthGravityMs2;

  const uncompensatedEarthWeightN = hardware.massKg * earthGravityMs2;
  const effectiveTargetWeightN = hardware.massKg * targetGravityMs2;
  const offloadForceNewtons = uncompensatedEarthWeightN - effectiveTargetWeightN;
  const offloadMassKg = offloadForceNewtons / earthGravityMs2;
  const offloadRatioPct = (1 - gravityRatio) * 100;

  // Bekker-Wong Sinkage Comparison using explicit wheel/contact width b
  const targetSinkageMm = computeBekkerWongSinkageMm(
    effectiveTargetWeightN,
    hardware.contactAreaCm2,
    hardware.wheelWidthCm,
    target.regolith.kc,
    target.regolith.kPhi,
    target.regolith.n,
  );
  const earthUncompensatedSinkageMm = computeBekkerWongSinkageMm(
    uncompensatedEarthWeightN,
    hardware.contactAreaCm2,
    hardware.wheelWidthCm,
    site.regolith.kc,
    site.regolith.kPhi,
    site.regolith.n,
  );
  const earthOffloadedSinkageMm = computeBekkerWongSinkageMm(
    effectiveTargetWeightN,
    hardware.contactAreaCm2,
    hardware.wheelWidthCm,
    site.regolith.kc,
    site.regolith.kPhi,
    site.regolith.n,
  );

  const sinkageDistortionRatio = Number(
    (earthUncompensatedSinkageMm / Math.max(0.05, targetSinkageMm)).toFixed(2),
  );
  const residualGeotechnicalBiasPct = Number(
    (
      (Math.abs(earthOffloadedSinkageMm - targetSinkageMm) / Math.max(0.1, targetSinkageMm)) *
      100
    ).toFixed(1),
  );
  const tirePressureOrBallastAdjustmentPct = Number(
    Math.min(
      65,
      Math.max(-45, ((earthOffloadedSinkageMm - targetSinkageMm) / Math.max(0.2, targetSinkageMm)) * 38),
    ).toFixed(1),
  );

  // Atmospheric Convection Bias (McAdams 1954 flat-plate correlation scaled by ideal-gas density ratio)
  const meanPsKpa = site.climatology.PS.reduce((a, b) => a + b, 0) / 12;
  const surfacePressurePa = Math.round(meanPsKpa * 1000);
  const meanAmbientTempC = Number((site.climatology.T2M.reduce((a, b) => a + b, 0) / 12).toFixed(1));
  const meanAmbientTempK = Math.max(150, meanAmbientTempC + 273.15);
  const meanWindSpeedMs = Number((site.climatology.WS10M.reduce((a, b) => a + b, 0) / 12).toFixed(1));

  // Ideal gas air density ratio relative to sea-level ISA (101325 Pa, 288.15 K)
  const earthDensityRatio = Math.max(0.05, (surfacePressurePa / 101325) * (288.15 / meanAmbientTempK));
  // McAdams (1954): h = (5.7 + 3.8 * v) for v <= 5 m/s; 6.47 + 2.2 * v^0.8 for higher wind, scaled by (rho/rho0)^0.6
  const mcadamsSeaLevel =
    meanWindSpeedMs <= 5
      ? 5.7 + 3.8 * meanWindSpeedMs
      : 6.47 + 2.2 * Math.pow(meanWindSpeedMs, 0.8);
  const earthConvectionCoeffWm2K = Number(
    (mcadamsSeaLevel * Math.pow(earthDensityRatio, 0.6)).toFixed(2),
  );

  // Dynamic target convection: Moon vacuum = 0; Mars CO2 scales with pressurePa & 4.5 m/s mean wind
  let targetConvectionCoeffWm2K = 0;
  if (target.pressurePa > 0) {
    const marsTempK = Math.max(150, target.meanTempC + 273.15);
    const marsCo2DensityRatio =
      ((target.pressurePa / 101325) * (288.15 / marsTempK)) * (44.01 / 28.97);
    const marsWindCoeff = 5.7 + 3.8 * 4.5;
    targetConvectionCoeffWm2K = Number(
      (marsWindCoeff * Math.pow(Math.max(0.001, marsCo2DensityRatio), 0.6)).toFixed(2),
    );
  }

  const convectiveBiasWm2K = Number(
    Math.max(0, earthConvectionCoeffWm2K - targetConvectionCoeffWm2K).toFixed(2),
  );

  const areaBase =
    hardware.systemType === 'EVA_SUIT'
      ? 1.85
      : hardware.systemType === 'CRYO_DRILL'
        ? 0.48
        : 0.32 * Math.pow(hardware.massKg / 50, 0.58);
  const estimatedChassisAreaM2 = Number(Math.max(0.25, Math.min(4.2, areaBase)).toFixed(2));

  // Linearized radiative-convective energy balance for chassis surface delta-T
  const stefanBoltzmann = 5.670374e-8;
  const emissivity = 0.85;
  const hRad = 4 * emissivity * stefanBoltzmann * Math.pow(meanAmbientTempK, 3);
  const surfaceDeltaTC = Number(
    Math.min(
      65,
      Math.max(3, hardware.powerWatts / (estimatedChassisAreaM2 * (earthConvectionCoeffWm2K + hRad))),
    ).toFixed(1),
  );

  const parasiticHeatLossWatts = Math.round(
    convectiveBiasWm2K * estimatedChassisAreaM2 * surfaceDeltaTC,
  );

  // Shroud R-value needed to match target convective conductance (1/h_target when > 0, or 90% suppression for vacuum)
  const targetEffectiveH =
    targetConvectionCoeffWm2K > 0.1
      ? targetConvectionCoeffWm2K
      : earthConvectionCoeffWm2K * 0.1;
  const requiredThermalShroudRValue = Number(
    Math.max(0.1, 1 / targetEffectiveH - 1 / Math.max(0.5, earthConvectionCoeffWm2K)).toFixed(2),
  );

  const activeMakeUpHeaterWatts = Math.round(
    Math.max(0, parasiticHeatLossWatts * 0.88 - hardware.powerWatts * 0.15),
  );

  // Residual-based heuristic fidelity index
  const baseSiteScore =
    (site.fidelityScores.geomorphology +
      site.fidelityScores.regolithMechanics +
      site.fidelityScores.thermalAtmosphere +
      site.fidelityScores.geochemistryDielectric +
      site.fidelityScores.astrobiology) /
    5;

  const rawGravityError = Math.abs(1 - gravityRatio) * 18;
  const rawSinkageError = Math.min(30, Math.abs(sinkageDistortionRatio - 1) * 5.5);
  const rawConvectionError = Math.min(22, convectiveBiasWm2K * 0.85);
  const uncompensatedFidelityScore = Number(
    Math.max(12, baseSiteScore - rawGravityError - rawSinkageError - rawConvectionError).toFixed(1),
  );

  // After gimbal offloading & shroud mitigation, only residual soil-modulus & 12% shroud leakage remain
  const residualSinkagePenalty = Math.min(20, residualGeotechnicalBiasPct * 0.35);
  const residualConvectionPenalty = Math.min(12, convectiveBiasWm2K * 0.12);
  const calibratedFidelityScore = Number(
    Math.max(
      15,
      Math.min(98, baseSiteScore - residualSinkagePenalty - residualConvectionPenalty),
    ).toFixed(1),
  );

  const unmitigableLimitations: UnmitigableLimitation[] = [
    {
      id: 'radiation',
      phenomenon: 'Galactic Cosmic Rays (GCR) & Solar Particle Events (SPE)',
      planetaryCondition:
        target.body === 'MOON'
          ? 'Unshielded ~300-450 mSv/yr deep-space GCR + acute MeV solar proton bursts.'
          : '~210-250 mSv/yr modulated by thin CO2 column; zero global magnetosphere.',
      earthLimitation:
        'Earth magnetosphere + atmospheric column (>500 g/cm2 even at 5,200 m) attenuates >98% of primary heavy ions.',
      chamberMitigation:
        'Mandatory Brookhaven NSRL / heavy-ion accelerator SEU avionics testing + organic biosignature radiolysis runs.',
      severity: 'CRITICAL',
    },
    {
      id: 'electrostatic-dust',
      phenomenon:
        target.body === 'MOON'
          ? 'Photo-Electrostatic Levitating Lunar Fines (<20 um)'
          : 'Triboelectric & Perchlorate-Reactive Martian Aeolian Fines',
      planetaryCondition:
        target.body === 'MOON'
          ? 'UV/solar-wind charging levitates jagged, unweathered agglutinate shards into seals and optics.'
          : 'Charged iron-oxide dust storms coat radiators and generate electrostatic discharge hazards.',
      earthLimitation:
        'Terrestrial humidity (>10% RH) and ambient air ionization bleed off static charge and round sharp silica edges.',
      chamberMitigation:
        'Vacuum UV dust-chamber validation with JSC-1A / LHS-1 / MGS-1 crushed simulants on rotary bearing seals.',
      severity: 'CRITICAL',
    },
    {
      id: 'uhv-cold-weld',
      phenomenon:
        target.body === 'MOON'
          ? 'Ultra-High Vacuum Outgassing & Cold-Welding (10^-10 Pa)'
          : 'CO2-Dominated Cryogenic Frost Sublimation (6-7 mbar)',
      planetaryCondition:
        target.body === 'MOON'
          ? 'Absence of adsorbed oxygen/water monolayers causes unlubricated titanium/steel gears to cold-weld.'
          : 'Pure CO2 frost condenses directly on optics below -125 C without liquid phase stability.',
      earthLimitation:
        'Even high-altitude Puna air (~530 mbar) maintains oxide/moisture boundary films on exposed actuator surfaces.',
      chamberMitigation:
        'Thermal-vacuum (TVAC) chamber cycling at 10^-6 Torr with MoS2/dry-film lubrication qualification.',
      severity: 'HIGH',
    },
    {
      id: 'micrometeoroid',
      phenomenon: 'Hypervelocity Micrometeoroid & Secondary Ejecta Flux',
      planetaryCondition:
        target.body === 'MOON'
          ? '20-70 km/s micrometeorite impacts continuously garden regolith and pit MLI blankets/visors.'
          : 'Sub-millimeter impactors survive thin atmosphere at 5-15 km/s.',
      earthLimitation:
        'Earth atmosphere ablates virtually all sub-centimeter meteoroids above 70 km altitude.',
      chamberMitigation:
        'Light-gas gun hypervelocity impact testing on Whipple shields, habitat fabrics, and visor coatings.',
      severity: 'HIGH',
    },
  ];

  return {
    earthGravityMs2,
    targetGravityMs2,
    gravityRatio: Number(gravityRatio.toFixed(3)),
    offloadRatioPct: Number(offloadRatioPct.toFixed(1)),
    offloadMassKg: Number(offloadMassKg.toFixed(1)),
    offloadForceNewtons: Number(offloadForceNewtons.toFixed(1)),
    effectiveTargetWeightN: Number(effectiveTargetWeightN.toFixed(1)),
    uncompensatedEarthWeightN: Number(uncompensatedEarthWeightN.toFixed(1)),
    targetSinkageMm,
    earthUncompensatedSinkageMm,
    earthOffloadedSinkageMm,
    sinkageDistortionRatio,
    residualGeotechnicalBiasPct,
    tirePressureOrBallastAdjustmentPct,
    surfacePressurePa,
    targetPressurePa: target.pressurePa,
    meanAmbientTempC,
    meanWindSpeedMs,
    earthConvectionCoeffWm2K,
    targetConvectionCoeffWm2K,
    convectiveBiasWm2K,
    estimatedChassisAreaM2,
    surfaceDeltaTC,
    parasiticHeatLossWatts,
    requiredThermalShroudRValue,
    activeMakeUpHeaterWatts,
    calibratedFidelityScore,
    uncompensatedFidelityScore,
    unmitigableLimitations,
  };
}

/**
 * Computes 2.0 km geometric traverse alignment, slope similarity,
 * rover specific energy (Wh/km), and Pandolf (1977) EVA metabolic expenditure (kcal/hr).
 */
export function computeTraverseComparison(
  site: EarthAnalogSite,
  target: PlanetaryTarget,
  hardware: HardwareSpecs,
): TraverseComparisonResult {
  const localEarthGravity = computeLocalEarthGravity(site.lat, site.elevationM);
  const targetBase = target.traverse[0]?.elevationM ?? 0;
  const earthBase = site.traverse[0]?.elevationM ?? 0;

  let sqErrSum = 0;
  let slopeSimSum = 0;
  let targetGainM = 0;
  let earthGainM = 0;
  let targetMaxSlopeDeg = 0;
  let earthMaxSlopeDeg = 0;

  const samples: AlignedTraverseSample[] = target.traverse.map((tPt: TraversePoint, idx: number) => {
    const ePt = site.traverse[idx] ?? site.traverse[site.traverse.length - 1];
    const tRel = Number((tPt.elevationM - targetBase).toFixed(1));
    const eRel = Number((ePt.elevationM - earthBase).toFixed(1));

    if (idx > 0) {
      const prevTRel = target.traverse[idx - 1].elevationM - targetBase;
      const prevEPt = site.traverse[idx - 1] ?? site.traverse[site.traverse.length - 1];
      const prevERel = prevEPt.elevationM - earthBase;
      if (tRel > prevTRel) targetGainM += tRel - prevTRel;
      if (eRel > prevERel) earthGainM += eRel - prevERel;
    }

    targetMaxSlopeDeg = Math.max(targetMaxSlopeDeg, Math.abs(tPt.slopeDeg));
    earthMaxSlopeDeg = Math.max(earthMaxSlopeDeg, Math.abs(ePt.slopeDeg));

    sqErrSum += (tRel - eRel) ** 2;
    const slopeDiff = Math.abs(tPt.slopeDeg - ePt.slopeDeg);
    slopeSimSum += Math.max(0, 100 - slopeDiff * 5.2);

    // Bekker-Wong / Terramechanics Rover Mobility Power Model (Wh/km)
    const crrTarget = 0.045 + 0.035 * tPt.roughnessIndex;
    const crrEarth = 0.048 + 0.035 * ePt.roughnessIndex;
    const slopeSinT = Math.sin((tPt.slopeDeg * Math.PI) / 180);
    const slopeSinE = Math.sin((ePt.slopeDeg * Math.PI) / 180);

    const massForModel = Math.max(25, hardware.massKg);
    const mechEff = 0.68;
    // Signed slope: descents reduce tractive demand; no regenerative recovery below zero
    const targetForceN = massForModel * target.gravityMs2 * Math.max(0, crrTarget + slopeSinT);
    const earthForceN = massForModel * localEarthGravity * Math.max(0, crrEarth + slopeSinE);

    const hotelWhPerKm = Math.max(15, hardware.powerWatts * 0.45);
    const targetRoverWhPerKm = Number(((targetForceN * 1000) / (3600 * mechEff) + hotelWhPerKm).toFixed(1));
    const earthRoverWhPerKm = Number(((earthForceN * 1000) / (3600 * mechEff) + hotelWhPerKm).toFixed(1));

    // Pandolf et al. (1977) with partial-gravity load scaling: EVA metabolic load (decoupled from rover hardware mass)
    const suitMass = hardware.systemType === 'EVA_SUIT' ? hardware.massKg : 120;
    const targetEvaKcalPerHr = computePandolfEvaKcalPerHr(
      tPt.slopeDeg,
      tPt.roughnessIndex,
      target.gravityMs2,
      localEarthGravity,
      75,
      suitMass,
    );
    const earthEvaKcalPerHr = computePandolfEvaKcalPerHr(
      ePt.slopeDeg,
      ePt.roughnessIndex,
      localEarthGravity,
      localEarthGravity,
      75,
      suitMass,
    );

    return {
      distanceKm: tPt.distanceKm,
      targetRelElevM: tRel,
      earthRelElevM: eRel,
      targetSlopeDeg: tPt.slopeDeg,
      earthSlopeDeg: ePt.slopeDeg,
      targetRoughness: tPt.roughnessIndex,
      earthRoughness: ePt.roughnessIndex,
      targetRoverWhPerKm,
      earthRoverWhPerKm,
      targetEvaKcalPerHr,
      earthEvaKcalPerHr,
      targetLabel: tPt.label,
      earthLabel: ePt.label,
    };
  });

  const elevationRmseM = Number(Math.sqrt(sqErrSum / samples.length).toFixed(1));
  const slopeSimilarityPct = Number((slopeSimSum / samples.length).toFixed(1));
  const elevMatchPct = Math.max(0, 100 - elevationRmseM * 1.1);
  const overallGeometricMatchPct = Number((0.45 * elevMatchPct + 0.55 * slopeSimilarityPct).toFixed(1));

  const targetAvgRoverWhPerKm = Number(
    (samples.reduce((a, s) => a + s.targetRoverWhPerKm, 0) / samples.length).toFixed(1),
  );
  const earthAvgRoverWhPerKm = Number(
    (samples.reduce((a, s) => a + s.earthRoverWhPerKm, 0) / samples.length).toFixed(1),
  );
  const targetAvgEvaKcalPerHr = Math.round(
    samples.reduce((a, s) => a + s.targetEvaKcalPerHr, 0) / samples.length,
  );
  const earthAvgEvaKcalPerHr = Math.round(
    samples.reduce((a, s) => a + s.earthEvaKcalPerHr, 0) / samples.length,
  );

  return {
    samples,
    elevationRmseM,
    slopeSimilarityPct,
    overallGeometricMatchPct,
    targetGainM: Number(targetGainM.toFixed(1)),
    earthGainM: Number(earthGainM.toFixed(1)),
    targetMaxSlopeDeg: Number(targetMaxSlopeDeg.toFixed(1)),
    earthMaxSlopeDeg: Number(earthMaxSlopeDeg.toFixed(1)),
    targetAvgRoverWhPerKm,
    earthAvgRoverWhPerKm,
    targetAvgEvaKcalPerHr,
    earthAvgEvaKcalPerHr,
  };
}

/**
 * Computes the 12-Month x 5-Discipline 4D Seasonal Validity Matrix using unified thresholds.
 */
export function computeSeasonalValidityMatrix(
  site: EarthAnalogSite,
  target: PlanetaryTarget,
): SeasonalValidityResult {
  const { T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN, WS10M, RH2M, PS } = site.climatology;

  const months: MonthCellData[] = MONTHS_SHORT.map((monthLabel, m) => {
    const t2m = T2M[m] ?? 0;
    const t2mMin = T2M_MIN[m] ?? t2m - 5;
    const t2mMax = T2M_MAX[m] ?? t2m + 5;
    const precip = PRECTOTCORR[m] ?? 0;
    const rh = RH2M[m] ?? 40;
    const solar = ALLSKY_SFC_SW_DWN[m] ?? 5;
    const wind = WS10M[m] ?? 4;
    const pressureMbar = Math.round((PS[m] ?? 90) * 10);

    const precipPenaltyGpr = Math.min(72, precip * 34);
    const rhPenaltyGpr = Math.max(0, (rh - 26) * 0.78);
    const freezeBonusGpr = t2m < 0 ? 6 : 0;
    const gprScore = Math.round(
      Math.max(12, Math.min(98, 97 - precipPenaltyGpr - rhPenaltyGpr + freezeBonusGpr)),
    );

    const targetColdBias = target.meanTempC < -40 ? 1 : 0.75;
    const tempScoreCryo =
      t2mMin <= -12
        ? 94
        : t2mMin <= -3
          ? 84
          : t2mMin <= 3
            ? 64
            : Math.max(18, 56 - (t2mMin - 3) * 3.2);
    const cryoScore = Math.round(
      Math.max(
        10,
        Math.min(97, (tempScoreCryo - precip * 18) * targetColdBias + (1 - targetColdBias) * 85),
      ),
    );

    const mudPenalty = precip * 24 + Math.max(0, rh - 55) * 0.45;
    const windHazard = Math.max(0, (wind - 9.5) * 3.5);
    const mobilityBase = 48 + site.fidelityScores.regolithMechanics * 0.48;
    const roverScore = Math.round(Math.max(18, Math.min(97, mobilityBase - mudPenalty - windHazard)));

    const heatStressPenalty = Math.max(0, (t2mMax - 28) * 3.2);
    const extremeColdPenalty = Math.max(0, (-22 - t2mMin) * 1.4);
    const stormPenalty = precip * 14 + Math.max(0, (wind - 8.5) * 3.2);
    const evaBase = 45 + site.fidelityScores.geomorphology * 0.5;
    const evaScore = Math.round(
      Math.max(20, Math.min(96, evaBase - heatStressPenalty - extremeColdPenalty - stormPenalty)),
    );

    const lightPenalty = solar < 0.8 ? 48 : solar < 2.2 ? 22 : 0;
    const hazePenalty = precip * 16 + Math.max(0, (rh - 68) * 0.55);
    const lidarScore = Math.round(Math.max(18, Math.min(98, 95 - lightPenalty - hazePenalty)));

    const disciplineScores: Record<TestDisciplineKey, number> = {
      GPR_RADAR: gprScore,
      CRYO_DRILL: cryoScore,
      ROVER_MOBILITY: roverScore,
      EVA_SUIT: evaScore,
      OPTICAL_LIDAR: lidarScore,
    };

    const compositeScore = Math.round(
      gprScore * 0.24 + cryoScore * 0.22 + roverScore * 0.22 + evaScore * 0.16 + lidarScore * 0.16,
    );

    let classification: MonthCellData['classification'] = 'CRITICAL_INVALID';
    if (compositeScore >= SEASONAL_THRESHOLDS.PEAK) classification = 'PEAK_ANALOG';
    else if (compositeScore >= SEASONAL_THRESHOLDS.VALID) classification = 'VALID';
    else if (compositeScore >= SEASONAL_THRESHOLDS.MARGINAL) classification = 'MARGINAL';

    const dielectricPenaltyPct = Math.round(Math.min(85, precip * 28 + Math.max(0, rh - 25) * 0.65));

    let primaryLimitingFactor = 'Optimal Hyper-Arid / Thermal Alignment';
    if (precip > 0.75) {
      primaryLimitingFactor = `Moisture / Monsoon (${precip.toFixed(2)} mm/d alters dielectric constant)`;
    } else if (solar < 0.8) {
      primaryLimitingFactor = `Polar Night Darkness (${solar.toFixed(1)} kWh/m2/d limits optical LiDAR)`;
    } else if (t2mMax > 30) {
      primaryLimitingFactor = `High Thermal Excess (${t2mMax.toFixed(1)} C induces EVA heat bias)`;
    } else if (t2mMin > 4 && target.meanTempC < -30) {
      primaryLimitingFactor = `Above-Freezing Soil (${t2mMin.toFixed(1)} C invalidates cryo-drill bond)`;
    } else if (rh > 68) {
      primaryLimitingFactor = `Elevated Relative Humidity (${rh}% RH dampens electrostatic dust/GPR)`;
    }

    return {
      monthIndex: m,
      monthLabel,
      disciplineScores,
      compositeScore,
      classification,
      t2m,
      t2mMin,
      t2mMax,
      precipMmDay: precip,
      rhPct: rh,
      solarKwhM2Day: solar,
      windMs: wind,
      pressureMbar,
      dielectricPenaltyPct,
      primaryLimitingFactor,
    };
  });

  const peakMonths = months
    .filter((m) => m.compositeScore >= SEASONAL_THRESHOLDS.PEAK)
    .map((m) => m.monthLabel);
  const invalidMonths = months
    .filter((m) => m.compositeScore < SEASONAL_THRESHOLDS.MARGINAL)
    .map((m) => m.monthLabel);
  const annualMeanFidelity = Math.round(months.reduce((a, m) => a + m.compositeScore, 0) / 12);

  const sortedByComposite = [...months].sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    months,
    peakMonths,
    invalidMonths,
    annualMeanFidelity,
    bestSingleMonth: sortedByComposite[0],
    worstSingleMonth: sortedByComposite[sortedByComposite.length - 1],
  };
}

/**
 * Hardware-weighted 3-Site Triad Campaign Optimizer (TRL 4 -> TRL 6).
 */
export function optimizeTriadCampaign(
  target: PlanetaryTarget,
  hardware: HardwareSpecs,
  primarySite: EarthAnalogSite,
  allSites: EarthAnalogSite[],
): TriadCampaignResult {
  const candidates = allSites.filter((s) => s.id !== primarySite.id);
  // Never re-use the primary site as a complementary phase while any other site exists
  const safePool = candidates.length > 0 ? candidates : [primarySite];
  const hasFullTriad = candidates.length >= 2;
  const weights = SYSTEM_AXIS_WEIGHTS[hardware.systemType];

  let bestScore = -1;
  let bestPair: [EarthAnalogSite, EarthAnalogSite] = [safePool[0], safePool[1] ?? safePool[0]];

  const scoreTriad = (a: EarthAnalogSite, b: EarthAnalogSite, c: EarthAnalogSite) => {
    const bodyBonus = (site: EarthAnalogSite) =>
      site.primaryTargetBody === target.body || site.primaryTargetBody === 'BOTH' ? 3.5 : 0;
    const targetMatchBonus = (site: EarthAnalogSite) =>
      site.bestMatchedTargets.includes(target.id) ? 4.5 : 0;

    const weightedSum =
      weights.geomorphology *
        Math.max(a.fidelityScores.geomorphology, b.fidelityScores.geomorphology, c.fidelityScores.geomorphology) +
      weights.regolithMechanics *
        Math.max(
          a.fidelityScores.regolithMechanics,
          b.fidelityScores.regolithMechanics,
          c.fidelityScores.regolithMechanics,
        ) +
      weights.thermalAtmosphere *
        Math.max(
          a.fidelityScores.thermalAtmosphere,
          b.fidelityScores.thermalAtmosphere,
          c.fidelityScores.thermalAtmosphere,
        ) +
      weights.geochemistryDielectric *
        Math.max(
          a.fidelityScores.geochemistryDielectric,
          b.fidelityScores.geochemistryDielectric,
          c.fidelityScores.geochemistryDielectric,
        ) +
      weights.astrobiology *
        Math.max(a.fidelityScores.astrobiology, b.fidelityScores.astrobiology, c.fidelityScores.astrobiology);

    const bonus = (bodyBonus(b) + bodyBonus(c) + targetMatchBonus(b) + targetMatchBonus(c)) * 0.4;
    return weightedSum + bonus;
  };

  for (let i = 0; i < safePool.length; i++) {
    for (let j = i + 1; j < safePool.length; j++) {
      const val = scoreTriad(primarySite, safePool[i], safePool[j]);
      if (val > bestScore) {
        bestScore = val;
        bestPair = [safePool[i], safePool[j]];
      }
    }
  }

  const [site2, site3] = bestPair;

  const extractBestMonths = (s: EarthAnalogSite) => {
    const seasonal = computeSeasonalValidityMatrix(s, target);
    const top = [...seasonal.months].sort((x, y) => y.compositeScore - x.compositeScore).slice(0, 3);
    return {
      months: top.map((m) => m.monthLabel),
      meanPeak: Math.round(top.reduce((a, m) => a + m.compositeScore, 0) / top.length),
    };
  };

  const w1 = extractBestMonths(primarySite);
  const w2 = extractBestMonths(site2);
  const w3 = extractBestMonths(site3);

  const identifyStrengthAxes = (s: EarthAnalogSite): string[] => {
    const entries: [string, number][] = [
      ['Geomorphology & Traverse', s.fidelityScores.geomorphology],
      ['Regolith Terramechanics', s.fidelityScores.regolithMechanics],
      ['Hypobaric / Thermal Envelope', s.fidelityScores.thermalAtmosphere],
      ['Geochemistry & Dielectric', s.fidelityScores.geochemistryDielectric],
      ['Astrobiology & Sterility', s.fidelityScores.astrobiology],
    ];
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map((e) => `${e[0]} (${e[1]}%)`);
  };

  const axesDef: { label: string; key: keyof EarthAnalogSite['fidelityScores'] }[] = [
    { label: 'Geomorphology & Traverse', key: 'geomorphology' },
    { label: 'Regolith Terramechanics', key: 'regolithMechanics' },
    { label: 'Thermal & Barometric', key: 'thermalAtmosphere' },
    { label: 'Geochemistry & Dielectric', key: 'geochemistryDielectric' },
    { label: 'Astrobiology & Volatiles', key: 'astrobiology' },
  ];

  const axisCoverage = axesDef.map((ax) => {
    const singleVal = primarySite.fidelityScores[ax.key];
    const triadSites = [primarySite, site2, site3];
    let bestSite = primarySite;
    let bestVal = singleVal;
    for (const candidate of triadSites) {
      if (candidate.fidelityScores[ax.key] > bestVal) {
        bestVal = candidate.fidelityScores[ax.key];
        bestSite = candidate;
      }
    }
    return {
      axis: ax.label,
      weight: Math.round(weights[ax.key] * 100),
      singleSiteScore: singleVal,
      triadScore: bestVal,
      leadSiteName: bestSite.name,
    };
  });

  const singleSiteCoveragePct = Math.round(
    axisCoverage.reduce((a, c) => a + (c.singleSiteScore * c.weight) / 100, 0),
  );
  const triadCompositeCoveragePct = Math.round(
    axisCoverage.reduce((a, c) => a + (c.triadScore * c.weight) / 100, 0),
  );

  return {
    primary: {
      site: primarySite,
      role: 'Phase 1 - Primary Traverse & Similitude Baseline (TRL 4 -> 5)',
      strengthAxes: identifyStrengthAxes(primarySite),
      bestWindowMonths: w1.months,
      meanPeakFidelity: w1.meanPeak,
    },
    secondary: {
      site: site2,
      role: 'Phase 2 - Complementary Mineralogy / Mobility Verification (TRL 5 -> 6)',
      strengthAxes: identifyStrengthAxes(site2),
      bestWindowMonths: w2.months,
      meanPeakFidelity: w2.meanPeak,
    },
    tertiary: {
      site: site3,
      role: 'Phase 3 - Extremophile / Thermal End-Member Integration (TRL 6 Readiness)',
      strengthAxes: identifyStrengthAxes(site3),
      bestWindowMonths: w3.months,
      meanPeakFidelity: w3.meanPeak,
    },
    singleSiteCoveragePct,
    triadCompositeCoveragePct,
    coverageGainPct: triadCompositeCoveragePct - singleSiteCoveragePct,
    axisCoverage,
    trlProgressionSummary: `${hasFullTriad ? '' : `WARNING: only ${candidates.length} complementary site(s) available; triad phases repeat sites. `}For ${hardware.systemType} testing, pairing ${primarySite.name} (${w1.months.join('/')}) with ${site2.name} (${w2.months.join('/')}) and ${site3.name} (${w3.months.join('/')}) increases weighted 5-axis mission readiness from ${singleSiteCoveragePct}% to ${triadCompositeCoveragePct}% (+${triadCompositeCoveragePct - singleSiteCoveragePct} pts).`,
  };
}

export function generateFieldProtocolMarkdown(
  target: PlanetaryTarget,
  site: EarthAnalogSite,
  hardware: HardwareSpecs,
  similitude: SimilitudeCalibrationResult,
  traverse: TraverseComparisonResult,
  seasonal: SeasonalValidityResult,
  triad: TriadCampaignResult,
): string {
  const timestamp = new Date().toISOString();
  return `# AETHER-SIM FIELD TEST & SIMILITUDE CALIBRATION PROTOCOL
**Generated:** ${timestamp}
**Target Planetary Site:** ${target.name} (${target.body} | ${target.lat}°, ${target.lon}°) — *Ref: ${target.citation}*
**Primary Earth Analog:** ${site.name}, ${site.country} (${site.lat}°, ${site.lon}° | Copernicus DEM: ${site.elevationM} m | POWER Grid: ${site.powerGridElevationM} m | Corrected Pressure: ${site.pressureMbar} mbar)
**Hardware Configuration:** ${hardware.systemType} | Mass: ${hardware.massKg} kg | Power: ${hardware.powerWatts} W | Contact Area: ${hardware.contactAreaCm2} cm^2 | Width b: ${hardware.wheelWidthCm} cm

---

## 1. PHYSICS CALIBRATION PARAMETERS (FIRST-ORDER MODELS)
- **Local Earth Gravity (WGS84 + Free-Air):** ${similitude.earthGravityMs2} m/s^2 vs. Target ${similitude.targetGravityMs2} m/s^2
- **Required Gravity Offloading:** **${similitude.offloadRatioPct}%** (${similitude.offloadMassKg} kg counterweight / ${similitude.offloadForceNewtons} N vertical gimbal offload)
- **Bekker-Wong Wheel/Footprint Sinkage (z0, b = ${hardware.wheelWidthCm} cm):**
  - Planetary Target Sinkage: **${similitude.targetSinkageMm} mm**
  - Uncompensated Earth Sinkage: **${similitude.earthUncompensatedSinkageMm} mm** (${similitude.sinkageDistortionRatio}x distortion)
  - Offloaded Earth Sinkage: **${similitude.earthOffloadedSinkageMm} mm** (Residual Soil Modulus Bias: ${similitude.residualGeotechnicalBiasPct}%)
  - Recommended Tire Pressure / Ballast Trim: **${similitude.tirePressureOrBallastAdjustmentPct > 0 ? '+' : ''}${similitude.tirePressureOrBallastAdjustmentPct}%**
- **Atmospheric Convection Bias (McAdams 1954 + Ideal Gas Density Scaling):**
  - Earth Site Convection (h_e): **${similitude.earthConvectionCoeffWm2K} W/m^2K** vs. Target (h_t): **${similitude.targetConvectionCoeffWm2K} W/m^2K**
  - Parasitic Terrestrial Heat Loss: **${similitude.parasiticHeatLossWatts} W** across ${similitude.estimatedChassisAreaM2} m^2 chassis (Surface dT: ${similitude.surfaceDeltaTC} C)
  - Required MLI/Aerogel Shroud Resistance: **R = ${similitude.requiredThermalShroudRValue} m^2K/W**
  - Active Make-Up Heater Compensation: **${similitude.activeMakeUpHeaterWatts} W**

## 2. TRAVERSE PROFILE COMPARISON (2.0 KM)
- **Elevation Gain:** Target **${traverse.targetGainM} m** vs. Copernicus DEM Analog **${traverse.earthGainM} m**
- **Maximum Slope:** Target **${traverse.targetMaxSlopeDeg}°** vs. Earth Analog **${traverse.earthMaxSlopeDeg}°**
- **Topographic Profile RMSE:** **${traverse.elevationRmseM} m** | Slope Similarity: **${traverse.slopeSimilarityPct}%**
- **Energy & Pandolf (1977) EVA Expenditure:**
  - Rover Mobility Energy: **${traverse.targetAvgRoverWhPerKm} Wh/km** (${target.body}) vs. **${traverse.earthAvgRoverWhPerKm} Wh/km** (Earth Uncompensated)
  - Crew EVA Metabolic Load: **${traverse.targetAvgEvaKcalPerHr} kcal/hr** (${target.body}) vs. **${traverse.earthAvgEvaKcalPerHr} kcal/hr** (Earth)

## 3. 4D SEASONAL VALIDITY WINDOW (ISA-CORRECTED NASA POWER CLIMATOLOGY)
- **Annual Mean Analog Fidelity:** ${seasonal.annualMeanFidelity}%
- **Peak Optimal Windows (>=${SEASONAL_THRESHOLDS.PEAK}% Fidelity):** ${seasonal.peakMonths.length > 0 ? seasonal.peakMonths.join(', ') : seasonal.bestSingleMonth.monthLabel}
- **Best Single Month:** ${seasonal.bestSingleMonth.monthLabel} (${seasonal.bestSingleMonth.compositeScore}% — T_mean ${seasonal.bestSingleMonth.t2m} C, Precip ${seasonal.bestSingleMonth.precipMmDay} mm/day, RH ${seasonal.bestSingleMonth.rhPct}%)
- **Invalid Months (<${SEASONAL_THRESHOLDS.MARGINAL}% threshold):** ${seasonal.invalidMonths.length > 0 ? seasonal.invalidMonths.join(', ') : 'None'}

## 4. HARDWARE-WEIGHTED TRIAD CAMPAIGN (TRL 4 -> TRL 6)
${triad.trlProgressionSummary}
1. **${triad.primary.role}:** ${triad.primary.site.name} (${triad.primary.bestWindowMonths.join(', ')})
2. **${triad.secondary.role}:** ${triad.secondary.site.name} (${triad.secondary.bestWindowMonths.join(', ')})
3. **${triad.tertiary.role}:** ${triad.tertiary.site.name} (${triad.tertiary.bestWindowMonths.join(', ')})

## 5. UNMITIGABLE FIELD LIMITATIONS (MANDATORY CHAMBER CO-TESTS)
${similitude.unmitigableLimitations
  .map((u) => `- **[${u.severity}] ${u.phenomenon}:** ${u.earthLimitation} *Required Mitigation:* ${u.chamberMitigation}`)
  .join('\n')}
`;
}

export function generateFieldProtocolJson(
  target: PlanetaryTarget,
  site: EarthAnalogSite,
  hardware: HardwareSpecs,
  similitude: SimilitudeCalibrationResult,
  traverse: TraverseComparisonResult,
  seasonal: SeasonalValidityResult,
  triad: TriadCampaignResult,
): string {
  return JSON.stringify(
    {
      schema: 'AETHER-SIM/FieldProtocol/v2.1',
      generatedAtUtc: new Date().toISOString(),
      planetaryTarget: {
        id: target.id,
        name: target.name,
        body: target.body,
        bodyRadiusKm: target.bodyRadiusKm,
        citation: target.citation,
        doi: target.doi,
        coordinates: { lat: target.lat, lon: target.lon, elevationM: target.elevationM },
        gravityMs2: target.gravityMs2,
        pressurePa: target.pressurePa,
      },
      earthAnalogSite: {
        id: site.id,
        name: site.name,
        country: site.country,
        dataSourceTag: site.dataSourceTag,
        coordinates: {
          lat: site.lat,
          lon: site.lon,
          demElevationM: site.elevationM,
          powerGridElevationM: site.powerGridElevationM,
        },
        isaCorrectedPressureMbar: site.pressureMbar,
        partnerAgencyData: site.partnerAgencyData,
      },
      hardwareSpecs: hardware,
      earthLieCalibration: similitude,
      traverseTwinning2Km: {
        elevationRmseM: traverse.elevationRmseM,
        slopeSimilarityPct: traverse.slopeSimilarityPct,
        overallGeometricMatchPct: traverse.overallGeometricMatchPct,
        targetGainM: traverse.targetGainM,
        earthGainM: traverse.earthGainM,
        targetMaxSlopeDeg: traverse.targetMaxSlopeDeg,
        earthMaxSlopeDeg: traverse.earthMaxSlopeDeg,
        targetAvgRoverWhPerKm: traverse.targetAvgRoverWhPerKm,
        earthAvgRoverWhPerKm: traverse.earthAvgRoverWhPerKm,
        targetAvgEvaKcalPerHr: traverse.targetAvgEvaKcalPerHr,
        earthAvgEvaKcalPerHr: traverse.earthAvgEvaKcalPerHr,
      },
      seasonalValidity4D: {
        thresholds: SEASONAL_THRESHOLDS,
        annualMeanFidelity: seasonal.annualMeanFidelity,
        peakMonths: seasonal.peakMonths,
        invalidMonths: seasonal.invalidMonths,
        monthlySummary: seasonal.months,
      },
      triadCampaignOptimization: {
        singleSiteCoveragePct: triad.singleSiteCoveragePct,
        triadCompositeCoveragePct: triad.triadCompositeCoveragePct,
        coverageGainPct: triad.coverageGainPct,
        phases: [
          { role: triad.primary.role, siteId: triad.primary.site.id, windows: triad.primary.bestWindowMonths },
          { role: triad.secondary.role, siteId: triad.secondary.site.id, windows: triad.secondary.bestWindowMonths },
          { role: triad.tertiary.role, siteId: triad.tertiary.site.id, windows: triad.tertiary.bestWindowMonths },
        ],
      },
    },
    null,
    2,
  );
}
