# AETHER-SIM v2.1 — Planetary Analog Similitude, 4D Window & Traverse Twinning Engine

**NASA Space Apps Challenge 2026** | Challenge: *"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"*  
**License:** Apache License 2.0

`AETHER-SIM` is a hackathon engineering MVP that turns planetary analog selection into quantitative similitude calibration, 1:1 traverse comparison, and 4D seasonal window planning for Moon and Mars missions.

---

## Key Capabilities & Data Provenance

1. **Module 1 — Dual Planetary Command Map & Live NASA POWER + Copernicus DEM Probe**
   - Synchronized **Earth Analog Map** (Esri Dark Gray Canvas + NASA GIBS WMTS: *Blue Marble Shaded Relief*, *MODIS Land Surface Temp Day*, *ASTER GDEM Shaded Relief*) and **Moon / Mars Target Map** (NASA Moon Trek `LRO_WAC_Mosaic_Global_303ppd_v02` and Mars Trek `Mars_Viking_MDIM21_ClrMosaic_global_232m`, geodesic ellipses scaled by true lunar/Martian radii).
   - **Verified Earth Telemetry + ISA Lapse-Rate Correction:** Baseline 12-month climatologies and 21-point 2.0 km traverses for all 10 Earth sites are fetched from **NASA POWER** and **ESA Copernicus DEM GLO-90** (`scripts/fetchVerifiedEarthData.mjs` -> `src/data/verifiedEarthTelemetry.json`), with $-6.5^\circ\text{C/km}$ tropospheric lapse-rate and hypsometric barometric correction reconciling `0.5°` weather grid elevation against local DEM elevation.
   - **Click-Anywhere Live Probe Mode:** Clicking any Earth coordinate queries NASA POWER and Copernicus DEM in parallel (with `AbortController` race cancellation) and retains probed coordinates in the site selector.

2. **Module 2 — 1:1 Geometric Traverse Twinning Profiler**
   - Compares real 21-point **2.0 km Copernicus GLO-90 DEM Earth transects** against 2.0 km planetary traverses parameterized from published mission sections (LOLA, LROC NAC, Perseverance Hawksbill Gap, Curiosity Mount Sharp, SHARAD/MOLA).
   - Computes elevation gain, maximum slope, RMSE, rover energy (`Wh/km`), and **Pandolf et al. (1977)** + **Santee et al. (2001)** partial-gravity crew EVA metabolic cost (`kcal/hr`).

3. **Module 3 — The "Earth-Lie" Physics Similitude & Hardware Calibration Lab**
   - Configures hardware (`Rover / Mobility`, `Cryo-Drill / ISRU`, `Spacesuit EVA`, `GPR / Spectral Sensor`) by mass ($5\text{–}1,000\text{ kg}$), thermal power ($10\text{–}2,000\text{ W}$), contact area ($10\text{–}2,500\text{ cm}^2$), and wheel/contact width $b$ ($4\text{–}80\text{ cm}$).
   - Computes **WGS84 + Free-Air Gravity Offloading**, **Bekker-Wong Wheel Sinkage ($z_0$)**, **McAdams (1954) Convective Cooling Bias**, residual-based similitude fidelity scores, and 4 explicit unmitigable terrestrial limitations requiring chamber co-tests.

4. **Module 4 — 4D Seasonal Validity Matrix & Hardware-Weighted Triad Optimizer**
   - Generates a **12-Month × 5-Discipline Heatmap** under unified thresholds (`>=82%` Peak, `68–81%` Valid, `52–67%` Marginal, `<52%` Invalid).
   - Solves for a hardware-weighted **3-Site Triad Campaign** (TRL 4 $\rightarrow$ TRL 6) and exports `.md`, `.json`, and printable Field Protocols.

---

## Tech Stack & Scope Notes
- **Frontend:** React 18, TypeScript (strict), Vite, Tailwind CSS, Leaflet, Vitest
- **Connectivity:** Physics calculations, unit tests, and the 10-site verified baseline dataset run locally offline; interactive map tile layers (GIBS, Esri, Moon/Mars Trek) and live custom coordinate probing require network access.

---

## Local Development, Data Refresh & Verification

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

To refresh the verified Earth telemetry baseline from live NASA POWER and Copernicus DEM GLO-90 APIs:
```bash
node scripts/fetchVerifiedEarthData.mjs
```

---

## Submission Package
Copy-ready submission fields, DOIs, and transparency notes are located in [`NASA_SUBMISSION_READY.md`](./NASA_SUBMISSION_READY.md).
