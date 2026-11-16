import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  Printer,
  X,
} from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';
import { SimilitudeCalibrationResult, TriadCampaignResult } from '../engine/similitudePhysics';

interface PitchDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSite: EarthAnalogSite;
  selectedTarget: PlanetaryTarget;
  calibration: SimilitudeCalibrationResult;
  triad: TriadCampaignResult;
}

interface SlideDef {
  number: number;
  tag: string;
  title: string;
  subtitle: string;
  bullets: { heading: string; detail: string }[];
  highlightStat: { value: string; label: string };
  speakerNote: string;
}

export const PitchDeckModal: React.FC<PitchDeckModalProps> = ({
  isOpen,
  onClose,
  selectedSite,
  selectedTarget,
  calibration,
  triad,
}) => {
  const [slideIdx, setSlideIdx] = useState<number>(0);
  const [showNotes, setShowNotes] = useState<boolean>(true);

  const slides: SlideDef[] = useMemo(
    () => [
      {
        number: 1,
        tag: 'SLIDE 01 / 07 // TITLE & VISION',
        title: 'AETHER-SIM: Planetary Analog Similitude, 4D Window & Traverse Twinning Engine',
        subtitle:
          'Transforming static Earth-pin maps into a quantitative aerospace calibration workbench for NASA Artemis Moon & Human Mars readiness.',
        bullets: [
          {
            heading: 'Challenge Solved',
            detail:
              'Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars — solved via physical similitude transfer rather than visual resemblance.',
          },
          {
            heading: 'Operational Paradigm',
            detail:
              'Bridges verified satellite telemetry (NASA POWER + ISA lapse correction, Copernicus GLO-90 DEM, GIBS, Moon/Mars Trek) directly to offloading rigs, thermal shrouds, and EVA traverses.',
          },
          {
            heading: 'Open-Source Mission Readiness',
            detail:
              'Browser-native React + TypeScript engineering workbench with verified baseline datasets and downloadable Field Test Calibration Protocols.',
          },
        ],
        highlightStat: { value: 'TRL 4 -> 6', label: 'Accelerated Field Qualification' },
        speakerNote:
          '0:00-0:05: Hello NASA Space Apps Judges. This is AETHER-SIM — a physical similitude, 4D seasonal window, and 1:1 traverse twinning engine for Moon and Mars analog testing.',
      },
      {
        number: 2,
        tag: 'SLIDE 02 / 07 // THE ENGINEERING GAP',
        title: 'The "Single-Site Fallacy" & The "Earth-Lie" Distortion',
        subtitle:
          'Most analog tools drop static pins on deserts. Real aerospace test campaigns fail when three physical realities are ignored:',
        bullets: [
          {
            heading: '1. The "Earth-Lie" Physics Distortion',
            detail:
              'Testing flight hardware under 9.81 m/s^2 gravity instead of 1.62 m/s^2 (Moon) or 3.72 m/s^2 (Mars) induces multi-fold Bekker-Wong wheel sinkage errors, while Earth air extracts convective heat absent in lunar vacuum.',
          },
          {
            heading: '2. 4D Temporal Decay & Grid Elevation Bias',
            detail:
              'Monsoon moisture ruins Ground Penetrating Radar contrast, and coarse 0.5 deg weather grids misrepresent steep mountain/basin testbeds unless corrected via ISA tropospheric lapse-rate and DEM elevation.',
          },
          {
            heading: '3. Single-Site Blind Spots',
            detail:
              'No terrestrial site replicates 100% of planetary geomorphology, regolith mechanics, hypobaric thermal dynamics, geochemistry, and astrobiology simultaneously.',
          },
        ],
        highlightStat: {
          value: `${calibration.sinkageDistortionRatio}x`,
          label: `Live 1g Sinkage Error (${selectedTarget.body})`,
        },
        speakerNote:
          '0:05-0:10: Static desert pins ignore the Earth-Lie: 1g gravity breaks Bekker-Wong sinkage, Earth air steals convective heat, and coarse weather grids distort mountain and basin sites.',
      },
      {
        number: 3,
        tag: 'SLIDE 03 / 07 // SYSTEM ARCHITECTURE',
        title: 'Multi-Agency Satellite Fusion & Honest Data Provenance',
        subtitle:
          'Every terrestrial profile and climatology curve is sourced from live APIs and peer-reviewed planetary publications.',
        bullets: [
          {
            heading: 'Verified Earth Telemetry + ISA Lapse Correction',
            detail:
              'NASA POWER 12-month climatology is reconciled against real 21-point 2.0 km Copernicus GLO-90 DEM elevations using -6.5 C/km tropospheric lapse-rate and hypsometric pressure scaling.',
          },
          {
            heading: 'Orbital Imagery & Literature-Anchored Planetary Targets',
            detail:
              'NASA GIBS WMTS (Blue Marble, LST, ASTER GDEM) paired with Moon/Mars Trek WMTS scaled by true body radius (1,737.4 km / 3,389.5 km) and target traverses parameterized from published LOLA, NAC, and Perseverance/Curiosity sections.',
          },
          {
            heading: 'Space Agency Context',
            detail:
              'Integrates CONAE SAOCOM 1A/1B L-band SAR penetration context, ESA Sentinel-2 / ExoMars, and JAXA SELENE references.',
          },
        ],
        highlightStat: { value: '10 + 6', label: 'Verified Earth DEMs & Target Citations' },
        speakerNote:
          '0:10-0:15: AETHER-SIM combines NASA POWER with ISA lapse correction, real Copernicus 90m elevation profiles, NASA GIBS, Moon and Mars Trek, and published CONAE, ESA, and JAXA mission references.',
      },
      {
        number: 4,
        tag: 'SLIDE 04 / 07 // MODULE 3: PHYSICS ENGINE',
        title: 'The "Earth-Lie" Similitude & Calibration Engine',
        subtitle: `Live hardware calibration computed for ${selectedSite.name} simulating ${selectedTarget.shortName}:`,
        bullets: [
          {
            heading: 'Gravitational Mass Offloading (WGS84 + Free-Air)',
            detail: `Requires ${calibration.offloadRatioPct}% vertical offload (${calibration.offloadMassKg} kg / ${calibration.offloadForceNewtons} N) at g = ${calibration.earthGravityMs2} m/s^2.`,
          },
          {
            heading: 'Bekker-Wong Sinkage & McAdams Convective Bias',
            detail: `Target sinkage ${calibration.targetSinkageMm} mm vs. ${calibration.earthUncompensatedSinkageMm} mm raw Earth; McAdams convective bias +${calibration.convectiveBiasWm2K} W/m^2K (${calibration.parasiticHeatLossWatts} W loss) mitigated with R = ${calibration.requiredThermalShroudRValue} m^2K/W MLI shroud.`,
          },
          {
            heading: 'Explicit Unmitigable Field Limitations',
            detail:
              'Flags GCR/SPE ionizing radiation, photo-electrostatic levitating dust, UHV cold-welding, and micrometeoroids that require chamber/accelerator co-tests.',
          },
        ],
        highlightStat: {
          value: `${calibration.offloadRatioPct}%`,
          label: `Active Gimbal Offload (${selectedTarget.body})`,
        },
        speakerNote:
          '0:15-0:20: Our Physics Calibration Lab computes exact gimbal offloading, Bekker-Wong wheel sinkage compensation, thermal shroud R-values, and flags unmitigable radiation and vacuum limits.',
      },
      {
        number: 5,
        tag: 'SLIDE 05 / 07 // MODULES 2 & 4',
        title: '1:1 Traverse Twinning & 4D Seasonal Validity Windows',
        subtitle:
          'Rehearsing planetary climbs with Pandolf (1977) EVA energetics and picking valid months per sensor discipline.',
        bullets: [
          {
            heading: '2.0 km DEM-Verified Traverse Twinning',
            detail:
              'Overlays published Moon/Mars 2.0 km target elevation and slope sections against real Copernicus GLO-90 Earth transects, computing rover Wh/km and Santee-scaled Pandolf (1977) EVA kcal/hr.',
          },
          {
            heading: '4D Month-by-Month Sensor Matrix',
            detail:
              'Evaluates 5 mission disciplines (GPR Radar, Cryo-Drilling, Rover Traction, Spacesuit EVA, Optical LiDAR) across Jan-Dec under unified engineering thresholds.',
          },
          {
            heading: 'One-Click TRL Field Protocol Export',
            detail:
              'Outputs formatted Markdown & JSON calibration protocols ready for mission engineering review.',
          },
        ],
        highlightStat: { value: '2.0 km', label: 'Copernicus DEM vs. Mission Section' },
        speakerNote:
          '0:20-0:25: Crews align 2.0 km planetary climbs against real Copernicus DEM Earth transects, check Pandolf EVA metabolic rates, inspect a 12-month heatmap, and export protocols in one click.',
      },
      {
        number: 6,
        tag: 'SLIDE 06 / 07 // LIVE TRIAD CAMPAIGN CASE STUDY',
        title: `Live Triad Campaign: ${selectedSite.name} -> ${selectedTarget.shortName}`,
        subtitle:
          'Hardware-weighted Triad optimization pairing complementary terrestrial analogs to close single-site gaps:',
        bullets: [
          {
            heading: `Phase 1 — ${triad.primary.site.name} (${triad.primary.site.elevationM} m, ${triad.primary.site.pressureMbar} mbar)`,
            detail: `${triad.primary.role}. Optimal window: ${triad.primary.bestWindowMonths.join('/')} (${triad.primary.meanPeakFidelity}% peak).`,
          },
          {
            heading: `Phase 2 — ${triad.secondary.site.name} (${triad.secondary.site.elevationM} m)`,
            detail: `${triad.secondary.role}. Optimal window: ${triad.secondary.bestWindowMonths.join('/')} (${triad.secondary.meanPeakFidelity}% peak).`,
          },
          {
            heading: `Phase 3 — ${triad.tertiary.site.name} (${triad.tertiary.site.elevationM} m)`,
            detail: `Completes end-member testing (${triad.tertiary.bestWindowMonths.join('/')}), lifting weighted 5-axis coverage from ${triad.singleSiteCoveragePct}% to ${triad.triadCompositeCoveragePct}% (+${triad.coverageGainPct} pts).`,
          },
        ],
        highlightStat: {
          value: `${triad.singleSiteCoveragePct}% -> ${triad.triadCompositeCoveragePct}%`,
          label: 'Live Hardware-Weighted 5-Axis Coverage',
        },
        speakerNote:
          '0:25-0:28: Combining complementary terrestrial analogs in our hardware-weighted Triad Optimizer lifts 5-axis mission coverage while scheduling each phase in its optimal seasonal window.',
      },
      {
        number: 7,
        tag: 'SLIDE 07 / 07 // IMPACT & ROADMAP',
        title: 'Impact, Open-Source Apache 2.0 & Artemis/Mars Roadmap',
        subtitle:
          'An extensible calibration standard for NASA centers, commercial CLPS providers, and university rover teams.',
        bullets: [
          {
            heading: 'Immediate Cost & Schedule Impact',
            detail:
              'Prevents failed field deployments caused by wrong seasonal moisture windows, grid-altitude mismatches, or uncalibrated 1g terramechanics.',
          },
          {
            heading: 'Planet-Wide Live Probing',
            detail:
              'Click anywhere on Earth to probe live NASA POWER + Copernicus DEM grids and generate a calibrated field protocol in seconds.',
          },
          {
            heading: 'Next Roadmap Milestones (Apache 2.0)',
            detail:
              'Direct PDS LOLA/MOLA GeoTIFF profile ingestion, ROS2 / Gazebo gravity-offload bridge, and automated Vitest regression verification.',
          },
        ],
        highlightStat: { value: 'Apache 2.0', label: 'Open-Source Aerospace Calibration Tool' },
        speakerNote:
          '0:28-0:30: AETHER-SIM turns real satellite elevation and climatology feeds into calibrated Artemis and Mars field readiness. Thank you.',
      },
    ],
    [selectedSite, selectedTarget, calibration, triad],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        onClose();
      }
      if (ev.key === 'ArrowRight' || ev.key === ' ') {
        ev.preventDefault();
        setSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
      }
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        setSlideIdx((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, slides.length]);

  if (!isOpen) return null;

  const slide = slides[slideIdx];

  const handlePrintDeck = () => {
    document.body.classList.add('printing-deck');
    const cleanup = () => {
      document.body.classList.remove('printing-deck');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 60000);
  };

  return (
    <div
      id="pitch-deck-modal"
      className="fixed inset-0 z-50 flex flex-col bg-[#03060c]/98 text-slate-100 backdrop-blur-md"
    >
      {/* Top Deck Toolbar */}
      <div className="no-print flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-mono text-xs font-bold text-amber-300">
            JUDGE PRESENTATION MODE
          </span>
          <span className="font-mono text-xs text-slate-400">
            Slide <strong className="text-slate-100">{slide.number}</strong> / {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNotes((p) => !p)}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition ${
              showNotes
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            <span>30s Video Script</span>
          </button>

          <button
            type="button"
            onClick={handlePrintDeck}
            className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-200 hover:border-slate-500"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        <div
          id="pitch-deck-card"
          className="telemetry-grid w-full max-w-5xl rounded-2xl border border-slate-800 bg-[#070d18] p-6 shadow-2xl sm:p-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded bg-cyan-500/15 px-3 py-1 font-mono text-xs font-bold tracking-widest text-cyan-300">
              {slide.tag}
            </span>
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-1.5 text-right">
              <div className="font-mono text-lg font-extrabold text-amber-300">
                {slide.highlightStat.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-200/80">
                {slide.highlightStat.label}
              </div>
            </div>
          </div>

          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {slide.title}
          </h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">{slide.subtitle}</p>

          <div className="mt-7 grid grid-cols-1 gap-4">
            {slide.bullets.map((b) => (
              <div
                key={b.heading}
                className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-4"
              >
                <h3 className="font-mono text-sm font-bold text-cyan-300">{b.heading}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">{b.detail}</p>
              </div>
            ))}
          </div>

          {showNotes && (
            <div className="mt-6 rounded-lg border border-emerald-500/35 bg-emerald-950/20 px-4 py-3">
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                Voiceover Script Cue (30-Second Pitch)
              </div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-100">{slide.speakerNote}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Slide Controls */}
      <div className="no-print flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-6 py-3">
        <button
          type="button"
          disabled={slideIdx === 0}
          onClick={() => setSlideIdx((p) => Math.max(0, p - 1))}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-xs font-semibold text-slate-200 transition hover:border-cyan-500 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.number}
              type="button"
              onClick={() => setSlideIdx(idx)}
              aria-label={`Go to slide ${s.number}`}
              className={`h-2.5 rounded-full transition-all ${
                idx === slideIdx ? 'w-8 bg-cyan-400' : 'w-2.5 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={slideIdx === slides.length - 1}
          onClick={() => setSlideIdx((p) => Math.min(slides.length - 1, p + 1))}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 font-mono text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/30 disabled:opacity-40"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
