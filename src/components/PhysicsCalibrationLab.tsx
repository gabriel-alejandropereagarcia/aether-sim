import React from 'react';
import {
  AlertTriangle,
  Cpu,
  Flame,
  Gauge,
  Scale,
  ShieldAlert,
  ThermometerSnowflake,
  Wrench,
} from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';
import {
  HardwareSpecs,
  HardwareSystemType,
  SimilitudeCalibrationResult,
} from '../engine/similitudePhysics';

interface PhysicsCalibrationLabProps {
  hardware: HardwareSpecs;
  onChangeHardware: (next: HardwareSpecs) => void;
  site: EarthAnalogSite;
  target: PlanetaryTarget;
  calibration: SimilitudeCalibrationResult;
}

const SYSTEM_PRESETS: Record<
  HardwareSystemType,
  {
    label: string;
    defaultMassKg: number;
    defaultPowerW: number;
    defaultAreaCm2: number;
    defaultWidthCm: number;
  }
> = {
  ROVER: {
    label: 'Rover / Mobility',
    defaultMassKg: 300,
    defaultPowerW: 420,
    defaultAreaCm2: 850,
    defaultWidthCm: 22,
  },
  CRYO_DRILL: {
    label: 'Cryo-Drill / ISRU',
    defaultMassKg: 85,
    defaultPowerW: 950,
    defaultAreaCm2: 180,
    defaultWidthCm: 10,
  },
  EVA_SUIT: {
    label: 'Spacesuit EVA',
    defaultMassKg: 128,
    defaultPowerW: 260,
    defaultAreaCm2: 560,
    defaultWidthCm: 14,
  },
  GPR_SENSOR: {
    label: 'GPR / Spectral Sensor',
    defaultMassKg: 32,
    defaultPowerW: 110,
    defaultAreaCm2: 240,
    defaultWidthCm: 16,
  },
};

