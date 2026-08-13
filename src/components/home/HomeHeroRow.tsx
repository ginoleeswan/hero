// src/components/home/HomeHeroRow.tsx
import { useRef } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Text } from '../ui/Text';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { SPRING_PRESS } from '../../lib/nativeMotion';
import { heroRow } from './homeGeometry';
import { HeroCard, HERO_CARD_RADIUS } from '../HeroCard';
import { ThumbCard, type ThumbHero } from './ThumbCard';
import { prefetchHeroRow } from '../../lib/query/heroQueries';
import { COLORS, ORANGE_INK } from '../../constants/colors';

// The card matches the character screen's hero image aspect (see
// HERO_IMAGE_HEIGHT in app/character/[id].tsx), so the Apple Zoom morph fills
// the card edge to edge with no navy peeking through mid-transition. Both are
// window-relative, so the ratio lines up on every device — which is exactly why
// it has to be read per render rather than once at import: on an iPad the
// window changes and a frozen ratio would tear the morph open.

export type RowHero = ThumbHero;

/**
 * Portrait card that navigates via the Apple Zoom transition, with a spring
 * scale-down + light haptic on press for tactile feedback.
 *
 * The Pressable (the Link's asChild target) gets a single style object — Slot
 * rejects array styles. The scale lives on an inner Animated.View; it uses a
 * transform, which doesn't change the layout frame, so the zoom origin stays
 * correct. Shadow + clip live on that same inner view, OUTSIDE Link.AppleZoom,
 * so no shadow box bleeds into the transition on the way back.
 */
function PortraitZoomCard({
  item,
  width,
  height,
}: {
  item: RowHero;
  width: number;
  height: number;
}) {
  const pressed = useSharedValue(0);
  const queryClient = useQueryClient();
  // Push-in + haptic are armed on a short timer so a scroll-drag or a quick
  // tap-to-open clears them before they fire — navigation itself is never
  // delayed (it rides the Pressable's own onPress, below).
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFeedback = () => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    pressed.value = 0;
  };

  // SPRING_PRESS, not a local config: this card can't use PressScale (it wraps
  // a <Link> for prefetch), but it must not press at a different rate than the
  // PressScale cards sitting beside it in the same feed.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.95 : 1, SPRING_PRESS) }],
  }));

  return (
    <Link
      href={{
        pathname: '/character/[id]',
        params: {
          id: item.id,
          imageUri: item.portrait_url ?? item.image_url ?? undefined,
        },
      }}
      asChild
    >
      <Pressable
        style={StyleSheet.flatten([styles.cardSlot, { width, height }])}
        // Arm the push-in + haptic after a short hold. A scroll-drag or a quick
        // tap clears the timer first, so neither flickers while scrolling nor
        // delays opening. onPress (navigation) is untouched and fires instantly.
        onPressIn={() => {
          feedbackTimer.current = setTimeout(() => {
            pressed.value = 1;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }, 80);
        }}
        // Real tap-to-open: warm the detail row, drop the press-scale to a clean
        // 1.0 frame for the zoom origin, and let the Link navigate immediately.
        onPress={() => {
          prefetchHeroRow(queryClient, item.id);
          clearFeedback();
        }}
        onPressOut={clearFeedback}
      >
        <Animated.View style={[styles.cardVisual, animatedStyle]}>
          {/* Nothing behind the card and no drop shadow: a shadow would need a
              persistent host outside the zoom, which would then show as a box in
              the origin on dismiss. Keeping the slot empty means the detail
              screen contracts cleanly back into a vacant place. */}
          <Link.AppleZoom>
            <HeroCard
              id={item.id}
              name={item.name}
              imageUrl={item.image_url}
              portraitUrl={item.portrait_url}
              width={width}
              height={height}
            />
          </Link.AppleZoom>
        </Animated.View>
      </Pressable>
    </Link>
  );
}

interface HomeHeroRowProps {
  label?: string;
  title: string;
  heroes: RowHero[];
  variant?: 'portrait' | 'thumb';
  /** 'dark' renders the row on a navy editorial band for visual rhythm. */
  tone?: 'light' | 'dark';
  /** Overlay 1·2·3 chart numerals on the cards (leaderboard rows). */
  ranked?: boolean;
  /** Accent colour for the bar + label (defaults to orange). */
  accent?: string;
  /** Larger first-row card treatment. */
  feature?: boolean;
  onPress: (item: RowHero) => void;
  onViewAll?: () => void;
  disabled?: boolean;
}

