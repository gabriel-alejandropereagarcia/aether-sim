import { describe, expect, it } from 'vitest';
import {
  applyIsaLapseRateCorrection,
  EARTH_ANALOG_SITES,
  PLANETARY_TARGETS,
} from '../../data/planetaryData';
import {
  computeBekkerWongSinkageMm,
  computeLocalEarthGravity,
  computePandolfEvaKcalPerHr,
  computeSeasonalValidityMatrix,
  computeSimilitudeCalibration,
  computeTraverseComparison,
  generateFieldProtocolJson,
  generateFieldProtocolMarkdown,
  HardwareSpecs,
  optimizeTriadCampaign,
  SEASONAL_THRESHOLDS,
} from '../similitudePhysics';
import { createCustomProbeSite, deriveElevationFromPressureKpa } from '../../services/nasaPowerClient';

const ROVER_SPECS: HardwareSpecs = {
  systemType: 'ROVER',
  massKg: 300,
  powerWatts: 420,
  contactAreaCm2: 850,
  wheelWidthCm: 22,
};

describe('AETHER-SIM Physics & Calibration Kernel', () => {
  it('computes WGS84 Somigliana gravity accurately at equator, pole, and altitude', () => {
    const gEquator = computeLocalEarthGravity(0, 0);
    const gPole = computeLocalEarthGravity(90, 0);
    const gHighAlt = computeLocalEarthGravity(0, 5000);

    expect(gEquator).toBeCloseTo(9.7803, 3);
    expect(gPole).toBeCloseTo(9.8322, 3);
    expect(gHighAlt).toBeLessThan(gEquator);
    expect(gEquator - gHighAlt).toBeCloseTo(3.086e-6 * 5000, 3);
  });

  it('computes expected Moon (~83.4%) and Mars (~62.0%) gravity offloading ratios', () => {
    const llullaillaco = EARTH_ANALOG_SITES.find((s) => s.id === 'llullaillaco')!;
    const moonTarget = PLANETARY_TARGETS.find((t) => t.id === 'moon-shackleton')!;
    const marsTarget = PLANETARY_TARGETS.find((t) => t.id === 'mars-jezero')!;

    const moonCal = computeSimilitudeCalibration(ROVER_SPECS, llullaillaco, moonTarget);
    const marsCal = computeSimilitudeCalibration(ROVER_SPECS, llullaillaco, marsTarget);

    expect(moonCal.offloadRatioPct).toBeCloseTo(83.4, 0);
    expect(marsCal.offloadRatioPct).toBeCloseTo(61.9, 0);
    expect(moonCal.targetConvectionCoeffWm2K).toBe(0);
    expect(marsCal.targetConvectionCoeffWm2K).toBeGreaterThan(0);
    expect(marsCal.targetConvectionCoeffWm2K).toBeLessThan(marsCal.earthConvectionCoeffWm2K);
  });

  it('enforces monotonic Bekker-Wong sinkage with load and wheel width sensitivity', () => {
    const sLight = computeBekkerWongSinkageMm(500, 850, 22, 1.4, 820, 1.0);
    const sHeavy = computeBekkerWongSinkageMm(1500, 850, 22, 1.4, 820, 1.0);
    const sNarrow = computeBekkerWongSinkageMm(1000, 850, 5, 50, 400, 1.0);
    const sWide = computeBekkerWongSinkageMm(1000, 850, 40, 50, 400, 1.0);

    expect(sHeavy).toBeGreaterThan(sLight);
    expect(sWide).toBeGreaterThan(sNarrow); // smaller kc/b increases sinkage
  });

  it('applies ISA tropospheric lapse-rate and hypsometric pressure correction consistently', () => {
    const dallol = EARTH_ANALOG_SITES.find((s) => s.id === 'dallol')!;
    const llullaillaco = EARTH_ANALOG_SITES.find((s) => s.id === 'llullaillaco')!;

    // Dallol sits ~1,156 m BELOW its POWER grid cell -> corrected T2M must be warmer and PS higher
    expect(dallol.elevationM).toBeLessThan(dallol.powerGridElevationM);
    expect(dallol.climatology.T2M[0]).toBeGreaterThan(dallol.rawGridClimatology.T2M[0]);
    expect(dallol.climatology.PS[0]).toBeGreaterThan(dallol.rawGridClimatology.PS[0]);

    // Llullaillaco apron sits ~1,495 m ABOVE its POWER grid cell -> corrected T2M colder and PS lower
    expect(llullaillaco.elevationM).toBeGreaterThan(llullaillaco.powerGridElevationM);
    expect(llullaillaco.climatology.T2M[0]).toBeLessThan(llullaillaco.rawGridClimatology.T2M[0]);
    expect(llullaillaco.climatology.PS[0]).toBeLessThan(llullaillaco.rawGridClimatology.PS[0]);

    // Verify exact -6.5 C per +1000 m lapse rate on synthetic block
    const dummy = {
      T2M: Array(12).fill(10),
      T2M_MAX: Array(12).fill(15),
      T2M_MIN: Array(12).fill(5),
      PRECTOTCORR: Array(12).fill(0),
      ALLSKY_SFC_SW_DWN: Array(12).fill(5),
      WS10M: Array(12).fill(4),
      RH2M: Array(12).fill(30),
      PS: Array(12).fill(90),
    };
    const corrected = applyIsaLapseRateCorrection(dummy, 1000, 2000);
    expect(corrected.T2M[0]).toBeCloseTo(3.5, 2);
    expect(corrected.PS[0]).toBeLessThan(90);
  });

  it('computes Pandolf (1977) EVA metabolic load monotonically with slope and gravity, decoupled from rover mass', () => {
    const flatMoon = computePandolfEvaKcalPerHr(0, 0.3, 1.62);
    const steepMoon = computePandolfEvaKcalPerHr(15, 0.3, 1.62);
    const steepEarth = computePandolfEvaKcalPerHr(15, 0.3, 9.81);

    expect(steepMoon).toBeGreaterThan(flatMoon);
    expect(steepEarth).toBeGreaterThan(steepMoon);

    const llullaillaco = EARTH_ANALOG_SITES[0];
    const jezero = PLANETARY_TARGETS.find((t) => t.id === 'mars-jezero')!;
    const compLightRover = computeTraverseComparison(llullaillaco, jezero, { ...ROVER_SPECS, massKg: 50 });
    const compHeavyRover = computeTraverseComparison(llullaillaco, jezero, { ...ROVER_SPECS, massKg: 900 });

    // Rover energy scales with rover mass, while EVA Pandolf load stays unchanged
    expect(compHeavyRover.targetAvgRoverWhPerKm).toBeGreaterThan(compLightRover.targetAvgRoverWhPerKm);
    expect(compHeavyRover.targetAvgEvaKcalPerHr).toBe(compLightRover.targetAvgEvaKcalPerHr);
  });

  it('enforces unified seasonal thresholds across classifications and peak/invalid lists', () => {
    const arizaro = EARTH_ANALOG_SITES.find((s) => s.id === 'arizaro')!;
    const gale = PLANETARY_TARGETS.find((t) => t.id === 'mars-gale')!;
    const seasonal = computeSeasonalValidityMatrix(arizaro, gale);

    expect(seasonal.months).toHaveLength(12);
    for (const m of seasonal.months) {
      if (m.compositeScore >= SEASONAL_THRESHOLDS.PEAK) {
        expect(m.classification).toBe('PEAK_ANALOG');
        expect(seasonal.peakMonths).toContain(m.monthLabel);
      } else if (m.compositeScore < SEASONAL_THRESHOLDS.MARGINAL) {
        expect(m.classification).toBe('CRITICAL_INVALID');
        expect(seasonal.invalidMonths).toContain(m.monthLabel);
      }
    }
  });

  it('weights Triad Campaign axes dynamically by hardware systemType', () => {
    const llullaillaco = EARTH_ANALOG_SITES.find((s) => s.id === 'llullaillaco')!;
    const jezero = PLANETARY_TARGETS.find((t) => t.id === 'mars-jezero')!;

    const roverTriad = optimizeTriadCampaign(jezero, ROVER_SPECS, llullaillaco, EARTH_ANALOG_SITES);
    const gprTriad = optimizeTriadCampaign(
      jezero,
      { ...ROVER_SPECS, systemType: 'GPR_SENSOR' },
      llullaillaco,
      EARTH_ANALOG_SITES,
    );

    const roverGeoWeight = roverTriad.axisCoverage.find((a) => a.axis.includes('Geochemistry'))!.weight;
    const gprGeoWeight = gprTriad.axisCoverage.find((a) => a.axis.includes('Geochemistry'))!.weight;

    expect(gprGeoWeight).toBeGreaterThan(roverGeoWeight);
    expect(roverTriad.triadCompositeCoveragePct).toBeGreaterThanOrEqual(
      roverTriad.singleSiteCoveragePct,
    );
  });

  it('exports valid JSON and Markdown Field Test Protocols with complete provenance fields', () => {
    const site = EARTH_ANALOG_SITES[0];
    const target = PLANETARY_TARGETS[0];
    const cal = computeSimilitudeCalibration(ROVER_SPECS, site, target);
    const trav = computeTraverseComparison(site, target, ROVER_SPECS);
    const seas = computeSeasonalValidityMatrix(site, target);
    const triad = optimizeTriadCampaign(target, ROVER_SPECS, site, EARTH_ANALOG_SITES);

    const jsonText = generateFieldProtocolJson(target, site, ROVER_SPECS, cal, trav, seas, triad);
    const parsed = JSON.parse(jsonText);
    expect(parsed.schema).toBe('AETHER-SIM/FieldProtocol/v2.1');
    expect(parsed.planetaryTarget.doi).toBe(target.doi);
    expect(parsed.earthAnalogSite.dataSourceTag).toBe('VERIFIED_POWER_AND_COPERNICUS_DEM');
    expect(parsed.seasonalValidity4D.thresholds).toEqual(SEASONAL_THRESHOLDS);

    const md = generateFieldProtocolMarkdown(target, site, ROVER_SPECS, cal, trav, seas, triad);
    expect(md).toContain(target.citation);
    expect(md).toContain('UNMITIGABLE FIELD LIMITATIONS');
  });

  it('creates custom probe sites with transparent provenance tags and hypsometric elevation fallback', () => {
    expect(deriveElevationFromPressureKpa(101.325)).toBe(0);
    expect(deriveElevationFromPressureKpa(54)).toBeGreaterThan(4500);

    const dummyGrid = {
      T2M: Array(12).fill(5),
      T2M_MAX: Array(12).fill(11),
      T2M_MIN: Array(12).fill(-2),
      PRECTOTCORR: Array(12).fill(0.2),
      ALLSKY_SFC_SW_DWN: Array(12).fill(5.5),
      WS10M: Array(12).fill(4.2),
      RH2M: Array(12).fill(28),
      PS: Array(12).fill(70),
    };

    const liveProbe = createCustomProbeSite(-24.5, -68.2, {
      rawClimatology: dummyGrid,
      climatology: dummyGrid,
      powerGridElevationM: 3100,
      elevationM: 3450,
      pressureMbar: 680,
      status: 'LIVE_NASA_POWER',
      demStatus: 'UNAVAILABLE_FALLBACK',
      latencyMs: 120,
      endpointUrl: 'https://power.larc.nasa.gov/api/temporal/climatology/point',
    });

    expect(liveProbe.dataSourceTag).toBe('LIVE_API_MEASURED');
    expect(liveProbe.traverse).toHaveLength(21);
    expect(liveProbe.isCustomProbe).toBe(true);
  });
});