export const PhysicsCalibrationLab: React.FC<PhysicsCalibrationLabProps> = ({
  hardware,
  onChangeHardware,
  site,
  target,
  calibration,
}) => {
  const selectSystemType = (systemType: HardwareSystemType) => {
    const preset = SYSTEM_PRESETS[systemType];
    onChangeHardware({
      systemType,
      massKg: preset.defaultMassKg,
      powerWatts: preset.defaultPowerW,
      contactAreaCm2: preset.defaultAreaCm2,
      wheelWidthCm: preset.defaultWidthCm,
    });
  };

  const maxSinkageScale = Math.max(
    10,
    calibration.earthUncompensatedSinkageMm,
    calibration.targetSinkageMm,
    calibration.earthOffloadedSinkageMm,
  );
  const sinkPct = (mm: number) => Math.min(100, Math.max(8, (mm / maxSinkageScale) * 100));

  return (
    <section className="rounded-xl border border-slate-800 bg-[#ffffff]/95 p-4 shadow-xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-300">
              Module 03
            </span>
            <h2 className="text-sm font-bold tracking-wide text-slate-100 sm:text-base">
              Earth-vs-Target Physics Calibration Lab (first-order models)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Quantifying gravitational mass offloading, Bekker-Wong wheel sinkage (width b = {hardware.wheelWidthCm} cm), and McAdams convective cooling bias at{' '}
            <span className="font-mono text-slate-200">{site.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 font-mono text-xs">
          <div>
            <span className="text-slate-400">Raw 1g heuristic index: </span>
            <span className="font-bold text-rose-400">
              {calibration.uncompensatedFidelityScore.toFixed(1)}%
            </span>
          </div>
          <span className="text-slate-600">-&gt;</span>
          <div>
            <span className="text-slate-400">Post-rig heuristic index: </span>
            <span className="font-bold text-emerald-400">
              {calibration.calibratedFidelityScore.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Hardware Controls Bar */}
      <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/85 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-cyan-300">
            <Cpu className="h-4 w-4" />
            <span>TEST HARDWARE CONFIGURATION</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SYSTEM_PRESETS) as HardwareSystemType[]).map((sysKey) => (
              <button
                key={sysKey}
                type="button"
                onClick={() => selectSystemType(sysKey)}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                  hardware.systemType === sysKey
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {SYSTEM_PRESETS[sysKey].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-slate-300">Hardware Mass</span>
              <span className="font-bold text-cyan-300">{hardware.massKg} kg</span>
            </div>
            <input
              type="range"
              min={5}
              max={1000}
              step={5}
              value={hardware.massKg}
              onChange={(e) =>
                onChangeHardware({ ...hardware, massKg: Number(e.target.value) })
              }
              className="aerospace-slider mt-2 w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
              <span>5 kg</span>
              <span>1,000 kg</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-slate-300">Thermal Power</span>
              <span className="font-bold text-amber-300">{hardware.powerWatts} W</span>
            </div>
            <input
              type="range"
              min={10}
              max={2000}
              step={10}
              value={hardware.powerWatts}
              onChange={(e) =>
                onChangeHardware({ ...hardware, powerWatts: Number(e.target.value) })
              }
              className="aerospace-slider mt-2 w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
              <span>10 W</span>
              <span>2,000 W</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-slate-300">Contact Area (A)</span>
              <span className="font-bold text-emerald-300">{hardware.contactAreaCm2} cm²</span>
            </div>
            <input
              type="range"
              min={10}
              max={2500}
              step={10}
              value={hardware.contactAreaCm2}
              onChange={(e) =>
                onChangeHardware({ ...hardware, contactAreaCm2: Number(e.target.value) })
              }
              className="aerospace-slider mt-2 w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
              <span>10 cm²</span>
              <span>2,500 cm²</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-slate-300">Wheel / Foot Width (b)</span>
              <span className="font-bold text-purple-300">{hardware.wheelWidthCm} cm</span>
            </div>
            <input
              type="range"
              min={4}
              max={80}
              step={1}
              value={hardware.wheelWidthCm}
              onChange={(e) =>
                onChangeHardware({ ...hardware, wheelWidthCm: Number(e.target.value) })
              }
              className="aerospace-slider mt-2 w-full"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
              <span>4 cm (Drill)</span>
              <span>80 cm (Wide Pad)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Physics Engineering Output Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Card 1: Gravitational Mass Offloading */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/65 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-cyan-300">
                <Scale className="h-4 w-4" />
                GRAVITY OFFLOAD RIG
              </span>
              <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                {calibration.offloadRatioPct}% Offload
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              At <span className="font-semibold text-slate-100">{site.name}</span> (
              <span className="font-mono text-cyan-300">g = {calibration.earthGravityMs2} m/s²</span>), offload{' '}
              <span className="font-mono font-bold text-amber-300">
                {calibration.offloadRatioPct}% ({calibration.offloadMassKg} kg)
              </span>{' '}
              via aerostat or servo-gimbal crane for{' '}
              <span className="font-semibold text-slate-100">{target.body}</span> simulation (
              <span className="font-mono">{calibration.targetGravityMs2} m/s²</span>).
            </p>

            <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Uncompensated Earth Weight:</span>
                <span className="text-rose-300">{calibration.uncompensatedEarthWeightN} N</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-slate-400">
                <span>Required Gimbal Upward Lift:</span>
                <span className="text-cyan-300">-{calibration.offloadForceNewtons} N</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-slate-800 pt-1.5 font-bold">
                <span className="text-slate-200">Effective Regolith Normal Force:</span>
                <span className="text-emerald-400">{calibration.effectiveTargetWeightN} N</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded bg-slate-950/70 px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
            <span>Gravity Scaling Ratio: {calibration.gravityRatio}x Earth</span>
            <span className="text-cyan-400">Somigliana WGS84 + Free-Air</span>
          </div>
        </div>

        {/* Card 2: Bekker-Wong Wheel Sinkage Distortion */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/65 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-300">
                <Gauge className="h-4 w-4" />
                BEKKER-WONG SINKAGE (z0)
              </span>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                {calibration.sinkageDistortionRatio}x Distortion
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              At <span className="font-mono">b = {hardware.wheelWidthCm} cm</span>, uncompensated Earth sinkage reaches{' '}
              <span className="font-mono font-bold text-rose-300">
                {calibration.earthUncompensatedSinkageMm} mm
              </span>{' '}
              vs.{' '}
              <span className="font-mono font-bold text-emerald-300">
                {calibration.targetSinkageMm} mm
              </span>{' '}
              on {target.body} regolith (<span className="font-mono">n = {target.regolith.n}</span>).
            </p>

            <div className="mt-3 space-y-2 rounded border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px]">
              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Modelled {target.body} Target Sinkage</span>
                  <span className="text-emerald-300">{calibration.targetSinkageMm} mm</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{ width: `${sinkPct(calibration.targetSinkageMm)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Earth Uncompensated (Raw 1g)</span>
                  <span className="text-rose-400">{calibration.earthUncompensatedSinkageMm} mm</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{ width: `${sinkPct(calibration.earthUncompensatedSinkageMm)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Earth + Gimbal Offload</span>
                  <span className="text-cyan-300">{calibration.earthOffloadedSinkageMm} mm</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full bg-cyan-400 transition-all"
                    style={{ width: `${sinkPct(calibration.earthOffloadedSinkageMm)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1 rounded bg-slate-950/70 px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
            <div className="flex items-center justify-between">
              <span>Residual Soil Modulus Bias: {calibration.residualGeotechnicalBiasPct}%</span>
              <span className="flex items-center gap-1 text-amber-300">
                <Wrench className="h-3 w-3" />
                Trim: {calibration.tirePressureOrBallastAdjustmentPct > 0 ? '+' : ''}
                {calibration.tirePressureOrBallastAdjustmentPct}%
              </span>
            </div>
            <span className="truncate text-[9px] text-slate-500" title={target.regolith.sourceNote}>
              {target.regolith.sourceNote}
            </span>
          </div>
        </div>

        {/* Card 3: Atmospheric Convection Bias */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/65 p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-orange-300">
                <ThermometerSnowflake className="h-4 w-4" />
                THERMAL CONVECTION BIAS
              </span>
              <span className="rounded bg-orange-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-orange-300">
                +{calibration.convectiveBiasWm2K} W/m²K
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              At <span className="font-mono">{site.pressureMbar} mbar</span> (ISA) &amp;{' '}
              <span className="font-mono">{calibration.meanWindSpeedMs} m/s</span> wind, McAdams air convection extracts{' '}
              <span className="font-mono font-bold text-rose-300">
                {calibration.parasiticHeatLossWatts} W
              </span>{' '}
              across <span className="font-mono">{calibration.surfaceDeltaTC} °C</span> chassis ΔT.
            </p>

            <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Earth Site Convection (h_e):</span>
                <span className="text-orange-300">{calibration.earthConvectionCoeffWm2K} W/m²K</span>
              </div>
              <div className="mt-1 flex justify-between text-slate-400">
                <span>{target.body} Convection (h_t):</span>
                <span className="text-emerald-300">{calibration.targetConvectionCoeffWm2K} W/m²K</span>
              </div>
              <div className="mt-1 flex justify-between text-slate-400">
                <span>Required MLI/Aerogel Shroud:</span>
                <span className="text-cyan-300">R = {calibration.requiredThermalShroudRValue} m²K/W</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-slate-800 pt-1.5 font-bold">
                <span className="flex items-center gap-1 text-slate-200">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  Make-Up Heater Comp:
                </span>
                <span className="text-amber-300">{calibration.activeMakeUpHeaterWatts} W</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded bg-slate-950/70 px-2.5 py-1.5 font-mono text-[10px] text-slate-400">
            <span>McAdams (1954) + Stefan-Boltzmann</span>
            <span className="text-slate-300">T_amb: {calibration.meanAmbientTempC} °C</span>
          </div>
        </div>
      </div>

      {/* Explicit Unmitigable Limitations Panel */}
      <div className="mt-4 rounded-lg border border-rose-500/35 bg-rose-950/15 p-3.5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-rose-300">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>
              EXPLICIT UNMITIGABLE TERRESTRIAL LIMITATIONS (MANDATORY CHAMBER / ACCELERATOR CO-TESTS)
            </span>
          </div>
          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-200">
            OUTDOOR ANALOG INTEGRITY GUARDRAIL
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {calibration.unmitigableLimitations.map((lim) => (
            <div
              key={lim.id}
              className="rounded-md border border-rose-900/60 bg-slate-950/80 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  {lim.phenomenon}
                </span>
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-300">
                  {lim.severity}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                <strong className="text-slate-300">Why Earth Fails:</strong> {lim.earthLimitation}
              </p>
              <p className="mt-1 text-[11px] text-cyan-300/90">
                <strong>Required Co-Test:</strong> {lim.chamberMitigation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
