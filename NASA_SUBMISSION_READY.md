# NASA SPACE APPS CHALLENGE 2026 — SUBMISSION PACKAGE
**Status:** Verified Engineering MVP (All Data Provenance Tagged)  
**License:** Apache License 2.0  
**Language:** 100% English

---

## 1. PROJECT NAME
`AETHER-SIM: Planetary Analog Similitude, 4D Window & Traverse Twinning Engine`

---

## 2. HIGH-LEVEL PROJECT SUMMARY (Under 150 Words — Copy-Paste Ready)
> *Word count: 121 words*

`AETHER-SIM` is an aerospace engineering MVP that reframes terrestrial planetary analog selection from static map pins into quantitative, physics-calibrated test planning for Moon and Mars surface missions. Combining live **NASA POWER** climatology (adjusted via International Standard Atmosphere lapse-rate and hypsometric equations to actual **ESA Copernicus GLO-90 DEM** elevations), **NASA GIBS** layers, **NASA Moon/Mars Trek** orbital imagery, and published mission literature, `AETHER-SIM` delivers four capabilities: (1) **Earth-Lie Similitude Calibration**, computing gravitational offloading, Bekker-Wong wheel sinkage compensation, and McAdams convective heat loss; (2) **1:1 Traverse Twinning** comparing real 2.0 km Copernicus DEM transects against literature-parameterized Artemis, Perseverance, and Curiosity profiles; (3) **4D Seasonal Sensor Windows** derived from monthly climatology; and (4) **Hardware-Weighted Triad Optimization** to plan TRL 4-to-6 field campaigns with downloadable protocols.

---

## 3. DETAILED PROJECT DESCRIPTION (Copy-Paste Ready)

### Problem Statement: Why Static Analog Maps Mislead Flight Teams
Conventional analog catalogs place static markers on arid regions and report heuristic similarity scores. Planetary test campaigns face three concrete engineering pitfalls:
1. **The "Earth-Lie" Physics Distortion:** Testing flight hardware under Earth gravity ($9.81\text{ m/s}^2$) rather than Lunar ($1.62\text{ m/s}^2$) or Martian ($3.721\text{ m/s}^2$) gravity scales normal ground pressure and induces multi-fold **Bekker-Wong wheel sinkage errors**. Simultaneously, convective terrestrial airflow extracts parasitic heat absent in lunar vacuum ($0\text{ Pa}$) or thin Martian $\text{CO}_2$ ($610\text{–}730\text{ Pa}$).
2. **Coarse Weather Grid Bias & 4D Temporal Decay:** Reanalysis grids like NASA POWER ($0.5^\circ \times 0.625^\circ$) average terrain height across mountainous cells (e.g., returning $3,598\text{ m}$ at Volcán Llullaillaco vs. $5,093\text{ m}$ DEM apron, or $+1,063\text{ m}$ escarpment average at Dallol vs. $-93\text{ m}$ basin floor). Furthermore, seasonal monsoon precipitation degrades Ground Penetrating Radar (GPR) dielectric contrast, invalidating sites during wet months.
3. **The Single-Site Blind Spot:** No single terrestrial location simultaneously replicates planetary geomorphology, regolith mechanics, hypobaric thermal dynamics, geochemistry, and astrobiology.

### Solution Architecture & Data Provenance Transparency
Built with **React 18, TypeScript, Vite, Tailwind CSS, and Leaflet Dual Synchronized Maps**, `AETHER-SIM` separates measured satellite feeds from parameterized engineering baselines:

