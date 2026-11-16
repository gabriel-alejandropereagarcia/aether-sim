import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../src/data/verifiedEarthTelemetry.json');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// 10 curated Earth analog sites with representative field-staging coordinates & traverse azimuth (deg clockwise from North)
const SITES = [
  { id: 'llullaillaco', lat: -24.698, lon: -68.572, azimuthDeg: 95 },
  { id: 'arizaro', lat: -25.02, lon: -67.73, azimuthDeg: 90 },
  { id: 'piedra-pomez', lat: -26.55, lon: -67.45, azimuthDeg: 40 },
  { id: 'craters-of-the-moon', lat: 43.42, lon: -113.52, azimuthDeg: 130 },
  { id: 'devon-island', lat: 75.38, lon: -89.68, azimuthDeg: 70 },
  { id: 'atacama-yungay', lat: -24.09, lon: -69.91, azimuthDeg: 35 },
  { id: 'qaidam-dalangtan', lat: 38.5, lon: 91.5, azimuthDeg: 115 },
  { id: 'rio-tinto', lat: 37.7, lon: -6.56, azimuthDeg: 65 },
  { id: 'askja-holuhraun', lat: 64.92, lon: -16.75, azimuthDeg: 25 },
  { id: 'dallol', lat: 14.24, lon: 40.3, azimuthDeg: 100 },
];

function build2KmCoords(lat, lon, azimuthDeg) {
  const rad = (azimuthDeg * Math.PI) / 180;
  const kmPerDegLat = 110.574;
  const kmPerDegLon = Math.max(12, 111.32 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 21 }, (_, idx) => {
    const dKm = idx * 0.1;
    const ptLat = Number((lat + (Math.cos(rad) * dKm) / kmPerDegLat).toFixed(5));
    const ptLon = Number((lon + (Math.sin(rad) * dKm) / kmPerDegLon).toFixed(5));
    return { distanceKm: Number(dKm.toFixed(1)), lat: ptLat, lon: ptLon };
  });
}

async function fetchJsonWithRetry(url, label, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${label}`);
      }
      return await res.json();
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

async function run() {
  const output = {
    generatedAtUtc: new Date().toISOString(),
    sources: {
      nasaPower:
        'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M,RH2M,PS&community=RE',
      copernicusDem: 'https://api.open-meteo.com/v1/elevation (Copernicus DEM GLO-90)',
    },
    sites: {},
  };

  for (const site of SITES) {
    console.log(`Fetching verified NASA POWER + Copernicus GLO-90 DEM for ${site.id}...`);

    const powerUrl =
      `https://power.larc.nasa.gov/api/temporal/climatology/point` +
      `?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS10M,RH2M,PS` +
      `&community=RE&longitude=${site.lon}&latitude=${site.lat}&format=JSON`;

    const coords = build2KmCoords(site.lat, site.lon, site.azimuthDeg);
    const latsParam = coords.map((c) => c.lat).join(',');
    const lonsParam = coords.map((c) => c.lon).join(',');
    const demUrl = `https://api.open-meteo.com/v1/elevation?latitude=${latsParam}&longitude=${lonsParam}`;

    const [powerJson, demJson] = await Promise.all([
      fetchJsonWithRetry(powerUrl, `POWER:${site.id}`),
      fetchJsonWithRetry(demUrl, `DEM:${site.id}`),
    ]);

    const params = powerJson?.properties?.parameter;
    const gridElev = powerJson?.geometry?.coordinates?.[2];
    const demElevations = demJson?.elevation;

    if (!params || typeof gridElev !== 'number' || !Array.isArray(demElevations) || demElevations.length !== 21) {
      throw new Error(`Invalid API response structure for ${site.id}`);
    }

    const rawClimatology = {};
    for (const key of ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS10M', 'RH2M', 'PS']) {
      rawClimatology[key] = MONTHS.map((m) => {
        const val = params[key]?.[m];
        if (typeof val !== 'number' || val <= -900) {
          throw new Error(`Missing or fill value for ${site.id}.${key}.${m}: ${val}`);
        }
        return Number(val.toFixed(2));
      });
    }

    output.sites[site.id] = {
      lat: site.lat,
      lon: site.lon,
      azimuthDeg: site.azimuthDeg,
      powerGridElevationM: Number(gridElev.toFixed(2)),
      demElevationM: Number(demElevations[0].toFixed(1)),
      rawClimatology,
      traversePoints: coords.map((c, idx) => ({
        distanceKm: c.distanceKm,
        lat: c.lat,
        lon: c.lon,
        elevationM: Number(demElevations[idx].toFixed(1)),
      })),
    };

    console.log(
      `  -> OK: POWER grid elev ${gridElev.toFixed(1)}m | DEM[0]=${demElevations[0]}m..DEM[20]=${demElevations[20]}m | T2M JAN=${rawClimatology.T2M[0]}C`,
    );
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nSaved verified Earth telemetry to ${OUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
