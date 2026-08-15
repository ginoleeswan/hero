// src/components/ui/PaperCard.tsx — the app's one card surface on paper.
//
// Sixty places define this by hand, and no two of them agree. Measured across
// app/ and src/ on 2026-08-15: **eight** different border alphas on the same
// ink colour (0.06 / 0.08 / 0.1 / 0.12 / 0.16 / 0.18 / 0.2 / 0.22) and **eight**
// different radii (8 / 9 / 10 / 12 / 14 / 16 / 20 / 999), of which 9, 10 and 14
// are not on the radius scale at all and are part of the count `check:ui`
// ratchets. That is not a design with variants; it is a design nobody wrote
// down, re-guessed sixty times.
//
// This is that surface, written down once:
//
//   paper       #fff
//   border      rgba(41,60,67,0.10)   — the modal value of the sixty
//   radius      16                    — on RADIUS_SCALE; 14 and 10 are not
//   padding     16
//
// Deliberately NOT a section header, a divider, a press target or a layout.
// Those are `SectionHeader`, `PressScale` and `PageColumn`, and a wrapper that
// quietly owns four other concerns is one nobody can reuse — the same rule
// PageColumn's header states.
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function PaperCard({
  children,
  /**
   * The character's accent, from `deriveCharacterTheme`. Washes the card's
   * crown and fades to clean paper where the content lives, so a card can carry
   * a character's colour without tinting the text sitting on it.
   */
  accent,
  /**
   * Render as a bare passthrough — no surface, no border, no padding.
   *
   * This exists because the card grammar is a TABLET decision on some screens:
   * the phone character page separates its sections with hairline rules on bare
   * beige and must not change. Passing `plain` at the call site keeps that
   * decision where it belongs — with the screen that knows its own
   * breakpoints — instead of baking a width test into the primitive, which
   * would make the card silently invisible on a phone everywhere else.
   */
  plain = false,
  style,
  testID,
}: {
  children: React.ReactNode;
  accent?: string;
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  if (plain) return <View style={style}>{children}</View>;
  return (
    <View style={[styles.card, style]} testID={testID}>
      {accent ? (
        <LinearGradient
          // Crown only. A wash carried all the way down puts tinted paper under
          // body copy, which is where the contrast budget is tightest.
          colors={[accent + '22', accent + '00']}
          locations={[0, 0.65]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

/** The surface, exported so a screen that cannot use the component — a
 *  contentContainerStyle, an Animated.View — still lands on the same values
 *  instead of guessing a ninth border alpha. */
export const PAPER_CARD_SURFACE = {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: 'rgba(41,60,67,0.1)',
  borderRadius: 16,
  borderCurve: 'continuous',
} as const;

const styles = StyleSheet.create({
  card: {
    ...PAPER_CARD_SURFACE,
    padding: 16,
    // The crown wash is an absolute fill, so it has to be clipped to the radius.
    overflow: 'hidden',
  },
});
