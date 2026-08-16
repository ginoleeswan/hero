// src/components/event/VenueGlobe.tsx
// Where an edition happened, drawn as a globe turned to face it.
//
// This replaces a flat equirectangular map, and the reasons it replaces it are
// worth keeping, because the flat one failed in three ways at once and each was
// a lesson about the header rather than about cartography:
//
//  1. It did not read as a map. Land at 10% beige on navy, 190pt wide, is a grey
//     smudge — you cannot name a continent at a glance, so it said nothing the
//     words "Anaheim, USA" beside it were not already saying.
//  2. It lost a fight with the detection curve. Both are teal line-work in the
//     same register, and the curve's rise ran straight through the Pacific and
//     out of the corner. The original argument for leaving the map UNFRAMED was
//     that a frame makes it a widget; what actually happened is that with no
//     frame it had nothing to hold its edge against the curve, and two textures
//     overlapping is mud.
//  3. A rectangle of world map is a widget SHAPE whatever its border. A disc is
//     an object. It brings its own edge, so it can sit over the curve and stay
//     legible without a box being drawn around it.
//
// The globe is centred on the venue, so the pin is always near the middle where
// it cannot be missed, and the visible hemisphere is always the one the event
// happened in. Tilted 8° so the pin sits slightly above centre rather than dead
// on it: dead centre is a bullseye, and a bullseye is a diagram.
//
// Orthographic, which is the projection that actually looks like a photograph of
// a planet — the limb is a true circle, and features compress toward it exactly
// as a sphere's do. It also gives the clipping for free: a point is on the far
// side when cos(c) <= 0, so the horizon needs no special case.
//
// Why drawn rather than tiled: tiles need the network, would not survive the
// crawler surface's CSP, and arrive in somebody else's palette.
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '../ui/Text';
import { INK_TEXT } from '../../constants/colors';
import { LAND } from './coastlines';

const RAD = Math.PI / 180;

type Pt = { x: number; y: number };

/**
 * One orthographic camera, built once per render and shared by the coastlines,
 * the graticule and the flight arc so they cannot disagree about where the
 * horizon is.
 */
function camera(lat0: number, lon0: number, r: number, cx: number, cy: number) {
  const p0 = lat0 * RAD;
  const l0 = lon0 * RAD;
  const sin0 = Math.sin(p0);
  const cos0 = Math.cos(p0);

  return (lon: number, lat: number): Pt | null => {
    const p = lat * RAD;
    const dl = lon * RAD - l0;
    const cosc = sin0 * Math.sin(p) + cos0 * Math.cos(p) * Math.cos(dl);
    // The far side of the planet. Not drawn, and not fudged into a silhouette:
    // a hemisphere that ends at its horizon is what a globe looks like.
    if (cosc <= 0) return null;
    return {
      x: cx + r * (Math.cos(p) * Math.sin(dl)),
      y: cy - r * (cos0 * Math.sin(p) - sin0 * Math.cos(p) * Math.cos(dl)),
    };
  };
}

/**
 * Break a sampled ring into the runs of it that are on the near side.
 *
 * Each run is drawn as its own closed path. Closing a run that the horizon cut
 * lays a chord across the disc, which is the correct picture: the visible part
 * of a continent really does end at the limb.
 */
function runs(pts: (Pt | null)[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of pts) {
    if (p) cur.push(p);
    else if (cur.length > 1) {
      out.push(cur);
      cur = [];
    } else cur = [];
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

const toPath = (run: Pt[], close: boolean) =>
  run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
  (close ? 'Z' : '');

/**
 * Resample a coarse ring so its segments survive being bent around a sphere.
 *
 * The source rings are deliberately crude — a dozen points for a continent. On a
 * flat projection that is fine because straight stays straight; on a globe a
 * 40° segment drawn as one line cuts visibly across the curvature, and worse,
 * the horizon test only runs at vertices, so a segment can pass behind the
 * planet without anyone noticing. Two-degree steps fix both.
 */
function densify(ring: [number, number][], stepDeg = 2): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lo1, la1] = ring[i];
    const [lo2, la2] = ring[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(lo2 - lo1, la2 - la1) / stepDeg));
    for (let k = 0; k < n; k++) {
      out.push([lo1 + ((lo2 - lo1) * k) / n, la1 + ((la2 - la1) * k) / n]);
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
}

