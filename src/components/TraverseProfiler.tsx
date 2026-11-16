import React, { useState } from 'react';
import { Activity, Flame, Mountain, Route, Zap } from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';
import { TraverseComparisonResult } from '../engine/similitudePhysics';

type ChartMetricMode = 'ELEVATION' | 'SLOPE' | 'ENERGY';

interface TraverseProfilerProps {
  site: EarthAnalogSite;
  target: PlanetaryTarget;
  comparison: TraverseComparisonResult;
}

export const TraverseProfiler: React.FC<TraverseProfilerProps> = ({
  site,
  target,
  comparison,
}) => {
  const [chartMode, setChartMode] = useState<ChartMetricMode>('ELEVATION');
  const [hoverIdx, setHoverIdx] = useState<number>(10);

  const width = 920;
  const height = 270;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const samples = comparison.samples;
  const activeSample = samples[hoverIdx] ?? samples[0];

  const getValues = () => {
    if (chartMode === 'ELEVATION') {
      return {
        targetSeries: samples.map((s) => s.targetRelElevM),
        earthSeries: samples.map((s) => s.earthRelElevM),
        unit: 'm',
        title: 'Relative Elevation Gain vs. Traverse Distance (m)',
      };
    }
    if (chartMode === 'SLOPE') {
      return {
        targetSeries: samples.map((s) => s.targetSlopeDeg),
        earthSeries: samples.map((s) => s.earthSlopeDeg),
        unit: '°',
        title: 'Instantaneous Terrain Slope Angle θ (degrees)',
      };
    }
    return {
      targetSeries: samples.map((s) => s.targetRoverWhPerKm),
      earthSeries: samples.map((s) => s.earthRoverWhPerKm),
      unit: 'Wh/km',
      title: 'Rover Specific Mobility Energy (Target Gravity vs. Uncompensated Earth)',
    };
  };

  const { targetSeries, earthSeries, unit, title } = getValues();
  const allVals = [...targetSeries, ...earthSeries];
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const margin = Math.max(4, (rawMax - rawMin) * 0.14);
  // Slopes are signed (negative = downhill), so the slope axis must extend below zero too
  const yMin = chartMode === 'SLOPE' ? Math.min(0, Math.floor(rawMin - margin * 0.4)) : Math.floor(rawMin - margin * 0.4);
  const yMax = Math.ceil(rawMax + margin * 0.6);
  const ySpan = Math.max(1, yMax - yMin);

  const xFor = (idx: number) => padLeft + (idx / Math.max(1, samples.length - 1)) * plotW;
  const yFor = (val: number) => padTop + plotH - ((val - yMin) / ySpan) * plotH;

  const buildPolyline = (series: number[]) =>
    series.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');

  const buildAreaPath = (series: number[]) => {
    const pts = series.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' L ');
    const baseY = (padTop + plotH).toFixed(1);
    return `M ${xFor(0).toFixed(1)},${baseY} L ${pts} L ${xFor(series.length - 1).toFixed(1)},${baseY} Z`;
  };

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const frac = i / 4;
    const val = yMin + frac * ySpan;
    return { val: Math.round(val), y: yFor(val) };
  });

  return (
    <section className="rounded-xl border border-slate-800 bg-[#ffffff]/95 p-4 shadow-xl">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300">
              Module 02
            </span>
            <h2 className="text-sm font-bold tracking-wide text-slate-100 sm:text-base">
              Traverse Profile Comparison (2.0 km Micro-Route)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Overlaying {target.shortName} ({target.isTraverseParameterized ? 'parameterized from ' : ''}{target.citation}) against {site.name} (Copernicus GLO-90 DEM, ~90 m resolution).
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 p-1">
          {(
            [
              ['ELEVATION', 'Elevation (m)'],
              ['SLOPE', 'Slope θ (°)'],
              ['ENERGY', 'Energy (Wh/km)'],
            ] as [ChartMetricMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setChartMode(mode)}
              className={`rounded px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                chartMode === mode
                  ? 'border border-amber-500/40 bg-amber-500/20 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart + Live Scrubber Readout */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-9 rounded-lg border border-slate-800 bg-slate-950/90 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono font-semibold text-slate-300">{title}</span>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
                {target.body} Target ({target.shortName})
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-cyan-400" />
                Earth Analog ({site.name})
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[250px] w-full min-w-[600px] select-none"
              role="img"
              aria-label="2.0 km Traverse Comparison Chart"
            >
              <defs>
                <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c58a00" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#c58a00" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="earthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a66a8" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#1a66a8" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {yTicks.map((tick, idx) => (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={tick.y}
                    x2={width - padRight}
                    y2={tick.y}
                    stroke="#c6d5e8"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    fill="#4c5f7a"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {tick.val}
                    {chartMode === 'SLOPE' ? '°' : ''}
                  </text>
                </g>
              ))}

              {/* X Axis Labels */}
              {samples.map((s, idx) => {
                if (idx % 2 !== 0) return null;
                const x = xFor(idx);
                return (
                  <g key={s.distanceKm}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + plotH}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={height - 10}
                      textAnchor="middle"
                      fill="#4c5f7a"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {s.distanceKm.toFixed(1)} km
                    </text>
                  </g>
                );
              })}

              {/* Areas */}
              <path d={buildAreaPath(targetSeries)} fill="url(#targetGrad)" />
              <path d={buildAreaPath(earthSeries)} fill="url(#earthGrad)" />

              {/* Lines */}
              <polyline
                fill="none"
                stroke="#c58a00"
                strokeWidth="2.5"
                points={buildPolyline(targetSeries)}
              />
              <polyline
                fill="none"
                stroke="#1a66a8"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                points={buildPolyline(earthSeries)}
              />

              {/* Active Scrubber Vertical Marker */}
              <line
                x1={xFor(hoverIdx)}
                y1={padTop}
                x2={xFor(hoverIdx)}
                y2={padTop + plotH}
                stroke="#2b3e58"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={xFor(hoverIdx)}
                cy={yFor(targetSeries[hoverIdx])}
                r="5"
                fill="#c58a00"
                stroke="#eef4fb"
                strokeWidth="1.5"
              />
              <circle
                cx={xFor(hoverIdx)}
                cy={yFor(earthSeries[hoverIdx])}
                r="5"
                fill="#1a66a8"
                stroke="#eef4fb"
                strokeWidth="1.5"
              />

              {/* Invisible interactive hit columns */}
              {samples.map((_, idx) => {
                const colW = plotW / samples.length;
                return (
                  <rect
                    key={idx}
                    x={xFor(idx) - colW / 2}
                    y={padTop}
                    width={colW}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIdx(idx)}
                    onClick={() => setHoverIdx(idx)}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* Waypoint Telemetry Inspector */}
        <div className="xl:col-span-3 flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-cyan-300">
                WAYPOINT @ {activeSample.distanceKm.toFixed(1)} km
              </span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                {comparison.overallGeometricMatchPct}% Match
              </span>
            </div>

            <div className="mt-2.5 space-y-2 font-mono text-xs">
              <div className="rounded border border-amber-500/25 bg-amber-950/20 p-2">
                <div className="text-[10px] text-amber-300/90">
                  {target.body}: {activeSample.targetLabel ?? 'Traverse Segment'}
                </div>
                <div className="mt-1 flex justify-between text-slate-200">
                  <span>Rel Elev: {activeSample.targetRelElevM >= 0 ? '+' : ''}{activeSample.targetRelElevM} m</span>
                  <span>Slope: {activeSample.targetSlopeDeg}°</span>
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] text-slate-400">
                  <span>Rover: {activeSample.targetRoverWhPerKm} Wh/km</span>
                  <span>EVA: {activeSample.targetEvaKcalPerHr} kcal/h</span>
                </div>
              </div>

              <div className="rounded border border-cyan-500/25 bg-cyan-950/20 p-2">
                <div className="text-[10px] text-cyan-300/90">
                  EARTH: {activeSample.earthLabel ?? 'Analog Segment'}
                </div>
                <div className="mt-1 flex justify-between text-slate-200">
                  <span>Rel Elev: {activeSample.earthRelElevM >= 0 ? '+' : ''}{activeSample.earthRelElevM} m</span>
                  <span>Slope: {activeSample.earthSlopeDeg}°</span>
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] text-slate-400">
                  <span>Rover: {activeSample.earthRoverWhPerKm} Wh/km</span>
                  <span>EVA: {activeSample.earthEvaKcalPerHr} kcal/h</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <label className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>SCRUB WAYPOINT (0.0 – 2.0 km)</span>
              <span className="text-slate-200">{unit}</span>
            </label>
            <input
              type="range"
              min={0}
              max={samples.length - 1}
              value={hoverIdx}
              onChange={(e) => setHoverIdx(Number(e.target.value))}
              className="aerospace-slider mt-1.5 w-full"
            />
          </div>
        </div>
      </div>

      {/* 6 Engineering KPI Cards */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Mountain className="h-3.5 w-3.5 text-amber-400" />
            <span>Elevation Gain</span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-slate-100">
            {comparison.targetGainM}m <span className="text-slate-500">vs</span>{' '}
            <span className="text-cyan-300">{comparison.earthGainM}m</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Route className="h-3.5 w-3.5 text-cyan-400" />
            <span>Max Slope θ_max</span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-slate-100">
            {comparison.targetMaxSlopeDeg}° <span className="text-slate-500">vs</span>{' '}
            <span className="text-cyan-300">{comparison.earthMaxSlopeDeg}°</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>Profile RMSE / Slope</span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-emerald-300">
            ±{comparison.elevationRmseM}m | {comparison.slopeSimilarityPct}%
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Activity className="h-3.5 w-3.5 text-slate-300" />
            <span>Regolith Friction μ</span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-slate-100">
            {target.regolith.frictionCoeffMu} <span className="text-slate-500">vs</span>{' '}
            <span className="text-cyan-300">{site.regolith.frictionCoeffMu}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Rover Energy</span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-slate-100">
            {comparison.targetAvgRoverWhPerKm} <span className="text-slate-500">vs</span>{' '}
            <span className="text-rose-300">{comparison.earthAvgRoverWhPerKm} Wh/km</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span>EVA Metabolic Load</span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-slate-100">
            {comparison.targetAvgEvaKcalPerHr} <span className="text-slate-500">vs</span>{' '}
            <span className="text-rose-300">{comparison.earthAvgEvaKcalPerHr} kcal/h</span>
          </div>
        </div>
      </div>
    </section>
  );
};
