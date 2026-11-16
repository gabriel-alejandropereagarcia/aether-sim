# NASA Space Apps 2026 - Submission Copy Blocks (AETHER-SIM)

Team: ArgentinaSpace. Local event: NASA Space Apps Salta 2026 (Argentina), Nov 14-15, 2026.
Each block below is plain text, ready to paste into the project form. Edit the bracketed items.

Challenge addressed: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars".
AETHER-SIM answers it directly: it screens a region for Earth terrain that resembles a chosen Moon or Mars target, flags candidates far from known analogs as NEW, and characterizes any candidate for field-test planning.


## 1. PROJECT NAME

AETHER-SIM: Earth Analog Finder for Moon and Mars


## 2. HIGH-LEVEL SUMMARY (about 120 words)

AETHER-SIM identifies new Earth locations that could serve as analogs for Moon and Mars surface missions. Its Analog Finder scans a region grid, starting with the Puna de Atacama in Salta and Catamarca, Argentina, using live NASA POWER climatology and the Copernicus GLO-90 elevation model. Each cell receives a transparent, heuristic Analog Similarity Index against the chosen Moon or Mars target. Candidates far from any catalogued analog are flagged NEW and sent with one click into a characterization workflow: 2 km traverse comparison, a 12-month seasonal window matrix, first-order physics calibration (gravity offload, wheel sinkage, convective bias), and a 3-site campaign plan exported as Markdown or JSON. It is a screening tool, open source, and runs in the browser.


## 3. LINK TO PROJECT DEMO

https://gabriel-alejandropereagarcia.github.io/aether-sim/

(If the form asks for a video, use the 30-second demo from section 10.)


## 4. LINK TO FINAL PROJECT (CODE REPOSITORY)

https://github.com/gabriel-alejandropereagarcia/aether-sim


## 5. DETAILED DESCRIPTION

What it does
The challenge asks for new, better-characterized Earth analogs of Moon and Mars sites. AETHER-SIM has two parts. First, the Analog Finder searches a region for candidates. Presets cover the Puna de Atacama (NW Argentina, our home region), the Atacama in Chile, the Bolivian Altiplano and Iceland; it can also scan the current map view. A bundled Puna snapshot loads instantly, and "Re-scan live" refreshes it from the data services. Second, a characterization workbench lets you study any candidate, any of 10 curated sites (including Llullaillaco, Salar de Arizaro and Campo de Piedra Pomez in the Argentine Puna), or any clicked coordinate.

How it works
For every grid cell the app pulls NASA POWER climatology (temperature, humidity, precipitation, pressure, insolation) and Copernicus GLO-90 elevation and slope via Open-Meteo. Climatology is corrected to DEM elevation with a standard-atmosphere lapse rate. The Analog Similarity Index combines six factors with transparent, hand-chosen weights that depend on the Moon or Mars target: low pressure, thermal proximity, aridity, diurnal thermal swing, insolation, and terrain slope match. Cells are ranked, and any candidate more than 60 km from a catalogued analog is marked NEW. The index is a heuristic screening tool. It is not validated against field campaigns.

Characterization of a chosen site includes:
- Dual map: Earth (NASA GIBS layers) beside the Moon or Mars target (NASA Moon Trek / Mars Trek).
- 2 km traverse comparison: real Copernicus DEM transect against a real planetary profile sampled from the LRO LOLA (118 m/px) or MGS MOLA (463 m/px) global DEM (elevation gain, maximum slope, roughness, rover energy per km).
- 12-month seasonal validity matrix for five disciplines (GPR, cryo-drilling, rover traction, EVA, optical/LiDAR).
- Physics calibration lab with first-order models: local gravity offload, Bekker-Wong sinkage, convective heat bias.
- 3-site campaign optimizer and Markdown/JSON test protocol export.

Benefits
- Widens the search beyond the few famous analog sites, with a short, ranked, reproducible list.
- Makes the reasoning visible: every weight and input is shown, and every data source is named.
- Moves from "where" to "how to test there" in one tool, with no install needed.
- Highlights high-altitude terrain close to our own community in Salta and Catamarca.

What we hope to achieve
A starting point that field scientists and student teams can use to shortlist analog candidates, then verify them on the ground. Next steps: compare the index with expert analog lists and field data, ingest LOLA/MOLA profiles directly, add geology layers, and extend scans to caves, lava tubes and polar terrain.

