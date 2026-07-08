import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import type { RosterHero } from '../../lib/teamBattle';

interface Props {
  hero: RosterHero;
  /** Team accent — drives the soft glow, slot pip and no-art fallback. */
  tint: string;
  /** Lineup position (0-based) — used for the slot pip and the staggered deal. */
  index: number;
  /** Card width in px; height derives at a 7:9 trading-card ratio. */
  size: number;
  /** When false (reduced motion), render the resting card with no entrance. */
  animate: boolean;
  /** Optional tap (mobile reveal) — when set the card becomes pressable. */
  onPress?: () => void;
  /** Highlights the card with a gold edge + glow (the spotlit hero). */
  selected?: boolean;
  /** Mirror the portrait so a right-side hero faces in toward the left team. */
  flip?: boolean;
}

/** A collectible card for one hero: a clean hairline edge, a soft team-coloured
 *  glow, a lineup pip, and a portrait → image → monogram fallback so a member
 *  with no art never renders blank. Tappable on mobile to spotlight the hero. */
export function HeroBattleCard({
  hero,
  tint,
  index,
  size,
  animate,
  onPress,
  selected,
  flip,
}: Props) {
  const uri = hero.portrait_url ?? hero.image_url ?? undefined;
  const initials = useMemo(
    () =>
      hero.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase(),
    [hero.name],
  );

  const face = (
    <View style={[styles.card, selected ? styles.cardSelected : null]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, flip ? styles.flip : null]}
          contentFit="cover"
          transition={220}
        />
      ) : (
        <LinearGradient colors={[tint, COLORS.deepNavy]} style={[styles.fill, styles.fallback]}>
          <Text style={styles.initials}>{initials}</Text>
        </LinearGradient>
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent']}
        style={styles.topShade}
        pointerEvents="none"
      />
      <View
        style={[
          styles.pip,
          { backgroundColor: selected ? COLORS.goldAccent : 'rgba(11,24,32,0.7)' },
        ]}
      >
        <Text style={[styles.pipTxt, selected ? styles.pipTxtSel : null]}>{index + 1}</Text>
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.88)']}
        style={styles.plate}
        pointerEvents="none"
      >
        <Text style={styles.name} numberOfLines={1}>
          {hero.name}
        </Text>
      </LinearGradient>
    </View>
  );

  return (
    <Animated.View
      entering={animate ? FadeInDown.delay(index * 30).duration(260) : undefined}
      style={[
        styles.glow,
        {
          width: size,
          height: Math.round((size * 9) / 7),
          shadowColor: selected ? COLORS.goldAccent : tint,
          shadowOpacity: selected ? 0.55 : 0.4,
        },
      ]}
    >
      {onPress ? (
        <Pressable onPress={onPress} style={styles.press} accessibilityRole="button">
          {face}
        </Pressable>
      ) : (
        face
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { borderRadius: 14, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 9 },
  press: { flex: 1 },
  card: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardSelected: { borderWidth: 1.5, borderColor: COLORS.goldAccent },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  flip: { transform: [{ scaleX: -1 }] },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'Flame-Regular', fontSize: 22, color: 'rgba(255,255,255,0.92)' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: '30%' },
  pip: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipTxt: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.beige },
  pipTxtSel: { color: COLORS.deepNavy },
  plate: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingTop: 16,
    paddingBottom: 6,
  },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.beige, letterSpacing: 0.2 },
});