1. **Module 1 — Dual Planetary Command Map & Live NASA POWER + Copernicus DEM Probe:**
   - **Left Map (Earth):** Combines Esri Dark Gray Canvas and **NASA GIBS WMTS** layers (*Blue Marble Shaded Relief*, *MODIS Land Surface Temperature Day*, *ASTER GDEM Shaded Relief*). All 10 pre-loaded analog sites carry **verified NASA POWER 12-month climatology** and **real 21-point 2.0 km ESA Copernicus GLO-90 DEM coordinates & elevations**, corrected from grid-cell altitude to site DEM altitude via ISA tropospheric lapse-rate ($-6.5^\circ\text{C/km}$) and hypsometric barometric scaling. Clicking anywhere on Earth executes live parallel queries to **NASA POWER** and **Copernicus GLO-90 DEM** (with `AbortController` cancellation for rapid clicks).
   - **Right Map (Moon / Mars):** Displays **NASA Moon Trek** (`LRO_WAC_Mosaic_Global_303ppd_v02`) and **Mars Trek** (`Mars_Viking_MDIM21_ClrMosaic_global_232m`) WMTS layers in `EPSG:4326`, drawing landing ellipses and 2.0 km traverses scaled by true planetary radii ($1,737.4\text{ km}$ Moon, $3,389.5\text{ km}$ Mars) with explicit polar-projection warnings above $80^\circ$ latitude.

2. **Module 2 — 1:1 Geometric Traverse Twinning Profiler:**
   - Compares real 21-point **2.0 km Copernicus GLO-90 DEM Earth transects** against 2.0 km Moon/Mars target traverses parameterized from published peer-reviewed mission altimetry/stratigraphic sections (because NASA Treks do not expose a public REST DEM-profile API).
   - Computes elevation gain, maximum slope ($\theta_{\max}$), topographic RMSE, rover mobility energy ($\text{Wh/km}$), and **Pandolf et al. (1977)** + **Santee et al. (2001)** partial-gravity crew EVA metabolic expenditure ($\text{kcal/hr}$).

3. **Module 3 — The "Earth-Lie" Physics Similitude & Hardware Calibration Lab:**
   - Configures hardware (`Rover / Mobility`, `Cryo-Drill / ISRU`, `Spacesuit EVA`, `GPR / Spectral Sensor`) by mass ($5\text{–}1,000\text{ kg}$), thermal dissipation ($10\text{–}2,000\text{ W}$), contact area ($10\text{–}2,500\text{ cm}^2$), and wheel/contact width $b$ ($4\text{–}80\text{ cm}$).
   - **Gravitational Offloading:** Uses WGS84 Somigliana + free-air local gravity $g(\phi, h)$ to output counterweight mass ($\text{kg}$) and gimbal lift force ($\text{N}$).
   - **Bekker-Wong Sinkage Compensation:** Solves $z_0 = \left(\frac{W/A}{k_c/b + k_\phi}\right)^{1/n}$ using baseline regolith moduli from Carrier et al. (1991, *Lunar Sourcebook*) and Wong (2008).
   - **McAdams (1954) Convective Bias ($\Delta Q_{\text{conv}}$):** Scales flat-plate convection by ideal-gas atmospheric density ratio $(\rho/\rho_0)^{0.6}$ and linearized radiative-convective surface $\Delta T$, outputting MLI shroud $R$-values and heater compensation watts.
   - **Residual Fidelity & Unmitigable Limitations:** Scores field fidelity strictly from physical residuals (zero fixed offsets) and flags unmitigable GCR/SPE radiation, electrostatic dust, UHV cold-welding, and micrometeoroids requiring chamber co-tests.

4. **Module 4 — 4D Seasonal Validity Matrix & Hardware-Weighted Triad Exporter:**
   - Evaluates monthly validity across 5 disciplines under unified engineering thresholds (`>=82%` Peak, `68-81%` Valid, `52-67%` Marginal, `<52%` Invalid).
   - Solves a **hardware-weighted 3-Site Triad Campaign** (TRL 4 $\rightarrow$ TRL 6) and exports `.md`, `.json`, and printable Field Test Protocols.

---

## 4. NASA DATA & SPACE AGENCY PARTNER DATA USED (Explicit Citations)

