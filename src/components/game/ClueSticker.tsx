// Bespoke die-cut clue stickers for the daily game, drawn with react-native-svg
// so they render identically on native + web. Each clue category gets its own
// silhouette (banner / arch / seal / starburst / hexagon), a thick cream
// die-cut border, an inner keyline, a drop shadow and a category glyph — a
// retro sticker packet rather than uniform chips. Pure presentational.
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { Clue } from '../../lib/game/reveal';

type Shape = 'banner' | 'arch' | 'seal' | 'star' | 'hex';

interface Cfg {
  shape: Shape;
  layout: 'text' | 'iconText';
  w: number;
  h: number;
  bg: string;
  fg: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  pad: number;
  font: number;
}

const CREAM = '#fbf3e4';
const BORDER = 6;

// Category → bespoke shape + retro tone. Most are big-text die-cuts (the value
// is the hero, like a packet sticker); the arch keeps a badge-style icon-on-top
// layout. Longer values get the roomier silhouettes.
const CONFIG: Record<string, Cfg> = {
  Publisher: {
    shape: 'banner',
    layout: 'text',
    w: 120,
    h: 52,
    bg: COLORS.orange,
    fg: COLORS.beige,
    accent: 'rgba(245,235,220,0.5)',
    icon: 'library',
    pad: 16,
    font: 18,
  },
  'Signature power': {
    shape: 'arch',
    layout: 'iconText',
    w: 110,
    h: 106,
    bg: COLORS.green,
    fg: COLORS.deepNavy,
    accent: 'rgba(11,24,32,0.32)',
    icon: 'flash',
    pad: 13,
    font: 14,
  },
  Origin: {
    shape: 'hex',
    layout: 'text',
    w: 108,
    h: 92,
    bg: COLORS.red,
    fg: COLORS.beige,
    accent: 'rgba(245,235,220,0.45)',
    icon: 'planet',
    pad: 18,
    font: 17,
  },
  Alignment: {
    shape: 'star',
    layout: 'text',
    w: 104,
    h: 104,
    bg: COLORS.yellow,
    fg: COLORS.deepNavy,
    accent: 'rgba(11,24,32,0.3)',
    icon: 'shield-half',
    pad: 22,
    font: 16,
  },
  'First appeared': {
    shape: 'seal',
    layout: 'text',
    w: 88,
    h: 88,
    bg: COLORS.blue,
    fg: COLORS.beige,
    accent: 'rgba(245,235,220,0.5)',
    icon: 'time',
    pad: 13,
    font: 19,
  },
};

// Small per-index rotation so the cluster scatters like a real packet.
const ROT = [-6, 5, -3, 6, -5, 4];

function roundRectPath(w: number, h: number, r: number): string {
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function archPath(w: number, h: number): string {
  const br = 12;
  const tr = w / 2;
  return `M 0 ${tr} A ${tr} ${tr} 0 0 1 ${w} ${tr} L ${w} ${h - br} A ${br} ${br} 0 0 1 ${w - br} ${h} L ${br} ${h} A ${br} ${br} 0 0 1 0 ${h - br} Z`;
}

function hexPath(w: number, h: number): string {
  return `M ${w * 0.26} 0 L ${w * 0.74} 0 L ${w} ${h / 2} L ${w * 0.74} ${h} L ${w * 0.26} ${h} L 0 ${h / 2} Z`;
}

function starPath(w: number, h: number, points = 14, innerRatio = 0.84): string {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(w, h) / 2;
  const inner = outer * innerRatio;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + 'Z';
}

function pathFor(cfg: Cfg): string {
  switch (cfg.shape) {
    case 'banner':
      return roundRectPath(cfg.w, cfg.h, cfg.h / 2);
    case 'arch':
      return archPath(cfg.w, cfg.h);
    case 'hex':
      return hexPath(cfg.w, cfg.h);
    case 'star':
      return starPath(cfg.w, cfg.h);
    default:
      return '';
  }
}

function ShapeEl({
  cfg,
  fill,
  stroke,
  strokeWidth,
}: {
  cfg: Cfg;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  if (cfg.shape === 'seal') {
    return (
      <Circle
        cx={cfg.w / 2}
        cy={cfg.h / 2}
        r={cfg.w / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  return <Path d={pathFor(cfg)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

const scaleAbout = (cx: number, cy: number, s: number) =>
  `translate(${(cx * (1 - s)).toFixed(2)}, ${(cy * (1 - s)).toFixed(2)}) scale(${s})`;

export function ClueSticker({ clue, tilt }: { clue: Clue; tilt: number }) {
  const cfg = CONFIG[clue.label] ?? CONFIG.Publisher;
  const { w, h, bg, fg, accent, icon, pad, font, layout } = cfg;
  const cx = w / 2;
  const cy = h / 2;
  const min = Math.min(w, h);
  const sIn = 1 - (2 * BORDER) / min;
  const sLn = 1 - (2 * (BORDER + 4.5)) / min;

  return (
    <View
      style={[
        styles.wrap,
        { width: w, height: h, transform: [{ rotate: `${ROT[tilt % ROT.length]}deg` }] },
      ]}
      accessibilityLabel={`${clue.label}: ${clue.value}`}
    >
      <Svg width={w} height={h}>
        <G transform="translate(0, 3)" opacity={0.3}>
          <ShapeEl cfg={cfg} fill="#05090d" />
        </G>
        <ShapeEl cfg={cfg} fill={CREAM} />
        <G transform={scaleAbout(cx, cy, sIn)}>
          <ShapeEl cfg={cfg} fill={bg} />
        </G>
        <G transform={scaleAbout(cx, cy, sLn)}>
          <ShapeEl cfg={cfg} fill="none" stroke={accent} strokeWidth={1.6} />
        </G>
      </Svg>
      <View style={[styles.content, { paddingHorizontal: pad }]} pointerEvents="none">
        {layout === 'iconText' ? (
          <Ionicons name={icon} size={24} color={fg} style={styles.icon} />
        ) : null}
        <Text
          style={[styles.value, { color: fg, fontSize: font, lineHeight: font + 1 }]}
          numberOfLines={2}
        >
          {clue.value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { opacity: 0.9, marginBottom: 2 },
  value: {
    fontFamily: 'Flame-Regular',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
