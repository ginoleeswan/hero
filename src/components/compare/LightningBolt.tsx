import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LightningBoltProps {
  height: number;
  width?: number;
}

/**
 * Jagged vertical lightning bolt — yellow/gold with black outline.
 * Rendered as an SVG path, positioned as the divider between the two hero panels.
 * width defaults to 52 — keep this narrow so portraits have max space.
 */
export function LightningBolt({ height, width = 52 }: LightningBoltProps) {
  const W = 52;
  const H = 280;

  const shadowPath = `
    M 28 0
    L 38 ${H * 0.19}
    L 50 ${H * 0.19}
    L 33 ${H * 0.40}
    L 47 ${H * 0.40}
    L 20 ${H * 0.64}
    L 36 ${H * 0.64}
    L 13 ${H * 0.86}
    L 30 ${H * 0.86}
    L 15 ${H}
    L 17 ${H}
    L 33 ${H * 0.86}
    L 16 ${H * 0.86}
    L 39 ${H * 0.64}
    L 23 ${H * 0.64}
    L 50 ${H * 0.40}
    L 36 ${H * 0.40}
    L 53 ${H * 0.19}
    L 41 ${H * 0.19}
    L 31 0
    Z
  `;

  const boltPath = `
    M 26 0
    L 36 ${H * 0.19}
    L 48 ${H * 0.19}
    L 31 ${H * 0.40}
    L 45 ${H * 0.40}
    L 18 ${H * 0.64}
    L 34 ${H * 0.64}
    L 11 ${H * 0.86}
    L 28 ${H * 0.86}
    L 13 ${H}
    L 15 ${H}
    L 31 ${H * 0.86}
    L 14 ${H * 0.86}
    L 37 ${H * 0.64}
    L 21 ${H * 0.64}
    L 48 ${H * 0.40}
    L 34 ${H * 0.40}
    L 51 ${H * 0.19}
    L 39 ${H * 0.19}
    L 29 0
    Z
  `;

  const highlightPath = `
    M 26 0
    L 34 ${H * 0.18}
    L 46 ${H * 0.19}
    L 32 ${H * 0.39}
    L 44 ${H * 0.41}
    L 20 ${H * 0.63}
    L 34 ${H * 0.65}
    L 12 ${H * 0.85}
    L 27 ${H * 0.87}
    L 13 ${H}
    L 15 ${H}
    L 30 ${H * 0.87}
    L 15 ${H * 0.85}
    L 36 ${H * 0.65}
    L 22 ${H * 0.63}
    L 46 ${H * 0.41}
    L 32 ${H * 0.39}
    L 48 ${H * 0.19}
    L 36 ${H * 0.18}
    L 28 0
    Z
  `;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="boltGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffe066" />
          <Stop offset="0.5" stopColor="#f5a623" />
          <Stop offset="1" stopColor="#e8890a" />
        </LinearGradient>
      </Defs>
      <Path d={shadowPath} fill="rgba(0,0,0,0.35)" translateX={2} translateY={3} />
      <Path d={boltPath} fill="url(#boltGrad)" stroke="#1a1a1a" strokeWidth={2} />
      <Path d={highlightPath} fill="rgba(255,240,180,0.45)" />
    </Svg>
  );
}