/** Great-circle path between two places, as points. Slerp on unit vectors —
 *  the honest route, and on a globe it also happens to be the pretty one: it
 *  bows toward the pole exactly the way a flight map does. */
function greatCircle(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  steps = 64,
): [number, number][] {
  const v = (lat: number, lon: number) => {
    const p = lat * RAD;
    const l = lon * RAD;
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)] as const;
  };
  const A = v(a.lat, a.lon);
  const B = v(b.lat, b.lon);
  const dot = Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
  const w = Math.acos(dot);
  const out: [number, number][] = [];
  // Antipodal, or the same place: no unique arc, and nothing worth drawing.
  if (w < 1e-6) return out;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * w) / Math.sin(w);
    const s2 = Math.sin(t * w) / Math.sin(w);
    const x = s1 * A[0] + s2 * B[0];
    const y = s1 * A[1] + s2 * B[1];
    const z = s1 * A[2] + s2 * B[2];
    out.push([Math.atan2(y, x) / RAD, Math.asin(z / Math.hypot(x, y, z)) / RAD]);
  }
  return out;
}

export function VenueGlobe({
  city,
  lat,
  lon,
  from,
  accent,
  size = 96,
  stacked = false,
  captionWidth,
}: {
  /** Where this edition was. */
  city: string;
  lat: number;
  lon: number;
  /** Where the event USUALLY runs, when that is somewhere else. Null for the
   *  eighteen watched events that have not moved in a decade — then the globe is
   *  simply turned to the place, which is all there is to say. */
  from: { city: string; lat: number; lon: number } | null;
  accent: string;
  /** Caption UNDER the globe rather than beside it. */
  stacked?: boolean;
  /** How wide the caption may run before it wraps. The globe sits at the end of
   *  the identity row, so an unbounded caption — "Seattle, USA — usually
   *  Boston, USA" is 33 characters — pushes the row past the screen edge and
   *  squeezes the brand mark it shares the line with. */
  captionWidth?: number;
  /** Diameter. Sized as an ORNAMENT (~96) rather than as a figure: at 232 it
   *  stopped integrating into the masthead and became a second hero, adding
   *  400pt of band to say what the caption beside it already says in words.
   *  At ornament scale it fits inside the height the stat rail already uses,
   *  so the place is on the page for free. */
  size?: number;
}) {
  const g = useMemo(() => {
    const r = size / 2 - 1;
    const cx = size / 2;
    const cy = size / 2;
    // Tilted so the venue sits a little above centre. Dead centre reads as a
    // bullseye; this reads as a planet that has been turned to look at.
    const project = camera(lat - 8, lon, r, cx, cy);

    const land = LAND.flatMap((ring) =>
      runs(densify(ring).map(([lo, la]) => project(lo, la))).map((run) => toPath(run, true)),
    );

    // The graticule is the whole reason this reads instantly as a SPHERE rather
    // than as a circular crop of a map. Meridians converging toward the limb and
    // parallels bowing are the two cues the eye uses, and neither survives a
    // flat projection at any size.
    //
    // Spaced by DIAMETER, not fixed. At ornament size a 30° grid puts eleven
    // lines inside 96pt, which stops being a graticule and becomes hatching —
    // the lines land closer together than the coastlines they are meant to sit
    // behind, and the globe turns into a ball of noise.
    const gridStep = size >= 150 ? 30 : 45;
    const grid: string[] = [];
    for (let latLine = -60; latLine <= 60; latLine += gridStep) {
      const pts: (Pt | null)[] = [];
      for (let lo = -180; lo <= 180; lo += 2) pts.push(project(lo, latLine));
      runs(pts).forEach((run) => grid.push(toPath(run, false)));
    }
    for (let lonLine = -180; lonLine < 180; lonLine += gridStep) {
      const pts: (Pt | null)[] = [];
      for (let la = -90; la <= 90; la += 2) pts.push(project(lonLine, la));
      runs(pts).forEach((run) => grid.push(toPath(run, false)));
    }

    const pin = project(lon, lat);
    const origin = from ? project(from.lon, from.lat) : null;
    // The arc is drawn even when the origin itself is over the horizon — it
    // simply runs off the limb, which reads correctly as "from somewhere on the
    // other side" rather than as a line that failed to draw.
    const arc = from
      ? runs(greatCircle(from, { lat, lon }).map(([lo, la]) => project(lo, la))).map((run) =>
          toPath(run, false),
        )
      : [];

    return { r, cx, cy, land, grid, pin, origin, arc };
  }, [lat, lon, from, size]);

  return (
    <View style={[stacked ? s.wrap : s.wrapInline, { width: captionWidth }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Lit from the upper left, very faintly. This is the difference
              between a circle with shapes in it and a ball. */}
          <RadialGradient id="vg-lit" cx="34%" cy="30%" r="78%">
            <Stop offset="0" stopColor="#f5ebdc" stopOpacity={0.075} />
            <Stop offset="1" stopColor="#f5ebdc" stopOpacity={0.005} />
          </RadialGradient>
        </Defs>

        <Circle cx={g.cx} cy={g.cy} r={g.r} fill="url(#vg-lit)" />

        {g.grid.map((d, i) => (
          <Path key={`g${i}`} d={d} stroke="rgba(245,235,220,0.10)" strokeWidth={0.5} fill="none" />
        ))}

        {g.land.map((d, i) => (
          <Path
            key={`l${i}`}
            d={d}
            fill="rgba(245,235,220,0.22)"
            stroke="rgba(245,235,220,0.38)"
            strokeWidth={0.6}
          />
        ))}

        {g.arc.map((d, i) => (
          <Path
            key={`a${i}`}
            d={d}
            stroke={accent}
            strokeWidth={1.1}
            strokeDasharray="2 3"
            fill="none"
            opacity={0.6}
          />
        ))}

        {/* Where it usually is: a hollow ring, so it reads as the place being
            departed from rather than as a second event. */}
        {!!g.origin && (
          <Circle
            cx={g.origin.x}
            cy={g.origin.y}
            r={3}
            fill="none"
            stroke="rgba(245,235,220,0.6)"
            strokeWidth={1.2}
          />
        )}

        {/* The limb. One hairline, and it is the frame the flat map never had —
            an edge that belongs to the object rather than a box drawn around it. */}
        <Circle
          cx={g.cx}
          cy={g.cy}
          r={g.r}
          fill="none"
          stroke="rgba(245,235,220,0.26)"
          strokeWidth={1}
        />

        {/* Where it was. Rings and a dot rather than a teardrop marker: the
            teardrop is a UI convention borrowed from somebody else's product,
            and a target is what reads at this scale. */}
        {!!g.pin && (
          <>
            <Circle cx={g.pin.x} cy={g.pin.y} r={9} fill={accent} opacity={0.16} />
            <Circle cx={g.pin.x} cy={g.pin.y} r={4.6} fill={accent} opacity={0.4} />
            <Circle cx={g.pin.x} cy={g.pin.y} r={2.3} fill={accent} />
          </>
        )}
      </Svg>
      <Text style={s.note}>
        <Text style={[s.noteStrong, { color: accent }]}>{city}</Text>
        {from ? ` — usually ${from.city}` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12, alignItems: 'flex-start' },
  wrapInline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
  },
  noteStrong: { fontFamily: 'Nunito_700Bold' },
});
