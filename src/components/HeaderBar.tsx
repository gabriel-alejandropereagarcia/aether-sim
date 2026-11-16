import React from 'react';
import {
  Activity,
  Download,
  Globe2,
  Orbit,
  Presentation,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';

interface HeaderBarProps {
  targets: PlanetaryTarget[];
  selectedTarget: PlanetaryTarget;
  onSelectTarget: (targetId: string) => void;
  sites: EarthAnalogSite[];
  probedSites: EarthAnalogSite[];
  selectedSite: EarthAnalogSite;
  onSelectSite: (siteId: string) => void;
  powerStatus: 'LIVE_NASA_POWER' | 'OFFLINE_FALLBACK' | 'FETCHING';
  powerLatencyMs: number;
  onOpenDeck: () => void;
  onQuickExportProtocol: () => void;
  calibratedFidelity: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  targets,
  selectedTarget,
  onSelectTarget,
  sites,
  probedSites,
  selectedSite,
  onSelectSite,
  powerStatus,
  powerLatencyMs,
  onOpenDeck,
  onQuickExportProtocol,
  calibratedFidelity,
}) => {
  const moonTargets = targets.filter((t) => t.body === 'MOON');
  const marsTargets = targets.filter((t) => t.body === 'MARS');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#050912]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/40 shadow-[0_0_16px_rgba(34,211,238,0.2)]">
            <Orbit className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm font-bold tracking-wider text-slate-100 sm:text-base">
                AETHER-SIM <span className="text-cyan-400">v2.1</span>
              </h1>
              <span className="hidden rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan-300 sm:inline-block">
                NASA SPACE APPS 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Planetary Analog Similitude, 4D Window &amp; 1:1 Traverse Twinning Engine
            </p>
          </div>
        </div>

        {/* Mission Target & Earth Analog Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5">
            <Orbit
              className={`h-4 w-4 shrink-0 ${
                selectedTarget.body === 'MARS' ? 'text-orange-400' : 'text-slate-300'
              }`}
            />
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                Target Planetary Site
              </span>
              <select
                aria-label="Select Planetary Target"
                value={selectedTarget.id}
                onChange={(e) => onSelectTarget(e.target.value)}
                className="bg-transparent font-mono text-xs font-semibold text-slate-100 outline-none cursor-pointer"
              >
                <optgroup label="MOON (ARTEMIS / CLPS)" className="bg-slate-900 text-slate-200">
                  {moonTargets.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                      {t.shortName}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="MARS (PERSEVERANCE / CURIOSITY / ISRU)" className="bg-slate-900 text-slate-200">
                  {marsTargets.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                      {t.shortName}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5">
            <Globe2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                Earth Analog Site
              </span>
              <select
                aria-label="Select Earth Analog Site"
                value={selectedSite.id}
                onChange={(e) => onSelectSite(e.target.value)}
                className="bg-transparent font-mono text-xs font-semibold text-slate-100 outline-none cursor-pointer max-w-[240px]"
              >
                {probedSites.length > 0 && (
                  <optgroup label="LIVE PROBED COORDINATES" className="bg-slate-900 text-cyan-300">
                    {probedSites.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-cyan-300">
                        {p.name} ({p.elevationM} m)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="CURATED ANALOG SITES" className="bg-slate-900 text-slate-200">
                  {sites.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                      {s.name} ({s.country})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* Telemetry Status & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Calibrated Fidelity Pill */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1.5 xl:flex">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] text-emerald-300">
              SIMILITUDE: <strong>{calibratedFidelity.toFixed(1)}%</strong>
            </span>
          </div>

          {/* Live NASA POWER Status Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] ${
              powerStatus === 'FETCHING'
                ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                : powerStatus === 'LIVE_NASA_POWER'
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                  : 'border-cyan-500/30 bg-cyan-950/30 text-cyan-300'
            }`}
            title="NASA POWER Climatology API status (15 s timeout; offline probes are not scored)"
          >
            {powerStatus === 'FETCHING' ? (
              <Radio className="h-3.5 w-3.5 animate-pulse" />
            ) : powerStatus === 'LIVE_NASA_POWER' ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span>
              {powerStatus === 'FETCHING'
                ? 'PROBING POWER API...'
                : powerStatus === 'LIVE_NASA_POWER'
                  ? `NASA POWER LIVE (${powerLatencyMs}ms)`
                  : 'POWER CACHE ACTIVE'}
            </span>
          </div>

          {/* Export Protocol */}
          <button
            type="button"
            onClick={onQuickExportProtocol}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-mono text-xs font-medium text-slate-200 transition hover:border-cyan-500/60 hover:bg-slate-800 hover:text-cyan-300"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export TRL Protocol</span>
          </button>

          {/* 7-Slide Judge Presentation Mode */}
          <button
            type="button"
            onClick={onOpenDeck}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.18)] transition hover:bg-amber-500/25"
          >
            <Presentation className="h-3.5 w-3.5" />
            <span>7-Slide Judge Deck</span>
          </button>
        </div>
      </div>
    </header>
  );
};
