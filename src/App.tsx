import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EARTH_ANALOG_SITES,
  EarthAnalogSite,
  PLANETARY_TARGETS,
  rederiveCuratedFidelityScores,
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
import { DualPlanetaryMap, MapScanCandidate } from './components/DualPlanetaryMap';
import { AnalogFinderPanel } from './components/AnalogFinderPanel';
import type { ScanBbox } from './engine/analogFinder';
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
  // Defer revocation: some browsers start the download asynchronously after click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Deck tab deep-link: ?target=<id>&site=<id>#deck carries the current selection into the new tab
function initialQueryParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

export const App: React.FC = () => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => initialQueryParam('target') ?? 'mars-jezero');
  const [sites, setSites] = useState<EarthAnalogSite[]>(EARTH_ANALOG_SITES);
  const [probedSites, setProbedSites] = useState<EarthAnalogSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => initialQueryParam('site') ?? 'llullaillaco');

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

  // True when this tab was opened as the standalone deck (…#deck)
  const [isDeckTab] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash === '#deck' || window.location.pathname.endsWith('/deck');
  });
  const [isDeckOpen, setIsDeckOpen] = useState<boolean>(isDeckTab);

  // Analog Finder: scan overlay for the Earth map + latest Earth map view bounds (ref: no re-render on pan)
  const [scanDisplay, setScanDisplay] = useState<{ bbox: ScanBbox; candidates: MapScanCandidate[] } | null>(null);
  const earthViewBboxRef = useRef<ScanBbox | null>(null);
  const handleEarthBoundsChange = useCallback((bbox: ScanBbox) => {
    earthViewBboxRef.current = bbox;
  }, []);
  const getEarthViewBbox = useCallback(() => earthViewBboxRef.current, []);

  const probeRequestIdRef = useRef<number>(0);
  const probeAbortRef = useRef<AbortController | null>(null);
  const siteRefreshAbortRef = useRef<AbortController | null>(null);
  // Last non-FETCHING status, restored when an in-flight probe is cancelled
  const settledStatusRef = useRef<'LIVE_NASA_POWER' | 'OFFLINE_FALLBACK'>('OFFLINE_FALLBACK');

  const applyFetchStatus = useCallback(
    (res: { status: 'LIVE_NASA_POWER' | 'OFFLINE_FALLBACK'; latencyMs: number; endpointUrl: string }) => {
      settledStatusRef.current = res.status;
      setPowerStatus(res.status);
      setPowerLatencyMs(res.latencyMs);
      setPowerEndpointUrl(res.endpointUrl);
    },
    [],
  );

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
    siteRefreshAbortRef.current = controller;
    setPowerStatus('FETCHING');

    fetchNasaPowerClimatology(selectedSite.lat, selectedSite.lon, selectedSite, controller.signal).then(
      (res) => {
        if (controller.signal.aborted) return;
        applyFetchStatus(res);
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
                    fidelityScores: rederiveCuratedFidelityScores(item, res.climatology),
                  }
                : item,
            ),
          );
        }
      },
    );

    return () => {
      controller.abort();
      if (siteRefreshAbortRef.current === controller) siteRefreshAbortRef.current = null;
    };
  }, [selectedSite.id, selectedSite.isCustomProbe, selectedSite.lat, selectedSite.lon, applyFetchStatus]);

  // Click-Anywhere Earth Live Probe Handler with AbortController + monotonic requestId race guard
  const handleProbeCoordinate = useCallback(async (lat: number, lon: number) => {
    probeAbortRef.current?.abort();
    // A probe supersedes any curated-site refresh still in flight
    siteRefreshAbortRef.current?.abort();
    const controller = new AbortController();
    probeAbortRef.current = controller;
    const reqId = ++probeRequestIdRef.current;

    setPowerStatus('FETCHING');
    const res = await fetchNasaPowerClimatology(lat, lon, undefined, controller.signal);
    if (controller.signal.aborted || reqId !== probeRequestIdRef.current) {
      return;
    }
    probeAbortRef.current = null;

    applyFetchStatus(res);
    // Never select/score a probe built from the synthetic offline grid
    if (res.status !== 'LIVE_NASA_POWER') return;

    const probeSite = createCustomProbeSite(lat, lon, res);
    setProbedSites((prev) => {
      const filtered = prev.filter((p) => p.id !== probeSite.id);
      return [probeSite, ...filtered].slice(0, 8);
    });
    setSelectedSiteId(probeSite.id);
  }, [applyFetchStatus]);

  const handleSelectSite = useCallback((siteId: string) => {
    if (probeAbortRef.current) {
      probeAbortRef.current.abort();
      probeAbortRef.current = null;
      // Clear the FETCHING state of the cancelled probe; a curated refresh (if any) will set its own
      setPowerStatus(settledStatusRef.current);
    }
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

  // The pitch deck lives in its own browser tab so it never overlaps the working app
  const handleOpenDeck = useCallback(() => {
    const curated = sites.some((s) => s.id === selectedSite.id);
    const query = new URLSearchParams({ target: selectedTarget.id, ...(curated ? { site: selectedSite.id } : {}) });
    const url = `${window.location.pathname}?${query.toString()}#deck`;
    const opened = window.open(url, '_blank');
    if (!opened) setIsDeckOpen(true); // popup blocked: fall back to in-page deck
  }, [selectedSite.id, selectedTarget.id, sites]);

  const handleCloseDeck = useCallback(() => {
    if (isDeckTab) {
      window.close();
      // Tabs not opened by script cannot close themselves: go back to the app instead
      window.location.href = window.location.pathname;
      return;
    }
    setIsDeckOpen(false);
  }, [isDeckTab]);

  return (
    <div className="min-h-screen bg-[#efe8d6] text-slate-100 telemetry-grid">
      <div id="app-shell" style={isDeckTab ? { display: 'none' } : undefined}>
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
                HEURISTIC INDEX (RAW 1g -&gt; POST-RIG):{' '}
                <strong>
                  {calibration.uncompensatedFidelityScore}% -&gt; {calibration.calibratedFidelityScore}%
                </strong>
              </span>
            </div>
          </div>

          {/* DISCOVER: Analog Finder regional scan (rows / markers reuse the probe flow) */}
          <AnalogFinderPanel
            selectedTarget={selectedTarget}
            curatedSites={sites}
            selectedSiteId={selectedSite.id}
            onProbeCoordinate={handleProbeCoordinate}
            getEarthViewBbox={getEarthViewBbox}
            onScanDisplayChange={setScanDisplay}
            isProbing={powerStatus === 'FETCHING'}
          />

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
            scanBbox={scanDisplay?.bbox ?? null}
            scanCandidates={scanDisplay?.candidates}
            onEarthBoundsChange={handleEarthBoundsChange}
          />

          {/* Module 2: Traverse Profile Comparison */}
          <TraverseProfiler
            site={selectedSite}
            target={selectedTarget}
            comparison={traverseComparison}
          />

          {/* Module 3: Physics Calibration Lab */}
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
        <footer className="mt-6 border-t border-slate-800/90 bg-[#e8dfcb] px-4 py-4">
          <div className="mx-auto flex max-w-[1640px] flex-col justify-between gap-2 text-xs text-slate-400 md:flex-row md:items-center">
            <div>
              <p className="font-mono text-[11px] font-semibold text-slate-200">
                AETHER-SIM v2.2 | Open-Source Apache 2.0 | NASA Space Apps 2026 Challenge Entry
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Data feeds: NASA POWER (ISA lapse-corrected), ESA Copernicus GLO-90 DEM, NASA GIBS, NASA Moon/Mars Trek, LRO LOLA (118 m/px) and MGS MOLA (463 m/px) global DEMs via USGS Astrogeology. All indices are heuristic screening scores.
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
