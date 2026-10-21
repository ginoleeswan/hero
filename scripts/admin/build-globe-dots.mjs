#!/usr/bin/env node
// Builds the land-dot field for the command center's audience globe
// (src/components/admin/health/domains/audience/globeDots.ts).
//
// Samples an equal-area grid over the sphere (DOT_STEP° rows, longitude step
// widened by 1/cos(lat) so dots stay evenly spaced toward the poles), keeps the
// points that fall on land, and tags each with the ISO alpha-2 code of the
// country it sits in. That tag is what lets the globe colour land dots by that
// country's traffic: a dot-matrix choropleth with no polygon rendering at runtime.
// Countries too small to catch a grid point (Singapore, Malta…) get one dot at
// their centroid so they can still light up.
//
// Inputs are fetched (not installed): world-atlas 50m countries + the ISO 3166
// numeric→alpha-2 table. Output is committed; rerun only to change density.
//
//   node scripts/admin/build-globe-dots.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DOT_STEP = 1.4;
const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const ISO =
  'https://cdn.jsdelivr.net/gh/lukes/ISO-3166-Countries-with-Regional-Codes@v10.0/all/all.json';
// Features world-atlas ships without a numeric id.
const BY_NAME = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO' };
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/components/admin/health/domains/audience/globeDots.ts',
);

const [topo, iso] = await Promise.all([ATLAS, ISO].map((u) => fetch(u).then((r) => r.json())));
const alpha2 = new Map(iso.map((c) => [c['country-code'], c['alpha-2']]));

// ── TopoJSON → polygons of [lon, lat] rings ───────────────────────────────────
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});
const ring = (ids) =>
  ids.flatMap((i, k) => {
    const pts = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
    return k === 0 ? pts : pts.slice(1);
  });
const polygonsOf = (g) =>
  g.type === 'Polygon'
    ? [g.arcs.map(ring)]
    : g.type === 'MultiPolygon'
      ? g.arcs.map((p) => p.map(ring))
      : [];

function inRing(lon, lat, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (lon, lat, poly) =>
  inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h));

const countries = topo.objects.countries.geometries
  .map((g) => {
    const code = g.id != null ? alpha2.get(g.id) : BY_NAME[g.properties?.name];
    const polys = polygonsOf(g).map((p) => {
      const lons = p[0].map((q) => q[0]);
      const lats = p[0].map((q) => q[1]);
      return {
        rings: p,
        box: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      };
    });
    return { code, polys };
  })
  .filter((c) => c.code && c.polys.length);

// ── Sample ────────────────────────────────────────────────────────────────────
const dots = new Map(); // code → [[lat, lon, polyIndex]]
for (let lat = -90 + DOT_STEP / 2; lat < 90; lat += DOT_STEP) {
  const lonStep = DOT_STEP / Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
  for (let lon = -180 + lonStep / 2; lon < 180; lon += lonStep) {
    hit: for (const c of countries) {
      for (let pi = 0; pi < c.polys.length; pi++) {
        const { rings, box } = c.polys[pi];
        if (lon < box[0] || lon > box[2] || lat < box[1] || lat > box[3]) continue;
        if (inPolygon(lon, lat, rings)) {
          if (!dots.has(c.code)) dots.set(c.code, []);
          dots.get(c.code).push([lat, lon, pi]);
          break hit;
        }
      }
    }
  }
}
for (const c of countries) {
  if (dots.has(c.code)) continue;
  const outer = c.polys
    .map((p) => p.rings[0])
    .sort((a, b) => b.length - a.length)[0]
    .slice(0, -1);
  const lon = outer.reduce((s, q) => s + q[0], 0) / outer.length;
  const lat = outer.reduce((s, q) => s + q[1], 0) / outer.length;
  dots.set(c.code, [[lat, lon, 0]]);
}

// Label/beacon anchor: centre of the polygon holding most of the country's dots,
// so France anchors in Europe rather than drifting toward French Guiana.
function anchorOf(list) {
  const byPoly = new Map();
  for (const d of list) byPoly.set(d[2], [...(byPoly.get(d[2]) ?? []), d]);
  const main = [...byPoly.values()].sort((a, b) => b.length - a.length)[0];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lat, lon] of main) {
    const p = (lat * Math.PI) / 180;
    const l = (lon * Math.PI) / 180;
    x += Math.cos(p) * Math.cos(l);
    y += Math.sin(p);
    z += Math.cos(p) * Math.sin(l);
  }
  const r = Math.hypot(x, y, z);
  return [
    +((Math.asin(y / r) * 180) / Math.PI).toFixed(1),
    +((Math.atan2(z, x) * 180) / Math.PI).toFixed(1),
  ];
}

// ── Encode: 4 base64url chars per dot (lat, lon at 0.1° → 11 + 12 bits) ───────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const enc = (lat, lon) => {
  const a = Math.round((lat + 90) * 10);
  const o = Math.round((lon + 180) * 10) % 3600;
  const n = a * 4096 + o; // < 2^23 → 4 chars of 6 bits
  return [18, 12, 6, 0].map((s) => B64[(n >> s) & 63]).join('');
};

const codes = [...dots.keys()].sort();
let total = 0;
const dotLines = codes.map((code) => {
  const list = dots.get(code);
  total += list.length;
  return `  ${code}: '${list.map(([la, lo]) => enc(la, lo)).join('')}',`;
});
const anchorLines = codes.map((code) => `  ${code}: [${anchorOf(dots.get(code)).join(', ')}],`);

writeFileSync(
  OUT,
  `// GENERATED by scripts/admin/build-globe-dots.mjs — do not edit by hand.
// ${total} land dots on a ${DOT_STEP}° equal-area grid, grouped by ISO alpha-2
// country. Each dot is 4 base64url chars: (lat+90)*10 * 4096 + (lon+180)*10.
export const DOT_STEP_DEG = ${DOT_STEP};

export const LAND_DOTS: Record<string, string> = {
${dotLines.join('\n')}
};

/** [lat, lon] label/beacon anchor per country (centre of its main landmass). */
export const COUNTRY_ANCHORS: Record<string, [number, number]> = {
${anchorLines.join('\n')}
};
`,
);
console.log(
  `wrote ${total} dots across ${codes.length} countries → ${path.relative(process.cwd(), OUT)}`,
);
