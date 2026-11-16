# AETHER-SIM v2.2: Earth Analog Finder for Moon and Mars

**NASA Space Apps Challenge 2026** | Team ArgentinaSpace | NASA Space Apps Salta 2026
**Challenge:** *"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"*
**Live demo:** https://gabriel-alejandropereagarcia.github.io/aether-sim/ (add `#deck` to the URL for the 7-slide pitch deck)
**License:** Apache License 2.0

AETHER-SIM identifies and characterizes candidate terrestrial analogs for Moon and Mars surface missions using open NASA and Copernicus data. It is a screening and planning tool built for a hackathon; see Limitations.

---

## Analog Finder (headline feature)

- Scans a region grid (default: **Puna de Atacama, Salta/Catamarca, NW Argentina**; presets for the Atacama in Chile, the Bolivian Altiplano and Iceland; or the current map view).
- For each cell it pulls **NASA POWER** climatology and **Copernicus GLO-90** elevation (via Open-Meteo) and computes an **Analog Similarity Index** against the selected Moon or Mars target.
- The index is a **heuristic screening index** with transparent, hand-chosen, target-dependent weights: low pressure, thermal proximity, aridity, diurnal thermal swing, insolation, and terrain slope match.
- Candidates are ranked, drawn on the map, and flagged **NEW** when they are more than 60 km from any catalogued analog.
- A bundled Puna scan snapshot loads instantly; **Re-scan live** refreshes it.
- One click sends a candidate into the characterization pipeline below.

## Characterization pipeline

For any of the 10 curated sites (including Llullaillaco, Salar de Arizaro and Campo de Piedra Pomez in the Argentine Puna), a Finder candidate, or any clicked coordinate:

1. **Dual map:** Earth (NASA GIBS layers) beside the Moon or Mars target (NASA Moon Trek / Mars Trek WMTS).
2. **2 km traverse comparison:** real Copernicus DEM transect on Earth against a real planetary profile sampled from the LRO LOLA (118 m/px) or MGS MOLA (463 m/px) global DEM (elevation gain, maximum slope, RMSE, rover energy, crew EVA energy).
3. **Physics calibration lab (first-order models):** local gravity offload, Bekker-Wong wheel sinkage, McAdams convective bias.
4. **12-month seasonal validity matrix:** NASA POWER climatology with ISA lapse-rate correction across five disciplines.
5. **3-site campaign optimizer** and Markdown/JSON protocol export.
6. **7-slide pitch deck** with speaker notes (about 3 minutes).

---

## Quick start

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # production build to dist/
```

The app is a static site (`base: './'`), so it works under a subpath such as GitHub Pages. A workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `master`.

To refresh the bundled Earth baseline data from the live APIs:

```bash
node scripts/fetchVerifiedEarthData.mjs
```

## Data sources

| Source | Use |
| --- | --- |
| NASA POWER (climatology point API) | Temperature, humidity, precipitation, pressure, insolation |
| NASA GIBS (WMTS) | Earth imagery layers |
| NASA Moon Trek and Mars Trek (WMTS) | Moon and Mars imagery |
| ESA Copernicus DEM GLO-90 via Open-Meteo | Elevation, slope, traverse transects |
| LRO LOLA global LDEM 118 m/px and MGS MOLA MEGDR 463 m/px (USGS Astrogeology mosaics) | Real 2 km planetary elevation profiles (baked by `scripts/fetchPlanetaryProfiles.mjs`) |
| Published literature (terramechanics, roughness, EVA metabolic models) | Regolith parameters and physics models |

"Verified" in this project means only that data were actually fetched from NASA POWER or the Copernicus DEM. Scores are not verified.

## Limitations

- The Analog Similarity Index and all fidelity/validity percentages are heuristic screening indices with hand-chosen weights. They have not been validated against field campaigns.
- NASA POWER is a coarse reanalysis grid; GLO-90 is about 90 m resolution.
- Planetary 2 km traverses are sampled from global DEMs (LOLA 118 m/px, MOLA 463 m/px via USGS Astrogeology). On Mars a 2 km line spans only 4-5 native pixels, so slopes are baseline-scale, not rover-scale. Roughness values along planetary traverses remain literature-based estimates.
- Physics models are first-order. Radiation, electrostatic dust and vacuum effects need chamber testing.
- Map tiles and live probing need network access; the physics code and bundled data run locally.
- No partnership with, or endorsement by, NASA, CONAE, ESA or any agency. No agency logos are used.

## Tech stack

React 18, TypeScript (strict), Vite, Tailwind CSS, Leaflet, Vitest.

## Submission copy

Copy-ready form text is in [`NASA_SUBMISSION_READY.md`](./NASA_SUBMISSION_READY.md).

## AI assistance

AI coding assistants were used to help write code and draft text. The team reviewed the outputs. No AI-generated media is used.

## License

Apache License 2.0. See [`LICENSE`](./LICENSE).
