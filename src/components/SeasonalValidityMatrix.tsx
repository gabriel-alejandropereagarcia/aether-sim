import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Layers,
  Printer,
  Sparkles,
} from 'lucide-react';
import { EarthAnalogSite, PlanetaryTarget } from '../data/planetaryData';
import {
  SEASONAL_THRESHOLDS,
  SeasonalValidityResult,
  TEST_DISCIPLINES,
  TriadCampaignResult,
} from '../engine/similitudePhysics';

interface SeasonalValidityMatrixProps {
  site: EarthAnalogSite;
  target: PlanetaryTarget;
  seasonal: SeasonalValidityResult;
  triad: TriadCampaignResult;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  protocolMarkdownPreview: string;
}

function scoreColorClass(score: number): string {
  if (score >= SEASONAL_THRESHOLDS.PEAK) {
    return 'bg-emerald-500/25 border-emerald-500/50 text-emerald-200';
  }
  if (score >= SEASONAL_THRESHOLDS.VALID) {
    return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200';
  }
  if (score >= SEASONAL_THRESHOLDS.MARGINAL) {
    return 'bg-amber-500/20 border-amber-500/40 text-amber-200';
  }
  return 'bg-rose-500/25 border-rose-500/50 text-rose-200';
}

export const SeasonalValidityMatrix: React.FC<SeasonalValidityMatrixProps> = ({
  site,
  target,
  seasonal,
  triad,
  onExportMarkdown,
  onExportJson,
  protocolMarkdownPreview,
}) => {
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(
    seasonal.bestSingleMonth.monthIndex,
  );
  const [showBriefPreview, setShowBriefPreview] = useState<boolean>(false);

  useEffect(() => {
    setSelectedMonthIdx(seasonal.bestSingleMonth.monthIndex);
  }, [site.id, target.id, seasonal.bestSingleMonth.monthIndex]);

  const inspectedMonth =
    seasonal.months[selectedMonthIdx] ?? seasonal.bestSingleMonth;

  return (
    <section className="rounded-xl border border-slate-800 bg-[#080e1a]/95 p-4 shadow-xl">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              Module 04
            </span>
            <h2 className="text-sm font-bold tracking-wide text-slate-100 sm:text-base">
              4D Seasonal Validity Matrix &amp; Multi-Site Triad Campaign Optimizer
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            NASA POWER 12-month climatology windowing for{' '}
            <span className="font-mono text-slate-200">{site.name}</span> + TRL 4-&gt;6 Triad Campaign solver.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportMarkdown}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export Brief (.MD)</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span>Export Telemetry (.JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBriefPreview((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs font-medium text-slate-200 transition hover:border-slate-500"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{showBriefPreview ? 'Hide Brief' : 'Preview Brief'}</span>
          </button>
        </div>
      </div>

      {/* Part A: 12-Month Heatmap Matrix */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/85 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>12-MONTH SENSOR &amp; CAMPAIGN VALIDITY MATRIX (CLICK ANY MONTH TO INSPECT)</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="h-2.5 w-2.5 rounded bg-emerald-500/50" /> Peak (&ge;{SEASONAL_THRESHOLDS.PEAK}%)
            </span>
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="h-2.5 w-2.5 rounded bg-cyan-500/40" /> Valid ({SEASONAL_THRESHOLDS.VALID}-{SEASONAL_THRESHOLDS.PEAK - 1}%)
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <span className="h-2.5 w-2.5 rounded bg-amber-500/40" /> Marginal ({SEASONAL_THRESHOLDS.MARGINAL}-{SEASONAL_THRESHOLDS.VALID - 1}%)
            </span>
            <span className="flex items-center gap-1 text-rose-300">
              <span className="h-2.5 w-2.5 rounded bg-rose-500/50" /> Invalid (&lt;{SEASONAL_THRESHOLDS.MARGINAL}%)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3 text-left text-[11px] font-semibold">TEST DISCIPLINE</th>
                {seasonal.months.map((m) => {
                  const isSelected = m.monthIndex === inspectedMonth.monthIndex;
                  return (
                    <th key={m.monthLabel} className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedMonthIdx(m.monthIndex)}
                        className={`w-full rounded px-1.5 py-1 text-[11px] font-bold transition ${
                          isSelected
                            ? 'bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {m.monthLabel}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TEST_DISCIPLINES.map((disc) => (
                <tr key={disc.key} className="border-b border-slate-900/90">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-slate-200">{disc.label}</div>
                    <div className="text-[10px] text-slate-500">{disc.criticalParameters}</div>
                  </td>
                  {seasonal.months.map((m) => {
                    const val = m.disciplineScores[disc.key];
                    const isSelected = m.monthIndex === inspectedMonth.monthIndex;
                    return (
                      <td key={`${disc.key}-${m.monthLabel}`} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedMonthIdx(m.monthIndex)}
                          className={`w-full rounded border py-1.5 text-[11px] font-bold transition ${scoreColorClass(
                            val,
                          )} ${isSelected ? 'ring-1 ring-white/70' : ''}`}
                        >
                          {val}%
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Composite Row */}
              <tr className="bg-slate-900/60">
                <td className="py-2.5 pr-3 font-bold text-cyan-300">COMPOSITE SITE FIDELITY</td>
                {seasonal.months.map((m) => {
                  const isSelected = m.monthIndex === inspectedMonth.monthIndex;
                  return (
                    <td key={`comp-${m.monthLabel}`} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedMonthIdx(m.monthIndex)}
                        className={`w-full rounded border py-1.5 text-xs font-extrabold transition ${scoreColorClass(
                          m.compositeScore,
                        )} ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}
                      >
                        {m.compositeScore}%
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Selected Month Deep Telemetry Strip */}
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-slate-800 bg-slate-900/75 p-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-300">
              <span>{inspectedMonth.monthLabel} CLIMATOLOGY SNAPSHOT</span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] ${scoreColorClass(
                  inspectedMonth.compositeScore,
                )}`}
              >
                {inspectedMonth.compositeScore}% FIDELITY
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              <strong className="text-slate-100">Limiting Factor:</strong>{' '}
              {inspectedMonth.primaryLimitingFactor}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] sm:grid-cols-6 md:col-span-8">
            <div className="rounded bg-slate-950 p-2">
              <div className="text-[10px] text-slate-500">T2M Mean</div>
              <div className="font-bold text-slate-100">{inspectedMonth.t2m} °C</div>
            </div>
            <div className="rounded bg-slate-950 p-2">
              <div className="text-[10px] text-slate-500">T2M Min/Max</div>
              <div className="font-bold text-cyan-300">
                {inspectedMonth.t2mMin}/{inspectedMonth.t2mMax}°
              </div>
            </div>
            <div className="rounded bg-slate-950 p-2">
              <div className="text-[10px] text-slate-500">Precip</div>
              <div className="font-bold text-amber-300">{inspectedMonth.precipMmDay} mm/d</div>
            </div>
            <div className="rounded bg-slate-950 p-2">
              <div className="text-[10px] text-slate-500">Rel Humid</div>
              <div className="font-bold text-slate-100">{inspectedMonth.rhPct}%</div>
            </div>
            <div className="rounded bg-slate-950 p-2">
              <div className="text-[10px] text-slate-500">Solar Sw</div>
              <div className="font-bold text-emerald-300">{inspectedMonth.solarKwhM2Day} kWh</div>
            </div>
            <div className="rounded bg-slate-950 p-2">
              <div className="text-[10px] text-slate-500">GPR Loss</div>
              <div className="font-bold text-rose-300">-{inspectedMonth.dielectricPenaltyPct}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Part B: Multi-Site Triad Campaign Optimizer */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/65 p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-300">
              <Sparkles className="h-4 w-4" />
              <span>OPTIMAL 3-SITE TRIAD CAMPAIGN (TRL 4 -&gt; TRL 6)</span>
            </div>
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
              +{triad.coverageGainPct}% Coverage vs. Single Site
            </span>
          </div>

          <p className="mb-3 text-xs text-slate-300">{triad.trlProgressionSummary}</p>

          <div className="space-y-2.5">
            {[triad.primary, triad.secondary, triad.tertiary].map((assignment, idx) => (
              <div
                key={`${assignment.site.id}-${idx}`}
                className="rounded-md border border-slate-800 bg-slate-950/90 p-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[11px] font-bold text-cyan-300">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-100">
                      {assignment.site.name} ({assignment.site.country})
                    </span>
                  </div>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    Window: {assignment.bestWindowMonths.join(' / ')} ({assignment.meanPeakFidelity}%)
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-amber-300/90">{assignment.role}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {assignment.strengthAxes.map((ax) => (
                    <span
                      key={ax}
                      className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                    >
                      {ax}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5-Axis Coverage Gain Comparison */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/65 p-3.5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-300">
                <Layers className="h-4 w-4" />
                5-AXIS TRL COVERAGE GAIN
              </span>
              <span className="font-mono text-xs text-slate-300">
                {triad.singleSiteCoveragePct}% -&gt;{' '}
                <strong className="text-emerald-400">{triad.triadCompositeCoveragePct}%</strong>
              </span>
            </div>

            <div className="space-y-3">
              {triad.axisCoverage.map((row) => (
                <div key={row.axis} className="font-mono text-[11px]">
                  <div className="flex justify-between text-slate-300">
                    <span>
                      {row.axis} <span className="text-slate-500">({row.weight}% wt)</span>
                    </span>
                    <span>
                      <span className="text-slate-400">{row.singleSiteScore}%</span> -&gt;{' '}
                      <strong className="text-emerald-300">{row.triadScore}%</strong>
                    </span>
                  </div>
                  <div className="relative mt-1 h-2.5 w-full overflow-hidden rounded bg-slate-800">
                    <div
                      className="absolute left-0 top-0 h-full bg-emerald-500/80 transition-all"
                      style={{ width: `${row.triadScore}%` }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full bg-cyan-400/90 transition-all"
                      style={{ width: `${row.singleSiteScore}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">Lead: {row.leadSiteName}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Ready for {target.shortName} Campaign Brief
            </span>
            <button
              type="button"
              onClick={onExportMarkdown}
              className="flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-300 underline hover:text-emerald-200"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Printable Mission Protocol Preview */}
      {showBriefPreview && (
        <div className="mt-4 rounded-lg border border-cyan-500/40 bg-slate-950 p-4">
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-cyan-300">
              PRINTABLE NASA FIELD TEST &amp; CALIBRATION BRIEF PREVIEW
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded bg-cyan-500/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/30"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
            {protocolMarkdownPreview}
          </pre>
        </div>
      )}
    </section>
  );
};
