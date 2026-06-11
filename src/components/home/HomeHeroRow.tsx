// src/components/home/HomeHeroRow.tsx
import { View, Text, FlatList, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { HeroCard, HERO_CARD_RADIUS } from '../HeroCard';
import { ThumbCard, type ThumbHero } from './ThumbCard';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PORTRAIT_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
// Match the character screen's hero image aspect — full width × SCREEN_HEIGHT*0.66
// (see HERO_IMAGE_HEIGHT in app/character/[id].tsx). Keeping the card's aspect
// equal to the detail image's means the Apple Zoom morph fills the card edge to
// edge with no navy background peeking through mid-transition. Both are
// screen-relative, so the ratio lines up on every device.
const DETAIL_HERO_RATIO = (SCREEN_HEIGHT * 0.66) / SCREEN_WIDTH; // height ÷ width
const PORTRAIT_CARD_HEIGHT = Math.round(PORTRAIT_CARD_WIDTH * DETAIL_HERO_RATIO);

export interface RowHero extends ThumbHero {}

/** Oversized editorial chart numeral overlaid on a ranked card's corner. A
 *  dark layer sits behind the beige fill so it reads on any portrait. */
function RankBadge({ rank }: { rank: number }) {
  return (
    <View style={styles.rankBadge} pointerEvents="none">
      <Text style={[styles.rankNumeral, styles.rankBack]}>{rank}</Text>
      <Text style={styles.rankNumeral}>{rank}</Text>
    </View>
  );
}

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
  width = PORTRAIT_CARD_WIDTH,
  height = PORTRAIT_CARD_HEIGHT,
  rank,
}: {
  item: RowHero;
  width?: number;
  height?: number;
  rank?: number;
}) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.95 : 1, { damping: 18, stiffness: 260, mass: 0.6 }) },
    ],
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
        onPressIn={() => {
          pressed.value = 1;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          pressed.value = 0;
        }}
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
          {typeof rank === 'number' && <RankBadge rank={rank} />}
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

  const featW = Math.round(PORTRAIT_CARD_WIDTH * 1.06);
  const featH = Math.round(PORTRAIT_CARD_HEIGHT * 1.06);
  const cardW = feature ? featW : PORTRAIT_CARD_WIDTH;
  const cardH = feature ? featH : PORTRAIT_CARD_HEIGHT;

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
        decelerationRate={isPortrait ? 'fast' : 'normal'}
        snapToInterval={isPortrait ? cardW + 12 : undefined}
        contentContainerStyle={[styles.listContent, { gap: isPortrait ? 12 : 8 }]}
        renderItem={({ item, index }) =>
          isPortrait ? (
            <PortraitZoomCard
              item={item}
              width={cardW}
              height={cardH}
              rank={ranked ? index + 1 : undefined}
            />
          ) : (
            <ThumbCard item={item} onPress={() => onPress(item)} disabled={disabled} />
          )
        }
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
    color: COLORS.orange,
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
  rankBadge: {
    position: 'absolute',
    top: 0,
    left: 8,
  },
  rankNumeral: {
    fontFamily: 'Flame-Regular',
    fontSize: 100,
    lineHeight: 104,
    color: COLORS.beige,
    textShadowColor: 'rgba(10,15,18,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  // Dark lift behind the fill — offset so the numeral reads on bright portraits.
  rankBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: 'rgba(10,15,18,0.5)',
    textShadowColor: 'transparent',
    transform: [{ translateX: 2 }, { translateY: 4 }],
  },
});