Limitations
Heuristic index with hand-chosen weights, not validated by field work. NASA POWER is a coarse reanalysis grid and GLO-90 is about 90 m resolution. Planetary traverses are sampled from global DEMs (LRO LOLA 118 m/px, MGS MOLA 463 m/px); on Mars a 2 km line spans only 4-5 native pixels, so slopes are coarse. Roughness along planetary traverses is a literature-based estimate. Radiation, dust charging and vacuum effects cannot be reproduced by the physics lab and need chamber testing. No endorsement by NASA, CONAE, ESA or any agency.

Tools and languages
TypeScript, React 18, Vite, Tailwind CSS, Leaflet, Vitest. Runs entirely in the browser; hosted on GitHub Pages. License: Apache 2.0.


## 6. NASA DATA USED

1. NASA POWER (Prediction Of Worldwide Energy Resources), climatology point API. Monthly temperature, humidity, precipitation, surface pressure, solar insolation.
   https://power.larc.nasa.gov/
2. NASA GIBS (Global Imagery Browse Services), WMTS layers: Blue Marble Shaded Relief, MODIS Terra Land Surface Temperature (Day), ASTER GDEM Color Shaded Relief.
   https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs
3. NASA Moon Trek (Solar System Treks), LRO WAC global mosaic WMTS layer.
   https://trek.nasa.gov/moon/
4. NASA Mars Trek (Solar System Treks), Viking MDIM 2.1 color mosaic WMTS layer.
   https://trek.nasa.gov/mars/


5. NASA LRO LOLA global lunar DEM (LDEM, 118 m/px, 2014 release) and NASA MGS MOLA MEGDR global Mars DEM (463 m/px), accessed as USGS Astrogeology global mosaics. Used to sample the real 2 km elevation profile of every Moon and Mars target (script: scripts/fetchPlanetaryProfiles.mjs).
   https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif
   https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif

## 7. SPACE AGENCY AND PARTNER DATA USED

1. ESA Copernicus DEM GLO-90 (about 90 m global elevation model), accessed through the Open-Meteo Elevation API. Used for elevation, slope and 2 km traverse transects.
   https://open-meteo.com/en/docs/elevation-api
   https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
2. Esri Dark Gray Canvas base map tiles (map background only).
3. Open-Meteo, as the access layer for the Copernicus DEM.
4. Published literature for planetary reference profiles and targets (see References). CONAE, ESA and JAXA are cited only as literature and mission context; there is no partnership or endorsement.


## 8. REFERENCES

