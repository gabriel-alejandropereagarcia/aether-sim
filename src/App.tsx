import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EARTH_ANALOG_SITES,
  EarthAnalogSite,
  PLANETARY_TARGETS,
} from './data/planetaryData';
import {
  computeSeasonalValidityMatrix,
  computeSimilitudeCalibration,
  computeTraverseComparison,
  generateFieldProtocolJson,
  generateFieldProtocolMarkdown,
  HardwareSpecs,
  optimizeTriadCampaign,
} from './engine/similitudePhysics';
import {
  createCustomProbeSite,
  fetchNasaPowerClimatology,
} from './services/nasaPowerClient';
import { HeaderBar } from './components/HeaderBar';
import { DualPlanetaryMap } from './components/DualPlanetaryMap';
import { TraverseProfiler } from './components/TraverseProfiler';
import { PhysicsCalibrationLab } from './components/PhysicsCalibrationLab';
import { SeasonalValidityMatrix } from './components/SeasonalValidityMatrix';
import { PitchDeckModal } from './components/PitchDeckModal';

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export const App: React.FC = () => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('mars-jezero');
  const [sites, setSites] = useState<EarthAnalogSite[]>(EARTH_ANALOG_SITES);
  const [probedSites, setProbedSites] = useState<EarthAnalogSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('llullaillaco');

  const [hardware, setHardware] = useState<HardwareSpecs>({
    systemType: 'ROVER',
    massKg: 300,
    powerWatts: 420,
    contactAreaCm2: 850,
    wheelWidthCm: 22,
  });

  const [powerStatus, setPowerStatus] = useState<
    'LIVE_NASA_POWER' | 'OFFLINE_FALLBACK' | 'FETCHING'
  >('OFFLINE_FALLBACK');
  const [powerLatencyMs, setPowerLatencyMs] = useState<number>(0);
  const [powerEndpointUrl, setPowerEndpointUrl] = useState<string>(
    'https://power.larc.nasa.gov/api/temporal/climatology/point',
  );

  const [isDeckOpen, setIsDeckOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash === '#deck' || window.location.pathname.endsWith('/deck');
  });

  const probeRequestIdRef = useRef<number>(0);
  const probeAbortRef = useRef<AbortController | null>(null);

  const selectedTarget = useMemo(
    () => PLANETARY_TARGETS.find((t) => t.id === selectedTargetId) ?? PLANETARY_TARGETS[0],
    [selectedTargetId],
  );

  const selectedSite = useMemo(() => {
    return (
      probedSites.find((p) => p.id === selectedSiteId) ??
      sites.find((s) => s.id === selectedSiteId) ??
      sites[0]
    );
  }, [probedSites, selectedSiteId, sites]);

  // Live refresh of NASA POWER climatology for curated site with ISA lapse-rate correction
  // Preserves Copernicus DEM site elevationM while updating rawGridClimatology & ISA-corrected values
  useEffect(() => {
    if (selectedSite.isCustomProbe) return;
    const controller = new AbortController();
    setPowerStatus('FETCHING');

    fetchNasaPowerClimatology(selectedSite.lat, selectedSite.lon, selectedSite, controller.signal).then(
      (res) => {
        if (controller.signal.aborted) return;
        setPowerStatus(res.status);
        setPowerLatencyMs(res.latencyMs);
        setPowerEndpointUrl(res.endpointUrl);
        if (res.status === 'LIVE_NASA_POWER') {
          setSites((prev) =>
            prev.map((item) =>
              item.id === selectedSite.id
                ? {
                    ...item,
                    rawGridClimatology: res.rawClimatology,
                    powerGridElevationM: res.powerGridElevationM,
                    climatology: res.climatology,
                    pressureMbar: res.pressureMbar || item.pressureMbar,
                  }
                : item,
            ),
          );
        }
      },
    );

    return () => {
      controller.abort();
    };
  }, [selectedSite.id, selectedSite.isCustomProbe, selectedSite.lat, selectedSite.lon]);

  // Click-Anywhere Earth Live Probe Handler with AbortController + monotonic requestId race guard
  const handleProbeCoordinate = useCallback(async (lat: number, lon: number) => {
    probeAbortRef.current?.abort();
    const controller = new AbortController();
    probeAbortRef.current = controller;
    const reqId = ++probeRequestIdRef.current;

    setPowerStatus('FETCHING');
    const res = await fetchNasaPowerClimatology(lat, lon, undefined, controller.signal);
    if (controller.signal.aborted || reqId !== probeRequestIdRef.current) {
      return;
    }

    const probeSite = createCustomProbeSite(lat, lon, res);
    setProbedSites((prev) => {
      const filtered = prev.filter((p) => p.id !== probeSite.id);
      return [probeSite, ...filtered].slice(0, 8);
    });
    setSelectedSiteId(probeSite.id);
    setPowerStatus(res.status);
    setPowerLatencyMs(res.latencyMs);
    setPowerEndpointUrl(res.endpointUrl);
  }, []);

  const handleSelectSite = useCallback((siteId: string) => {
    probeAbortRef.current?.abort();
    probeRequestIdRef.current++;
    setSelectedSiteId(siteId);
  }, []);

  // Reactive Engineering Computations across Modules 2, 3, and 4
  const calibration = useMemo(
    () => computeSimilitudeCalibration(hardware, selectedSite, selectedTarget),
    [hardware, selectedSite, selectedTarget],
  );

  const traverseComparison = useMemo(
    () => computeTraverseComparison(selectedSite, selectedTarget, hardware),
    [selectedSite, selectedTarget, hardware],
  );

  const seasonalValidity = useMemo(
    () => computeSeasonalValidityMatrix(selectedSite, selectedTarget),
    [selectedSite, selectedTarget],
  );

  const triadCampaign = useMemo(
    () => optimizeTriadCampaign(selectedTarget, hardware, selectedSite, sites),
    [selectedTarget, hardware, selectedSite, sites],
  );

  const protocolMarkdown = useMemo(
    () =>
      generateFieldProtocolMarkdown(
        selectedTarget,
        selectedSite,
        hardware,
        calibration,
        traverseComparison,
        seasonalValidity,
        triadCampaign,
      ),
    [
      selectedTarget,
      selectedSite,
      hardware,
      calibration,
      traverseComparison,
      seasonalValidity,
      triadCampaign,
    ],
  );

  const handleExportMarkdown = useCallback(() => {
    downloadTextFile(
      `AETHER-SIM_Protocol_${selectedTarget.id}_${selectedSite.id}.md`,
      protocolMarkdown,
      'text/markdown;charset=utf-8',
    );
  }, [protocolMarkdown, selectedTarget.id, selectedSite.id]);

  const handleExportJson = useCallback(() => {
    const jsonStr = generateFieldProtocolJson(
      selectedTarget,
      selectedSite,
      hardware,
      calibration,
      traverseComparison,
      seasonalValidity,
      triadCampaign,
    );
    downloadTextFile(
      `AETHER-SIM_Protocol_${selectedTarget.id}_${selectedSite.id}.json`,
      jsonStr,
      'application/json;charset=utf-8',
    );
  }, [
    selectedTarget,
    selectedSite,
    hardware,
    calibration,
    traverseComparison,
    seasonalValidity,
    triadCampaign,
  ]);

  const handleOpenDeck = useCallback(() => {
    setIsDeckOpen(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#deck');
    }
  }, []);

  const handleCloseDeck = useCallback(() => {
    setIsDeckOpen(false);
    if (typeof window !== 'undefined' && window.location.hash === '#deck') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#04070d] text-slate-100 telemetry-grid">
      <div id="app-shell">
        <HeaderBar
          targets={PLANETARY_TARGETS}
          selectedTarget={selectedTarget}
          onSelectTarget={setSelectedTargetId}
          sites={sites}
          probedSites={probedSites}
          selectedSite={selectedSite}
          onSelectSite={handleSelectSite}
          powerStatus={powerStatus}
          powerLatencyMs={powerLatencyMs}
          onOpenDeck={handleOpenDeck}
          onQuickExportProtocol={handleExportMarkdown}
          calibratedFidelity={calibration.calibratedFidelityScore}
        />

        <main className="mx-auto flex max-w-[1640px] flex-col gap-5 px-4 py-5">
          {/* Top Mission Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/70 px-3.5 py-2 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400">
                PRIMARY CHALLENGE:{' '}
                <strong className="text-slate-200">{selectedTarget.keyChallenge}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-cyan-300">
                RESIDUAL SIMILITUDE SCORE (RAW 1g -&gt; POST-RIG):{' '}
                <strong>
                  {calibration.uncompensatedFidelityScore}% -&gt; {calibration.calibratedFidelityScore}%
                </strong>
              </span>
            </div>
          </div>

          {/* Module 1: Dual Planetary Command Map & Custom Coordinate Probe */}
          <DualPlanetaryMap
            sites={sites}
            probedSites={probedSites}
            selectedSite={selectedSite}
            onSelectSite={handleSelectSite}
            selectedTarget={selectedTarget}
            onProbeCoordinate={handleProbeCoordinate}
            isProbing={powerStatus === 'FETCHING'}
            powerEndpointUrl={powerEndpointUrl}
          />

          {/* Module 2: 1:1 Traverse Twinning Profiler */}
          <TraverseProfiler
            site={selectedSite}
            target={selectedTarget}
            comparison={traverseComparison}
          />

          {/* Module 3: The "Earth-Lie" Physics Similitude & Hardware Calibration Lab */}
          <PhysicsCalibrationLab
            hardware={hardware}
            onChangeHardware={setHardware}
            site={selectedSite}
            target={selectedTarget}
            calibration={calibration}
          />

          {/* Module 4: 4D Seasonal Validity Matrix & Triad Campaign Exporter */}
          <SeasonalValidityMatrix
            site={selectedSite}
            target={selectedTarget}
            seasonal={seasonalValidity}
            triad={triadCampaign}
            onExportMarkdown={handleExportMarkdown}
            onExportJson={handleExportJson}
            protocolMarkdownPreview={protocolMarkdown}
          />
        </main>

        {/* Compliance & Transparency Footer */}
        <footer className="mt-6 border-t border-slate-800/90 bg-[#050912] px-4 py-4">
          <div className="mx-auto flex max-w-[1640px] flex-col justify-between gap-2 text-xs text-slate-400 md:flex-row md:items-center">
            <div>
              <p className="font-mono text-[11px] font-semibold text-slate-200">
                AETHER-SIM v2.1 | Open-Source Apache 2.0 | NASA Space Apps 2026 Challenge Entry
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Verified Feeds: NASA POWER API (ISA Lapse-Corrected), ESA Copernicus GLO-90 DEM, NASA GIBS WMTS, NASA Moon/Mars Trek WMTS, and peer-reviewed LOLA/MOLA/CONAE/ESA/JAXA literature.
              </p>
            </div>
            <div className="rounded-md border border-cyan-500/30 bg-cyan-950/20 px-3 py-1.5 font-mono text-[10px] text-cyan-200">
              AI ASSISTANCE NOTICE: AI coding tools assisted with TypeScript/React implementation and physics model wiring. Zero NASA logos or insignias are used or modified.
            </div>
          </div>
        </footer>
      </div>

      {/* Interactive 7-Slide Judge Presentation Mode */}
      <PitchDeckModal
        isOpen={isDeckOpen}
        onClose={handleCloseDeck}
        selectedSite={selectedSite}
        selectedTarget={selectedTarget}
        calibration={calibration}
        triad={triadCampaign}
      />
    </div>
  );
};

export default App;
