// src/components/event/VenueMap.tsx
// The year this event was somewhere else, drawn as the move.
//
// The first version of this put a pin on every edition page, and that was the
// wrong idea done competently. A venue is only NEWS when it moved: eighteen of
// the twenty-one watched events have sat in the same hall for a decade, and a
// map that draws the world to say "San Diego" about San Diego Comic-Con is
// furniture. The three that move are the whole point — D23 has been to Anaheim,
// Urayasu and Bay Lake; Star Wars Celebration changes country by design; PAX is
// two shows wearing one name.
//
// So this renders only when an edition's city differs from where its event
// usually runs, and when it does it shows BOTH places and the jump between them.
// One pin answers "where"; two pins and a line answer "and that is unusual",
// which is the only reason the graphic is on the page at all. The archive was
// already saying it in prose — D23 2018's recap is literally "held at the Tokyo
// Disney Resort rather than Anaheim" — and this is that sentence as a picture.
//
// Why a drawn map rather than a tile service: tiles need the network, would not
// survive the crawler surface's CSP, and arrive in somebody else's palette — a
// grey-and-blue rectangle in a page that is otherwise ink, paper and one accent.
//
// Equirectangular, deliberately. Its projection is a single linear map from
// (lon, lat) to (x, y), so a pin cannot drift from its coastline at any box
// size, and at this scale the distortion everyone objects to in Mercator is
// invisible anyway.
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G, Line } from 'react-native-svg';
import { Text } from '../ui/Text';
import { INK_TEXT } from '../../constants/colors';

/**
 * Coastlines as [lon, lat] rings, coarse on purpose.
 *
 * Hand-authored rather than imported: a real topology file is hundreds of
 * kilobytes for a graphic 200pt wide. Accuracy is at the level of "that is
 * clearly Japan, and it is clearly not California", which is the whole question.
 */
const LAND: [number, number][][] = [
  // North America
  [
    [-168, 66],
    [-160, 71],
    [-140, 70],
    [-125, 70],
    [-110, 68],
    [-95, 68],
    [-82, 73],
    [-70, 70],
    [-60, 60],
    [-64, 52],
    [-55, 47],
    [-66, 44],
    [-70, 41],
    [-76, 35],
    [-81, 25],
    [-84, 30],
    [-90, 29],
    [-97, 26],
    [-97, 20],
    [-92, 15],
    [-84, 10],
    [-78, 8],
    [-83, 15],
    [-88, 21],
    [-105, 20],
    [-114, 28],
    [-124, 40],
    [-124, 48],
    [-133, 55],
    [-150, 59],
    [-165, 60],
    [-168, 66],
  ],
  // South America
  [
    [-78, 8],
    [-72, 11],
    [-62, 10],
    [-52, 5],
    [-44, -2],
    [-35, -6],
    [-38, -13],
    [-48, -25],
    [-54, -34],
    [-62, -40],
    [-65, -48],
    [-68, -55],
    [-75, -50],
    [-73, -40],
    [-71, -30],
    [-70, -18],
    [-77, -6],
    [-80, 0],
    [-78, 8],
  ],
  // Africa
  [
    [-17, 15],
    [-16, 22],
    [-6, 36],
    [10, 37],
    [20, 32],
    [32, 31],
    [43, 12],
    [51, 12],
    [42, -1],
    [40, -15],
    [35, -24],
    [25, -34],
    [18, -34],
    [12, -18],
    [9, -1],
    [9, 4],
    [-8, 5],
    [-13, 9],
    [-17, 15],
  ],
  // Europe + Asia, as one landmass, because it is one
  [
    [-9, 43],
    [-2, 48],
    [4, 52],
    [8, 58],
    [5, 62],
    [15, 69],
    [30, 70],
    [60, 71],
    [80, 74],
    [100, 77],
    [130, 73],
    [160, 70],
    [180, 66],
    [170, 60],
    [160, 58],
    [143, 54],
    [135, 44],
    [127, 38],
    [122, 31],
    [118, 24],
    [108, 21],
    [100, 13],
    [98, 8],
    [93, 16],
    [88, 22],
    [80, 15],
    [73, 20],
    [67, 24],
    [57, 25],
    [48, 30],
    [36, 36],
    [28, 41],
    [18, 40],
    [12, 45],
    [3, 43],
    [-9, 43],
  ],
  // Great Britain
  [
    [-5, 50],
    [1, 51],
    [0, 54],
    [-2, 58],
    [-6, 57],
    [-5, 53],
    [-5, 50],
  ],
  // Japan — small, and load-bearing: D23 2018, SWCE 2025 and every Comiket
  [
    [131, 31],
    [136, 34],
    [141, 37],
    [142, 41],
    [145, 44],
    [141, 45],
    [138, 37],
    [133, 34],
    [130, 33],
    [131, 31],
  ],
  // Australia
  [
    [113, -22],
    [114, -34],
    [122, -34],
    [131, -32],
    [138, -35],
    [146, -39],
    [150, -37],
    [153, -28],
    [146, -19],
    [142, -11],
    [136, -12],
    [130, -11],
    [125, -14],
    [117, -20],
    [113, -22],
  ],
  // New Zealand
  [
    [173, -35],
    [178, -38],
    [175, -41],
    [171, -44],
    [167, -46],
    [170, -43],
    [173, -35],
  ],
  // Madagascar
  [
    [43, -12],
    [50, -15],
    [47, -25],
    [44, -20],
    [43, -12],
  ],
  // Greenland
  [
    [-45, 60],
    [-30, 68],
    [-22, 70],
    [-20, 76],
    [-30, 83],
    [-50, 82],
    [-58, 76],
    [-52, 66],
    [-45, 60],
  ],
];