### Live APIs & Raster Tile Services Integrated in Code
1. **NASA Langley Research Center (LaRC) POWER API (Climatology Point Service):**  
   - Endpoint: `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M,RH2M,PS&community=RE`  
   - URL: https://power.larc.nasa.gov/  
2. **ESA Copernicus DEM GLO-90 (via Open-Meteo Elevation API):**  
   - Endpoint: `https://api.open-meteo.com/v1/elevation`  
   - URL: https://open-meteo.com/en/docs/elevation-api  
3. **NASA EOSDIS Global Imagery Browse Services (GIBS) WMTS:**  
   - Layers: `BlueMarble_ShadedRelief_Bathymetry`, `MODIS_Terra_Land_Surface_Temp_Day`, `ASTER_GDEM_Color_Shaded_Relief`  
   - URL: https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs  
4. **NASA Solar System Treks (Moon Trek & Mars Trek WMTS):**  
   - Layers: `LRO_WAC_Mosaic_Global_303ppd_v02` (https://trek.nasa.gov/moon/) and `Mars_Viking_MDIM21_ClrMosaic_global_232m` (https://trek.nasa.gov/mars/)  

### Peer-Reviewed Planetary & Partner Literature Referenced
5. **Moon Targets:** Zuber et al. (2012, *Nature* 486:378, `doi:10.1038/nature11216`); Haruyama et al. (2009, *GRL* 36:L21206, `doi:10.1029/2009GL040635`); Robinson et al. (2012, *PSS* 69:18); Campbell et al. (2008, *Geology* 36:135, `doi:10.1130/G24310A.1`); Carrier et al. (1991, *Lunar Sourcebook* Ch. 9).
6. **Mars Targets:** Stack et al. (2020, *SSR* 216:127); Mangold et al. (2021, *Science* 374:abj4325, `doi:10.1126/science.abj4325`); Piqueux et al. (2019, *GRL* 46:14290, `doi:10.1029/2019GL083947`); Vasavada (2022, *SSR* 218:14, `doi:10.1007/s11214-022-00882-7`).
7. **Earth Analog & Partner Literature:** CONAE SAOCOM 1A/1B L-Band SAR (1.275 GHz, https://www.argentina.gob.ar/ciencia/conae); Lynch et al. (2019, *Astrobiology* — Llullaillaco); de Silva et al. (2010, *JGR* — Campo de Piedra Pómez); Lee & Osinski (2005, *MAPS* — Devon Island); Navarro-González et al. (2003, *Science* 302:1018 — Atacama Yungay); Xiao et al. (2017, *Earth-Sci. Rev.* 164:84 — Qaidam Basin); Amils et al. (2014, *Life* — Río Tinto); Belilla et al. (2019, *Nat. Ecol. Evol.* `doi:10.1038/s41559-019-1005-0` — Dallol).

---

## 5. AI ASSISTANCE & COMPLIANCE NOTICE (Review Before Final Submission)
> [!NOTE]
> **Action Required by Human Team Before Submitting:** Review the official NASA Space Apps Challenge 2026 rules page for the exact wording required for AI/SI disclosure, verify all outputs in the running app, and confirm team attribution.

- **AI Assistance Disclosure:** AI coding assistants were used to help write TypeScript/React UI components, build the data acquisition script (`scripts/fetchVerifiedEarthData.mjs`), structure unit tests, and draft technical documentation.
- **Data Scope & Limitations:** All 10 terrestrial baseline climatologies and 2.0 km elevation transects are verified outputs from NASA POWER and ESA Copernicus DEM GLO-90 stored in `src/data/verifiedEarthTelemetry.json`. Planetary 2.0 km traverse curves are parameterized from published elevation/slope literature ranges rather than raw PDS GeoTIFF raster extracts and are explicitly tagged as parameterized in the data model and UI. Interactive map tiles require internet connectivity; cached baseline calculations and the physics kernel run locally.
- **NASA Brand & Logo Compliance:** Zero official NASA logos, NASA insignias, Artemis emblems, or agency seals are used or altered anywhere in this repository.
