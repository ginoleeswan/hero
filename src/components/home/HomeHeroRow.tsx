// src/components/home/HomeHeroRow.tsx
import { View, Text, FlatList, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { HeroCard, HERO_CARD_RADIUS } from '../HeroCard';
import { ThumbCard, type ThumbHero } from './ThumbCard';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const PORTRAIT_CARD_HEIGHT = 300;

export interface RowHero extends ThumbHero {}

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
function PortraitZoomCard({ item }: { item: RowHero }) {
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
        style={styles.cardSlot}
        onPressIn={() => {
          pressed.value = 1;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          pressed.value = 0;
        }}
      >
        <Animated.View style={[styles.cardVisual, animatedStyle]}>
          {/* Nothing sits behind the card. The drop shadow lives on a wrapper
              INSIDE Link.AppleZoom so it's hidden together with the card during
              the zoom dismiss — the origin slot goes completely empty and the
              detail screen contracts cleanly back into its place. */}
          <Link.AppleZoom>
            <View style={styles.cardShadow}>
              <HeroCard
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                width={PORTRAIT_CARD_WIDTH}
                height={PORTRAIT_CARD_HEIGHT}
              />
            </View>
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
  onPress,
  onViewAll,
  disabled = false,
}: HomeHeroRowProps) {
  const isPortrait = variant === 'portrait';
  const isDark = tone === 'dark';

  const titleNode = (
    <View style={styles.titleRow}>
      <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
      {!!onViewAll && <Text style={[styles.chevron, isDark && styles.titleDark]}>›</Text>}
    </View>
  );

  return (
    <View style={[styles.section, isDark && styles.sectionDark]}>
      <View style={styles.header}>
        <View style={styles.accentBar} />
        <View style={styles.headerText}>
          {!!label && <Text style={styles.label}>{label}</Text>}
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
        snapToInterval={isPortrait ? PORTRAIT_CARD_WIDTH + 12 : undefined}
        contentContainerStyle={[styles.listContent, { gap: isPortrait ? 12 : 8 }]}
        renderItem={({ item }) =>
          isPortrait ? (
            <PortraitZoomCard item={item} />
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
  cardSlot: {
    width: PORTRAIT_CARD_WIDTH,
    height: PORTRAIT_CARD_HEIGHT,
    marginVertical: 8,
  },
  // Inner scaled view: just the press-scale transform + clip. The shadow is NOT
  // here — it lives on cardShadow inside Link.AppleZoom so it disappears with the
  // card on dismiss, leaving a clean empty origin (no hollow shadow box).
  cardVisual: {
    flex: 1,
    borderRadius: HERO_CARD_RADIUS,
    borderCurve: 'continuous',
  },
  // Drop shadow on the card itself (inside the zoom element), so it morphs and
  // hides together with the card during the transition.
  cardShadow: {
    flex: 1,
    borderRadius: HERO_CARD_RADIUS,
    borderCurve: 'continuous',
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.3)',
  },
});
