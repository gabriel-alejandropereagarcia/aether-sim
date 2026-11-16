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
        tag: 'SLIDE 01 / 07 // THE PROBLEM',
        title: 'Earth analogs for the Moon and Mars are not well characterized',
        subtitle:
          'Challenge: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars." Teams test equipment on Earth before flight, but the list of analog sites is short and their characterization is uneven.',
        bullets: [
          {
            heading: 'Known analogs are few and thinly described',
            detail:
              'Atacama, Haughton Crater and Death Valley are the usual answers. Most other candidate terrain has never been screened against Moon or Mars conditions in a consistent way.',
          },
          {
            heading: 'Selection depends on many factors at once',
            detail:
              'Topography, geology, environment and resources all matter, and the open data to compare them (Earth, Moon, Mars) sits in separate portals.',
          },
          {
            heading: 'Our goal',
            detail:
              'Use open NASA and partner data to identify new terrestrial analogs, then characterize any of them well enough to plan a field test.',
          },
        ],
        highlightStat: { value: 'AETHER-SIM', label: 'Analog Finder + Characterization Workbench' },
        speakerNote:
          '0:00-0:20: Teams test rovers, drills and suits on Earth before they fly, but the usual analog sites are a short list and many are not well characterized. The challenge asks us to identify new ones using open Earth, Moon and Mars data. We are ArgentinaSpace, and this is AETHER-SIM.',
      },
      {
        number: 2,
        tag: 'SLIDE 02 / 07 // ANALOG FINDER',
        title: 'Analog Finder: new candidate analogs, starting in our own backyard',
        subtitle:
          'Scan a region grid, rank every cell against the selected Moon or Mars target, and flag candidates far from any catalogued analog.',
        bullets: [
          {
            heading: 'Start with the Puna de Atacama (Salta / Catamarca)',
            detail:
              'A high, dry, volcanic plateau in NW Argentina. Presets also cover the Atacama in Chile, the Bolivian Altiplano and Iceland, or scan the current map view.',
          },
          {
            heading: 'Ranked candidates, with NEW flags',
            detail:
              'Each grid cell gets an Analog Similarity Index. Candidates more than 60 km from any catalogued analog are marked NEW and drawn on the map.',
          },
          {
            heading: 'One click to characterize',
            detail:
              'A bundled Puna scan snapshot loads instantly; "Re-scan live" refreshes it. Any candidate can be sent into the characterization pipeline.',
          },
        ],
        highlightStat: { value: 'NEW', label: 'Candidates >60 km from catalogued analogs' },
        speakerNote:
          '0:20-0:55: The Analog Finder is the core of the project. It scans a region, scores every cell against the Moon or Mars target you pick, ranks the results, and flags candidates that are more than sixty kilometres from any catalogued analog. We start in our backyard, the Puna of Salta and Catamarca, and a saved scan loads instantly so nothing depends on the network. One click sends a candidate into full characterization.',
      },
      {
        number: 3,
        tag: 'SLIDE 03 / 07 // HOW THE INDEX WORKS',
        title: 'A transparent screening index built on open data',
        subtitle:
          'The Analog Similarity Index is a heuristic with hand-chosen, visible weights. It ranks candidates for follow-up; it is not a validated predictor.',
        bullets: [
          {
            heading: 'Six factors, target-dependent weights',
            detail:
              'Low surface pressure, thermal proximity, aridity, diurnal thermal swing, insolation, and terrain slope match. Weights change with the Moon or Mars target.',
          },
          {
            heading: 'NASA POWER climatology + Copernicus GLO-90 DEM',
            detail:
              'Temperature, humidity, precipitation, pressure and insolation come live from NASA POWER. Elevation and slope come from the ESA Copernicus GLO-90 DEM (about 90 m), accessed via Open-Meteo. Climatology is lapse-rate corrected to DEM elevation.',
          },
          {
            heading: 'Context layers: NASA GIBS, Moon Trek, Mars Trek',
            detail:
              'Earth imagery from NASA GIBS and Moon/Mars imagery from NASA Solar System Treks sit side by side. Planetary reference profiles come from LOLA/MOLA-derived literature.',
          },
        ],
        highlightStat: { value: '6 factors', label: 'Transparent heuristic weights' },
        speakerNote:
          '0:55-1:30: The index combines six factors: low pressure, thermal proximity, aridity, day-night temperature swing, insolation and terrain slope. The weights are hand-chosen, visible, and depend on whether the target is the Moon or Mars. It is a screening index, not a validated predictor. Inputs are NASA POWER climatology and the Copernicus ninety-metre elevation model, with NASA GIBS, Moon Trek and Mars Trek for imagery.',
      },
      {
        number: 4,
        tag: 'SLIDE 04 / 07 // CHARACTERIZATION',
        title: 'Traverse twin and seasonal window for any site',
        subtitle: `Characterization shown for ${selectedSite.name} against ${selectedTarget.shortName}. Works for 10 curated sites (including Llullaillaco, Salar de Arizaro and Campo de Piedra Pomez) or any clicked coordinate.`,
        bullets: [
          {
            heading: '2 km traverse comparison',
            detail:
              'Real Copernicus DEM transect on Earth against a real planetary profile sampled from the LRO LOLA (118 m/px) or MGS MOLA (463 m/px) global DEM. Compares elevation gain, maximum slope, roughness (RMSE) and rover energy per km.',
          },
          {
            heading: '12-month seasonal validity matrix',
            detail:
              'NASA POWER climatology with ISA lapse-rate correction, evaluated over five sensor and operations disciplines (GPR, cryo-drilling, rover traction, EVA, optical/LiDAR) to show which months suit a test.',
          },
          {
            heading: 'Dual map view',
            detail:
              'Earth site and Moon/Mars target side by side using NASA GIBS and NASA Moon/Mars Trek layers.',
          },
        ],
        highlightStat: { value: '2.0 km', label: 'Earth DEM vs. planetary reference profile' },
        speakerNote:
          '1:30-2:00: Once a site is chosen, we characterize it. We compare a two kilometre Earth traverse from the Copernicus elevation model against a planetary reference profile, and we build a twelve month matrix from NASA POWER climatology that shows which months suit radar, drilling, rover or suit tests. This works for our curated Puna sites or any coordinate you click.',
      },
      {
        number: 5,
        tag: 'SLIDE 05 / 07 // FROM SITE TO TEST PLAN',
        title: 'Physics calibration and campaign export',
        subtitle: `First-order calibration computed live for ${selectedSite.name} simulating ${selectedTarget.shortName}:`,
        bullets: [
          {
            heading: 'Gravity offload',
            detail: `Requires about ${calibration.offloadRatioPct}% vertical offload (${calibration.offloadMassKg} kg / ${calibration.offloadForceNewtons} N) at local g = ${calibration.earthGravityMs2} m/s^2.`,
          },
          {
            heading: 'Bekker-Wong sinkage and convective bias',
            detail: `Modelled target sinkage ${calibration.targetSinkageMm} mm vs. ${calibration.earthUncompensatedSinkageMm} mm uncompensated on Earth. Convective bias +${calibration.convectiveBiasWm2K} W/m^2K (${calibration.parasiticHeatLossWatts} W) suggests an insulation target of R = ${calibration.requiredThermalShroudRValue} m^2K/W.`,
          },
          {
            heading: 'Campaign optimizer and export',
            detail: `Pairs ${triad.primary.site.name}, ${triad.secondary.site.name} and ${triad.tertiary.site.name} to cover gaps a single site leaves (heuristic coverage ${triad.singleSiteCoveragePct}% to ${triad.triadCompositeCoveragePct}%). Exports a Markdown or JSON test protocol. Radiation, dust charging and vacuum effects still need chamber tests.`,
          },
        ],
        highlightStat: {
          value: `${calibration.sinkageDistortionRatio}x`,
          label: `Modelled 1g sinkage ratio (${selectedTarget.body})`,
        },
        speakerNote:
          '2:00-2:30: A good site is only useful if you can plan a test there. The calibration lab estimates how much weight to offload to mimic Moon or Mars gravity, how wheel sinkage changes, and how much extra heat Earth air steals. These are first-order models. The campaign optimizer then pairs three sites and exports a Markdown or JSON protocol. We are explicit that radiation, dust and vacuum still need chamber tests.',
      },
      {
        number: 6,
        tag: 'SLIDE 06 / 07 // IMPACT & LIMITS',
        title: 'Impact, users, and honest limitations',
        subtitle: 'A screening and planning aid that points teams to places worth a closer look.',
        bullets: [
          {
            heading: 'Who it helps',
            detail:
              'University rover and instrument teams, analog field-campaign planners, and educators who need a short list of Earth sites with open, reproducible justification. Local teams gain visibility of high-altitude terrain close to home.',
          },
          {
            heading: 'Why it matters',
            detail:
              'Open data and a transparent index make it cheap to widen the search for analogs beyond the few famous sites, and to document why a site was chosen.',
          },
          {
            heading: 'Limitations we state up front',
            detail:
              'The index is a heuristic screening tool, not validated against field campaigns. POWER is a coarse reanalysis grid and GLO-90 is about 90 m. Planetary profiles come from global DEMs (LOLA 118 m/px, MOLA 463 m/px), so Mars slopes are coarse. No field validation, and no endorsement by any space agency.',
          },
        ],
        highlightStat: { value: 'Open', label: 'Open data, open code, Apache 2.0' },
        speakerNote:
          '2:30-2:50: Who benefits? University rover and instrument teams, field-campaign planners and educators, who get a short, reproducible list of candidate sites. The limits matter: the index is a heuristic and not validated against field campaigns, the climate grid is coarse, the planetary profiles come from literature, and nothing here is endorsed by any space agency.',
      },
      {
        number: 7,
        tag: 'SLIDE 07 / 07 // WHAT IS NEXT',
        title: 'What is next, and thank you',
        subtitle: 'Team ArgentinaSpace, NASA Space Apps Salta 2026.',
        bullets: [
          {
            heading: 'Ground-truth the index',
            detail:
              'Compare rankings with expert-curated analog lists and with field measurements from partner teams in Salta and Catamarca.',
          },
          {
            heading: 'Richer planetary and Earth data',
            detail:
              'Ingest LOLA and MOLA elevation profiles directly, add geology and mineralogy layers, and extend scans to caves, lava tubes and polar terrain.',
          },
          {
            heading: 'Try it',
            detail:
              'Live demo: gabriel-alejandropereagarcia.github.io/aether-sim. Code: github.com/gabriel-alejandropereagarcia/aether-sim (Apache 2.0).',
          },
        ],
        highlightStat: { value: 'Thank you', label: 'ArgentinaSpace // Salta 2026' },
        speakerNote:
          '2:50-3:00: Next we want to compare the index with expert analog lists and field data, ingest LOLA and MOLA profiles directly, and extend the search to caves and polar terrain. The app and code are open. Thank you from team ArgentinaSpace.',
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
      className="fixed inset-0 z-50 flex flex-col bg-[#efe8d6]/98 text-slate-100 backdrop-blur-md"
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
            <span>3-Min Pitch Notes</span>
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
          className="telemetry-grid w-full max-w-5xl rounded-2xl border border-slate-800 bg-[#f8f3e6] p-6 shadow-2xl sm:p-10"
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

          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
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
                Speaker Notes (about 3 minutes total)
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
