// src/components/family/HouseCrest.tsx
// The mark a house is recognised by.
//
// Eight houses would need eight illustrations, and drawn sigils we don't own are
// exactly the "fake cast" problem — so the crest is *systematic*: a heater
// escutcheon cut from the house's own tint, carrying its initial. One shape, one
// rule, and every house in the catalogue gets one for free the moment it exists.
import { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

/** The outer shield: square shoulders, straight flanks, a rounded point. */
const SHIELD = 'M6 4 H94 V58 C94 86 76 104 50 112 C24 104 6 86 6 58 Z';
/** The orle — the hairline that runs inside the edge on real heraldry. */
const ORLE = 'M15 13 H85 V58 C85 80 70 94 50 101 C30 94 15 80 15 58 Z';

const VIEW_W = 100;
const VIEW_H = 116;

/** "House Targaryen" → "T". */
export function crestMonogram(name: string): string {
  // `of` too, or "House of El" charges a crest with an O.
  const stripped = name.replace(/^\s*(house|clan|family|the)\s+(of\s+)?/i, '').trim();
  return ((stripped || name).trim()[0] ?? '?').toUpperCase();
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Blend `hex` toward `towards` by `amount` (0–1). Returns `hex` unchanged if it isn't one. */
export function mixHex(hex: string, towards: string, amount: number): string {
  if (!HEX.test(hex) || !HEX.test(towards)) return hex;
  const parse = (h: string): number[] => {
    const s = h.replace('#', '');
    const full =
      s.length === 3
        ? s
            .split('')
            .map((c) => c + c)
            .join('')
        : s;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const a = parse(hex);
  const b = parse(towards);
  const ch = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

export function HouseCrest({
  name,
  tint,
  size = 104,
}: {
  name: string;
  /** houses.sigil_tint — the house's own colour. */
  tint: string;
  /** Rendered height in points; the shield's width follows its aspect. */
  size?: number;
}) {
  // useId keeps the gradient unique when two crests share a document (the
  // roster rail, a future index of houses) — a duplicate id silently repaints
  // every shield with the first one's colour.
  const gradientId = `crest-${useId().replace(/:/g, '')}`;
  const width = Math.round((size * VIEW_W) / VIEW_H);
  const letter = crestMonogram(name);

  return (
    <View style={{ width, height: size }} accessibilityLabel={`${name} crest`}>
      <Svg width={width} height={size} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={mixHex(tint, '#ffffff', 0.22)} />
            <Stop offset="1" stopColor={mixHex(tint, '#0b1820', 0.42)} />
          </LinearGradient>
        </Defs>
        <Path
          d={SHIELD}
          fill={`url(#${gradientId})`}
          stroke="rgba(245,235,220,0.6)"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <Path d={ORLE} fill="none" stroke="rgba(245,235,220,0.3)" strokeWidth={1.1} />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Text
          style={[
            styles.monogram,
            { fontSize: size * 0.4, lineHeight: size * 0.5, marginTop: size * 0.21 },
          ]}
        >
          {letter}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monogram: {
    fontFamily: 'Flame-Regular',
    color: 'rgba(245,235,220,0.94)',
    textAlign: 'center',
  },
});