Planetary and engineering references:
1. Zuber, M. T., Head, J. W., Smith, D. E., Neumann, G. A., et al. (2012). Constraints on the volatile distribution within Shackleton crater at the lunar south pole. Nature 486, 378-381. doi:10.1038/nature11216
2. Haruyama, J., Hioki, K., Shirao, M., Morota, T., et al. (2009). Possible lunar lava tube skylight observed by SELENE cameras. Geophysical Research Letters 36, L21206. doi:10.1029/2009GL040635
3. Robinson, M. S., Brylow, S. M., Tschimmel, M., Humm, D., et al. (2010). Lunar Reconnaissance Orbiter Camera (LROC) instrument overview. Space Science Reviews 150, 81-124. doi:10.1007/s11214-010-9634-2
4. Campbell, B. A., Carter, L. M., Hawke, B. R., Campbell, D. B., et al. (2008). Volcanic and impact deposits of the Moon's Aristarchus Plateau: A new view from Earth-based radar images. Geology 36, 135-138. doi:10.1130/G24310A.1
5. Carrier, W. D., Olhoeft, G. R., and Mendell, W. (1991). Physical properties of the lunar surface. In Heiken, Vaniman and French (eds.), Lunar Sourcebook, Cambridge University Press, ch. 9.
6. Vasavada, A. R. (2022). Mission overview and scientific contributions from the Mars Science Laboratory Curiosity rover after eight years of surface operations. Space Science Reviews 218, 14. doi:10.1007/s11214-022-00882-7
7. Wong, J. Y. (2008). Theory of Ground Vehicles, 4th ed. Wiley (Bekker-Wong terramechanics).
8. McAdams, W. H. (1954). Heat Transmission, 3rd ed. McGraw-Hill (convective heat transfer).
9. Pandolf, K. B., Givoni, B., and Goldman, R. F. (1977). Predicting energy expenditure with loads while standing or walking very slowly. Journal of Applied Physiology 43, 577-581. doi:10.1152/jappl.1977.43.4.577
Earth analog literature:
10. Navarro-Gonzalez, R., Rainey, F. A., et al. (2003). Mars-like soils in the Atacama Desert, Chile, and the dry limit of microbial life. Science 302, 1018-1021. doi:10.1126/science.1089143
11. Lee, P., and Osinski, G. R. (2005). The Haughton-Mars Project: Overview of science investigations at the Haughton impact structure and surrounding terrain, Devon Island, High Arctic. Meteoritics and Planetary Science 40, 1755-1758. doi:10.1111/j.1945-5100.2005.tb00144.x
12. Xiao, L., Wang, J., Dang, Y., et al. (2017). A new terrestrial analogue site for Mars research: The Qaidam Basin, Tibetan Plateau (NE Tibet). Earth-Science Reviews 164, 84-101. doi:10.1016/j.earscirev.2016.11.003
13. Amils, R., Fernandez-Remolar, D., and the IPBSL Team (2014). Rio Tinto: A geochemical and mineralogical terrestrial analogue of Mars. Life 4, 511-534. doi:10.3390/life4030511
14. Belilla, J., Moreira, D., Jardillier, L., Reboul, G., et al. (2019). Hyperdiverse archaea near life limits at the polyextreme geothermal Dallol area. Nature Ecology and Evolution 3, 1552-1561. doi:10.1038/s41559-019-1005-0
Data and service pages (see sections 6 and 7):
15. NASA POWER. https://power.larc.nasa.gov/
16. NASA GIBS. https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api
17. NASA Solar System Treks. https://trek.nasa.gov/
18. Open-Meteo Elevation API (Copernicus DEM GLO-90). https://open-meteo.com/en/docs/elevation-api


## 9. USE OF ARTIFICIAL INTELLIGENCE

AI coding assistants were used to help write the TypeScript/React code, the data-fetching scripts and unit tests, and to draft documentation and this text. No AI-generated images, video or audio are used in the project or its demo. No NASA logos, insignia or branding are used. The team reviewed, tested and edited all AI-assisted output, and is responsible for the content. Scientific statements and citations were checked by the team.

[TEAM TODO: check the official Space Apps 2026 rules for the exact required wording of the AI disclosure, and adjust this block to match.]


## 10. 30-SECOND DEMO VIDEO SHOT LIST

0:00-0:04  Title card text: "AETHER-SIM - finding new Earth analogs for the Moon and Mars" and the challenge title. Voiceover: "Which places on Earth look like the Moon or Mars? Many are still uncharacterized."
0:04-0:12  Screen: Analog Finder on the Puna preset, target set to Mars. Show the loaded snapshot, ranked list, and NEW-flagged candidates on the map. Voiceover: "Our Analog Finder scores a region against a Moon or Mars target using NASA POWER and Copernicus elevation data."
0:12-0:18  Screen: click one NEW candidate, the dual Earth/Mars map updates. Voiceover: "One click sends a candidate into characterization."
0:18-0:24  Screen: traverse comparison chart, then the 12-month seasonal matrix. Voiceover: "Compare a 2 km traverse and find the best months to test."
0:24-0:30  Screen: physics lab numbers, Export Protocol click, then end card with the demo URL. Voiceover: "Export a test plan. It is a screening tool, open source, made in Salta."


## 11. PRE-SUBMIT CHECKLIST

1. Open the live demo URL in a private window; confirm the Analog Finder loads the Puna snapshot and the map tiles appear. Also open it with #deck at the end and check the 7 slides.
2. Confirm the GitHub repo is public, the README renders, and the latest push built and deployed (Actions tab green).
3. Re-read all UI text and these blocks for overclaims: no "validated", "verified" (except for data actually fetched from NASA POWER / Copernicus), or agency endorsement.
4. Check the official Space Apps 2026 rules for the AI disclosure wording and any required fields, and update section 9.
5. Confirm no NASA logos or insignia appear in the app, deck, video or repo.
6. Record the 30-second video, check audio, upload it, and test every link in the form from a logged-out browser.