/** Equirectangular. Vertical range is clipped to ±83°: Antarctica is not drawn
 *  and the poles hold no conventions, which buys ~8% more scale on the part of
 *  the world anything happens in. */
const project = (lon: number, lat: number, w: number, h: number) => ({
  x: ((lon + 180) / 360) * w,
  y: ((83 - lat) / 166) * h,
});

const ringToPath = (ring: [number, number][], w: number, h: number) =>
  ring
    .map(([lon, lat], i) => {
      const p = project(lon, lat, w, h);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join('') + 'Z';

export function VenueMap({
  city,
  lat,
  lon,
  fromCity,
  fromLat,
  fromLon,
  accent,
  width = 208,
}: {
  /** Where this edition actually was. */
  city: string;
  lat: number;
  lon: number;
  /** Where the event usually runs. */
  fromCity: string;
  fromLat: number;
  fromLon: number;
  accent: string;
  width?: number;
}) {
  const w = width;
  const h = Math.round((w * 166) / 360);
  const to = project(lon, lat, w, h);
  const from = project(fromLon, fromLat, w, h);

  // The short way round, which for Anaheim → Urayasu is across the Pacific, not
  // back across five continents. When the shorter path crosses the antimeridian
  // the line is drawn as two segments — leaving one edge and re-entering at the
  // other — which is also exactly what crossing the Pacific looks like on a flat
  // map, so the honest maths and the legible picture are the same picture.
  const dLon = lon - fromLon;
  const wraps = Math.abs(dLon) > 180;
  const legs: { x1: number; y1: number; x2: number; y2: number }[] = wraps
    ? (() => {
        // Fraction of the journey completed at the edge, so the two segments meet
        // the frame at the same latitude they would have crossed it at.
        const east = dLon < 0; // travelling east off the right-hand edge
        const span = 360 - Math.abs(dLon);
        const toEdge = east ? 180 - fromLon : fromLon + 180;
        const t = Math.abs(toEdge) / span;
        const yEdge = from.y + (to.y - from.y) * t;
        return east
          ? [
              { x1: from.x, y1: from.y, x2: w, y2: yEdge },
              { x1: 0, y1: yEdge, x2: to.x, y2: to.y },
            ]
          : [
              { x1: from.x, y1: from.y, x2: 0, y2: yEdge },
              { x1: w, y1: yEdge, x2: to.x, y2: to.y },
            ];
      })()
    : [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y }];

  return (
    <View style={s.wrap}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* The sea. A wash rather than a colour: this sits on ink, and a blue
            ocean would be the one thing on the page outside the palette. */}
        <Rect x={0} y={0} width={w} height={h} rx={4} fill="rgba(245,235,220,0.05)" />
        <G>
          {LAND.map((ring, i) => (
            <Path
              key={i}
              d={ringToPath(ring, w, h)}
              fill="rgba(245,235,220,0.17)"
              stroke="rgba(245,235,220,0.26)"
              strokeWidth={0.6}
            />
          ))}
        </G>
        {legs.map((l, i) => (
          <Line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={accent}
            strokeWidth={1}
            strokeDasharray="2 2.5"
            opacity={0.5}
          />
        ))}
        {/* Where it usually is: a hollow ring, so it reads as the place being
            departed from rather than as a second event. */}
        <Circle
          cx={from.x}
          cy={from.y}
          r={2.6}
          fill="none"
          stroke="rgba(245,235,220,0.55)"
          strokeWidth={1.2}
        />
        {/* Where it was. Two rings and a dot rather than a teardrop marker: the
            teardrop is a UI convention borrowed from somebody else's product,
            and it does not read at 4pt where a target does. */}
        <Circle cx={to.x} cy={to.y} r={7} fill={accent} opacity={0.18} />
        <Circle cx={to.x} cy={to.y} r={3.6} fill={accent} opacity={0.42} />
        <Circle cx={to.x} cy={to.y} r={1.9} fill={accent} />
      </Svg>
      <Text style={s.note}>
        <Text style={[s.noteStrong, { color: accent }]}>{city}</Text>
        {` — usually ${fromCity}`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10, alignItems: 'flex-start' },
  note: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
    maxWidth: 260,
  },
  noteStrong: { fontFamily: 'Nunito_700Bold' },
});