export function HomeHeroRow({
  label,
  title,
  heroes,
  variant = 'portrait',
  tone = 'light',
  ranked = false,
  accent,
  feature = false,
  onPress,
  onViewAll,
  disabled = false,
}: HomeHeroRowProps) {
  const isPortrait = variant === 'portrait';
  const isDark = tone === 'dark';

  // Ranked rows use smaller "poster" cards so the big Top-10 numeral beside each
  // one reads, à la Apple TV. Otherwise: optional larger feature size, else default.
  const { width: winW, height: winH } = useWindowDimensions();
  const geom = heroRow(winW, winH);
  const featW = Math.round(geom.cardWidth * geom.featureScale);
  const featH = Math.round(geom.cardHeight * geom.featureScale);
  const cardW = ranked ? Math.round(geom.cardWidth * 0.72) : feature ? featW : geom.cardWidth;
  const cardH = ranked ? Math.round(cardW * geom.cardAspect) : feature ? featH : geom.cardHeight;
  // The numeral sits to the left, bottom-aligned, with the card overlapping just
  // its right edge (so the whole digit still reads — a thin "1" was being hidden).
  const rankSize = Math.round(cardH * 0.7);
  const rankOverlap = Math.round(cardW * 0.1);

  const titleNode = (
    <View style={styles.titleRow}>
      <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
      {!!onViewAll && <Text style={[styles.chevron, isDark && styles.titleDark]}>›</Text>}
    </View>
  );

  return (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <View style={styles.header}>
        <View style={[styles.accentBar, accent ? { backgroundColor: accent } : null]} />
        <View style={styles.headerText}>
          {!!label && (
            <Text style={[styles.label, accent ? { color: accent } : null]}>{label}</Text>
          )}
          {onViewAll ? (
            <Pressable onPress={onViewAll} style={styles.titlePressable}>
              {titleNode}
            </Pressable>
          ) : (
            titleNode
          )}
        </View>
      </View>
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        showsHorizontalScrollIndicator={false}
        decelerationRate={isPortrait && !ranked ? 'fast' : 'normal'}
        snapToInterval={isPortrait && !ranked ? cardW + 12 : undefined}
        // Keep only a few cards mounted per row. The defaults (initialNumToRender
        // 10, windowSize 21, no clipping) hold 10–20 image cards alive per list;
        // across ~12 rows that's the JS-thread weight that delays transitionEnd
        // and gates scroll after a back-swipe. Uniform-width portrait rows also
        // get getItemLayout so the list skips async measurement entirely.
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        getItemLayout={
          isPortrait && !ranked
            ? (_, index) => ({ length: cardW, offset: 15 + index * (cardW + 12), index })
            : undefined
        }
        contentContainerStyle={[styles.listContent, { gap: isPortrait ? 12 : 8 }]}
        renderItem={({ item, index }) => {
          if (!isPortrait) {
            return <ThumbCard item={item} onPress={() => onPress(item)} disabled={disabled} />;
          }
          if (ranked) {
            return (
              <View style={styles.rankItem}>
                <Text
                  style={[
                    styles.rankNumeral,
                    {
                      fontSize: rankSize,
                      lineHeight: rankSize,
                      marginRight: -rankOverlap,
                      color: isDark ? COLORS.beige : COLORS.navy,
                    },
                  ]}
                >
                  {index + 1}
                </Text>
                <PortraitZoomCard item={item} width={cardW} height={cardH} />
              </View>
            );
          }
          return <PortraitZoomCard item={item} width={cardW} height={cardH} />;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  sectionDark: {
    backgroundColor: COLORS.navy,
    paddingTop: 22,
    paddingBottom: 18,
    marginVertical: 8,
  },
  header: {
    paddingHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  accentBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: ORANGE_INK,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  titlePressable: { alignSelf: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },
  titleDark: { color: COLORS.beige },
  chevron: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.navy,
    lineHeight: 28,
    marginTop: -2,
  },
  listContent: { paddingHorizontal: 15, paddingBottom: 20 },
  // Link's asChild target — sizing only, single style object (Slot rejects arrays).
  // Width + height are passed as inline styles since they vary with feature/ranked.
  cardSlot: {
    marginVertical: 8,
  },
  // Inner scaled view: just the press-scale transform + clip. No shadow — see
  // the JSX note; an outside-the-zoom shadow host would show in the empty origin.
  cardVisual: {
    flex: 1,
    borderRadius: HERO_CARD_RADIUS,
    borderCurve: 'continuous',
  },
  // Top-10 numeral row: number to the left, bottom-aligned, card overlapping it.
  rankItem: { flexDirection: 'row', alignItems: 'flex-end' },
  rankNumeral: {
    fontFamily: 'Flame-Regular',
    includeFontPadding: false,
    textAlignVertical: 'bottom',
  },
});
