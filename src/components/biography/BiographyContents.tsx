// src/components/biography/BiographyContents.tsx — the reading-position pill.
//
// Desktop gets a sticky numbered sidebar; there is no gutter to put that in on
// a phone. Instead of shrinking it, this inverts the pattern: a compact pill
// docked at the bottom that answers "where am I" ambiently, and opens into the
// full contents on demand.
//
// The ambient half is the underrated one. In a four-thousand-word ComicVine
// biography, orientation is worth more than jumping, and it costs nothing once
// the active section is being tracked for the sheet anyway.
//
// Cross-platform by construction: the pill and the sheet are plain RN, and the
// two things that genuinely differ — how you observe scroll position and how
// you jump — are injected by the screens (`activeIndex`, `onJump`).
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { Sheet } from '../ui/Sheet';
import { DUR } from '../../lib/nativeMotion';
import { MIN_SECTIONS_FOR_CONTENTS } from '../../hooks/useBiography';

export function BiographyContents({
  toc,
  activeIndex,
  /** 0..1 through the document, for the pill's hairline. */
  progress,
  /** True while the reader is scrolling *down* — the pill steps out of the way. */
  hidden,
  open,
  onOpenChange,
  onJump,
}: {
  toc: string[];
  activeIndex: number;
  progress: number;
  hidden: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (index: number) => void;
}) {
  const reduceMotion = useReducedMotion();

  // Auto-hide while reading down, return on any scroll up. Reduced motion keeps
  // the pill parked rather than sliding it — the information is the point, the
  // movement isn't.
  const dock = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1, transform: [{ translateY: 0 }] };
    return {
      opacity: withTiming(hidden ? 0 : 1, { duration: DUR.fast }),
      transform: [{ translateY: withTiming(hidden ? 26 : 0, { duration: DUR.fast }) }],
    };
  });

  if (toc.length < MIN_SECTIONS_FOR_CONTENTS) return null;

  const current = toc[activeIndex] ?? toc[0];
  const position = `${activeIndex + 1} of ${toc.length}`;

  return (
    <>
      <Animated.View style={[styles.dock, dock]} pointerEvents="box-none">
        <Pressable
          onPress={() => onOpenChange(true)}
          accessibilityRole="button"
          // Reads the whole state, so the pill is useful to a screen reader
          // even though its visual job is ambient.
          accessibilityLabel={`Contents — section ${position}, ${current}`}
          accessibilityHint="Opens the list of sections"
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          {/* Progress hairline, inset so it reads as part of the pill's lip
              rather than a separate bar. */}
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.pillRow}>
            <Text style={styles.pillPos}>{position}</Text>
            <Text style={styles.pillLabel} numberOfLines={1}>
              {current}
            </Text>
            {/* Points UP: it promises a sheet rising, not navigation away. A
                '›' would promise a new page and be a lie. */}
            <Ionicons name="chevron-up" size={14} color={INK_TEXT.muted} />
          </View>
        </Pressable>
      </Animated.View>

      <Sheet
        visible={open}
        onClose={() => onOpenChange(false)}
        tone="ink"
        footPad={14}
        label="Contents"
      >
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Contents</Text>
          <Pressable
            onPress={() => onOpenChange(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close contents"
          >
            {/* The pill's chevron, rotated — same glyph, so opening and
                dismissing are legibly the same control. */}
            <Ionicons name="chevron-down" size={18} color={INK_TEXT.muted} />
          </Pressable>
        </View>
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {toc.map((heading, i) => {
            const on = i === activeIndex;
            return (
              <Pressable
                key={`${i}-${heading}`}
                onPress={() => {
                  onOpenChange(false);
                  onJump(i);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.row,
                  on && styles.rowOn,
                  pressed && styles.rowPressed,
                ]}
              >
                {/* Folio numeral, not a bullet — echoes the desktop rail and
                    the codex voice the brand runs on. */}
                <Text style={[styles.rowNum, on && styles.rowNumOn]}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text style={[styles.rowText, on && styles.rowTextOn]} numberOfLines={2}>
                  {heading}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  // Centring only. Positioning belongs to the screen's dock wrapper, which
  // differs by platform (absolute + safe-area inset on native, position:fixed
  // on web) — nesting a second absolute box here would collapse to zero height.
  dock: { alignItems: 'center' },
  pill: {
    minHeight: 44, // touch-target floor
    maxWidth: 320,
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(11,24,32,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.16)',
    justifyContent: 'center',
    // Lifts the pill off the prose so it reads as chrome, not content.
    shadowColor: '#0b1820',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pillPressed: { opacity: 0.85 },
  track: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(245,235,220,0.14)',
  },
  trackFill: { height: 2, borderRadius: 1, backgroundColor: COLORS.orange },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 13,
  },
  pillPos: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 1,
    color: COLORS.orange,
  },
  pillLabel: {
    flexShrink: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: INK_TEXT.primary,
  },

  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    lineHeight: 25, // ≥1.22× — Flame descenders
    color: INK_TEXT.primary,
  },
  // Capped so a 20-section biography scrolls inside the sheet instead of
  // pushing the sheet past the top of the screen.
  sheetScroll: { maxHeight: 420 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
  },
  rowOn: { backgroundColor: 'rgba(231,115,51,0.1)' },
  rowPressed: { opacity: 0.7 },
  rowNum: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    color: INK_TEXT.faint,
    marginTop: 2,
    width: 20,
  },
  rowNumOn: { color: COLORS.orange },
  rowText: {
    flex: 1,
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: INK_TEXT.muted,
  },
  rowTextOn: { color: INK_TEXT.primary, fontFamily: 'Nunito_700Bold' },
});
