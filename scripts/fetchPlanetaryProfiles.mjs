#!/usr/bin/env node
/**
 * Bakes real LOLA (Moon) / MOLA (Mars) elevations along the 2.0 km AETHER-SIM planetary traverses.
 *
 * Source: USGS Astrogeology Science Center global DEM GeoTIFFs (public, no auth, HTTP Range requests):
 *   Mars: Mars_MGS_MOLA_DEM_mosaic_global_463m.tif (MOLA MEGDR, 463.09 m/px, int16 meters, 46080x23040)
 *   Moon: Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif (LOLA LDEM, 118.45 m/px, int16 x 0.5 m, 92160x46080)
 * Only the few pixels needed are downloaded (no full-file download). Bilinear interpolation.
 *
 * Geometry mirrors buildPlanetaryTraverseLatLngs() in src/components/DualPlanetaryMap.tsx
 * (azimuth 62 deg, 100 m steps, body radius, polar longitude floor).
 *
 * Usage: node scripts/fetchPlanetaryProfiles.mjs   (Node 18+, no dependencies)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const S3 = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic';
const DEMS = {
  MARS: {
    name: 'MGS MOLA MEGDR global DEM mosaic (USGS Astrogeology)',
    url: `${S3}/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`,
    pageUrl: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m',
    nativePixelM: 463.09,
    valueScale: 1,
    radiusM: 3396190,
    reference: 'meters relative to the MOLA areoid (radius 3,396,190 m)',
  },
  MOON: {
    name: 'LRO LOLA global LDEM 118 m (Mar 2014, USGS Astrogeology)',
    url: `${S3}/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif`,
    pageUrl: 'https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m',
    nativePixelM: 118.45,
    valueScale: 0.5,
    radiusM: 1737400,
    reference: 'meters relative to the 1,737,400 m lunar reference sphere',
  },
};

const TARGETS = [
  { id: 'moon-shackleton', body: 'MOON', radiusKm: 1737.4, lat: -89.45, lon: -137.31 },
  { id: 'moon-marius', body: 'MOON', radiusKm: 1737.4, lat: 14.09, lon: -56.77 },
  { id: 'moon-aristarchus', body: 'MOON', radiusKm: 1737.4, lat: 24.01, lon: -51.4 },
  { id: 'mars-jezero', body: 'MARS', radiusKm: 3389.5, lat: 18.44, lon: 77.45 },
  { id: 'mars-arcadia', body: 'MARS', radiusKm: 3389.5, lat: 39.2, lon: -172.0 },
  { id: 'mars-gale', body: 'MARS', radiusKm: 3389.5, lat: -4.8, lon: 137.4 },
];

function traverseLatLngs(lat, lon, radiusKm, azimuthDeg = 62) {
  const rad = (azimuthDeg * Math.PI) / 180;
  const kmPerDegLat = (Math.PI * radiusKm) / 180;
  const kmPerDegLon = Math.max(kmPerDegLat * 0.12, kmPerDegLat * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 21 }, (_, idx) => {
    const distKm = idx * 0.1;
    const dLat = (Math.cos(rad) * distKm) / kmPerDegLat;
    const dLon = (Math.sin(rad) * distKm) / kmPerDegLon;
    return {
      distanceKm: Number(distKm.toFixed(1)),
      lat: Math.max(-89.9, Math.min(89.9, lat + dLat)),
      lon: lon + dLon,
    };
  });
}

const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8, 17: 8, 18: 8 };

async function range(url, a, b) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } });
      if (r.status !== 206 && r.status !== 200) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  return Buffer.alloc(0);
}

async function openTiff(url) {
  const head = await range(url, 0, 15);
  const big = head.readUInt16LE(2) === 43;
  const total = Number((await fetch(url, { method: 'HEAD' })).headers.get('content-length'));
  const ifdOff = big ? Number(head.readBigUInt64LE(8)) : head.readUInt32LE(4);
  const ifd = await range(url, ifdOff, Math.min(total - 1, ifdOff + (2 << 20)));
  const n = big ? Number(ifd.readBigUInt64LE(0)) : ifd.readUInt16LE(0);
  const es = big ? 20 : 12;
  const base = big ? 8 : 2;
  const tags = {};
  const rd = (buf, o, t) =>
    t === 3
      ? buf.readUInt16LE(o)
      : t === 4
        ? buf.readUInt32LE(o)
        : t === 16
          ? Number(buf.readBigUInt64LE(o))
          : t === 12
            ? buf.readDoubleLE(o)
            : t === 11
              ? buf.readFloatLE(o)
              : buf[o];
  for (let i = 0; i < n; i++) {
    const p = base + i * es;
    const tag = ifd.readUInt16LE(p);
    const type = ifd.readUInt16LE(p + 2);
    const cnt = big ? Number(ifd.readBigUInt64LE(p + 4)) : ifd.readUInt32LE(p + 4);
    if (![256, 257, 258, 259, 273, 278, 33550, 33922].includes(tag)) continue;
    const vo = big ? p + 12 : p + 8;
    const bytes = cnt * (SZ[type] || 1);
    let buf;
    let o;
    if (bytes <= (big ? 8 : 4)) {
      buf = ifd;
      o = vo;
    } else {
      const off = big ? Number(ifd.readBigUInt64LE(vo)) : ifd.readUInt32LE(vo);
      if (off >= ifdOff && off + bytes <= ifdOff + ifd.length) {
        buf = ifd;
        o = off - ifdOff;
      } else {
        buf = await range(url, off, off + bytes - 1);
        o = 0;
      }
    }
    const vals = [];
    for (let k = 0; k < cnt; k++) vals.push(rd(buf, o + k * SZ[type], type));
    tags[tag] = vals;
  }
  if (tags[259][0] !== 1 || tags[258][0] !== 16 || tags[278][0] !== 1) {
    throw new Error('Unexpected TIFF layout (need uncompressed int16, 1 row per strip)');
  }
  return {
    url,
    width: tags[256][0],
    height: tags[257][0],
    offsets: tags[273],
    pixelM: tags[33550][0],
    x0: tags[33922][3],
    y0: tags[33922][4],
    nodata: -32768,
  };
}

const pixelCache = new Map();
async function readPixel(tiff, row, col) {
  const key = `${tiff.url}|${row}|${col}`;
  if (pixelCache.has(key)) return pixelCache.get(key);
  const start = tiff.offsets[row] + col * 2;
  const buf = await range(tiff.url, start, start + 1);
  const v = buf.readInt16LE(0);
  pixelCache.set(key, v);
  return v;
}

async function sample(tiff, dem, lat, lon) {
  const x = dem.radiusM * ((lon * Math.PI) / 180);
  const y = dem.radiusM * ((lat * Math.PI) / 180);
  // GeoTIFF tie-point is the pixel-area corner, so pixel centres sit at +0.5
  const cf = (x - tiff.x0) / tiff.pixelM - 0.5;
  const rf = (tiff.y0 - y) / tiff.pixelM - 0.5;
  const c0 = Math.floor(cf);
  const r0 = Math.floor(rf);
  const fc = cf - c0;
  const fr = rf - r0;
  const wrap = (c) => ((c % tiff.width) + tiff.width) % tiff.width;
  const clampRow = (r) => Math.max(0, Math.min(tiff.height - 1, r));
  const rows = [clampRow(r0), clampRow(r0 + 1)];
  const cols = [wrap(c0), wrap(c0 + 1)];
  const v = [];
  for (const r of rows) {
    const rowVals = [];
    for (const c of cols) rowVals.push(await readPixel(tiff, r, c));
    v.push(rowVals);
  }
  if (v.flat().some((q) => q === tiff.nodata)) throw new Error(`nodata at ${lat},${lon}`);
  const top = v[0][0] * (1 - fc) + v[0][1] * fc;
  const bot = v[1][0] * (1 - fc) + v[1][1] * fc;
  return (top * (1 - fr) + bot * fr) * dem.valueScale;
}

const tiffs = {};
const outTargets = {};
for (const tg of TARGETS) {
  const dem = DEMS[tg.body];
  tiffs[tg.body] ??= await openTiff(dem.url);
  const pts = [];
  for (const p of traverseLatLngs(tg.lat, tg.lon, tg.radiusKm)) {
    const elev = await sample(tiffs[tg.body], dem, p.lat, p.lon);
    pts.push({
      distanceKm: p.distanceKm,
      lat: Number(p.lat.toFixed(6)),
      lon: Number(p.lon.toFixed(6)),
      elevationM: Number(elev.toFixed(1)),
    });
  }
  outTargets[tg.id] = { body: tg.body, points: pts };
  const e = pts.map((p) => p.elevationM);
  console.log(tg.id, 'first', e[0], 'last', e[20], 'min', Math.min(...e), 'max', Math.max(...e));
}

const out = {
  generatedAtUtc: new Date().toISOString(),
  note:
    'Real DEM elevations sampled (bilinear) along each target 2.0 km traverse (azimuth 62 deg, 100 m spacing). ' +
    'The DEMs are coarse relative to the 100 m step: MOLA MEGDR is ~463 m/px so a 2 km line spans only ~4-5 native pixels and adjacent samples are interpolated; ' +
    'LOLA LDEM is ~118 m/px so the 2 km line spans ~17 native pixels. Slopes derived from these profiles are baseline-scale slopes, not meter-scale hazard slopes. ' +
    'Near the lunar south pole the traverse polyline uses the same flat-map longitude floor as the on-map overlay, so the sampled ground track there is a map-geometry convention rather than a true geodesic.',
  sources: {
    MARS: {
      name: DEMS.MARS.name,
      url: DEMS.MARS.url,
      infoUrl: DEMS.MARS.pageUrl,
      pixelSizeM: DEMS.MARS.nativePixelM,
      verticalReference: DEMS.MARS.reference,
      format: 'GeoTIFF int16, accessed with HTTP Range requests',
    },
    MOON: {
      name: DEMS.MOON.name,
      url: DEMS.MOON.url,
      infoUrl: DEMS.MOON.pageUrl,
      pixelSizeM: DEMS.MOON.nativePixelM,
      verticalReference: DEMS.MOON.reference,
      format: 'GeoTIFF int16 (scale 0.5 m), accessed with HTTP Range requests',
    },
  },
  targets: outTargets,
};
const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, '../src/data/verifiedPlanetaryProfiles.json');
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', dest);
