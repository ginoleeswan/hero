// src/components/event/VenueMap.tsx
// Where an edition was held, as a pin on a stylised world.
//
// The archive already carried this in prose — "D23 Expo Japan, held at the Tokyo
// Disney Resort rather than Anaheim" — which is a sentence doing a picture's job.
// Three of the watched events genuinely move (D23, Star Wars Celebration, PAX)
// and for those the location IS news; for the rest, "the same hall for a decade"
// is worth knowing too.
//
// Why a drawn map rather than a tile service: tiles need the network, would not
// survive the crawler surface's CSP, and arrive in somebody else's palette —
// a grey-and-blue rectangle dropped into a page that is otherwise ink, paper and
// one accent. This is ~40 polygons of coastline at roughly 5° resolution, which
// is all the fidelity a 200pt-wide graphic can show, and it is drawn in the
// page's own colours.
//
// Equirectangular, deliberately. It is the projection whose maths is a single
// linear map from (lon, lat) to (x, y), which means a pin cannot drift from its
// coastline no matter how the box is sized — and at this scale the distortion
// everyone objects to in Mercator is invisible anyway.
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { Text } from '../ui/Text';
import { INK_TEXT } from '../../constants/colors';

/**
 * Coastlines as [lon, lat] rings, coarse on purpose.
 *
 * Hand-authored rather than imported: a real topology file is hundreds of
 * kilobytes for a graphic that is 200pt wide, and this ships as part of the
 * bundle either way. Accuracy is at the level of "that is clearly Japan, and it
 * is clearly not California", which is the entire question being asked.
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
  // Scandinavia's Baltic bite, so northern Europe is not a solid block
  [
    [10, 55],
    [14, 55],
    [20, 60],
    [24, 66],
    [16, 68],
    [10, 63],
    [10, 55],
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

/** Equirectangular. lon −180..180 → 0..w, lat 90..−90 → 0..h. */
const project = (lon: number, lat: number, w: number, h: number) => ({
  x: ((lon + 180) / 360) * w,
  // Antarctica is not drawn and the poles carry no venues, so the vertical range
  // is clipped to ±83°. It buys about 8% more scale on the part of the world
  // anything actually happens in.
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
  venue,
  city,
  lat,
  lon,
  accent,
  width = 200,
}: {
  venue: string;
  city: string | null;
  lat: number;
  lon: number;
  accent: string;
  /** The graphic's width. Height follows from the projection's 166°×360° box. */
  width?: number;
}) {
  const w = width;
  const h = Math.round((w * 166) / 360);
  const pin = project(lon, lat, w, h);

  return (
    <View style={s.wrap}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* The sea. A flat wash rather than a colour: this sits on ink, and a
            blue ocean would be the one thing on the page not in the palette. */}
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
        {/* The pin, drawn as a target rather than a teardrop marker. A map pin is
            a UI convention borrowed from somebody else's product; two rings and a
            dot is the same information in this page's own language, and it reads
            at 4pt where a teardrop does not. */}
        <Circle cx={pin.x} cy={pin.y} r={7} fill={accent} opacity={0.18} />
        <Circle cx={pin.x} cy={pin.y} r={3.6} fill={accent} opacity={0.42} />
        <Circle cx={pin.x} cy={pin.y} r={1.9} fill={accent} />
      </Svg>
      <Text style={s.venue} numberOfLines={2}>
        {venue}
      </Text>
      {!!city && (
        <Text style={s.city} numberOfLines={1}>
          {city}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  venue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(245,235,220,0.9)',
  },
  city: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: INK_TEXT.faint,
  },
});
