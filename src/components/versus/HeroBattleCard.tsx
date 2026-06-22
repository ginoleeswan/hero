import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import type { RosterHero } from '../../lib/teamBattle';

interface Props {
  hero: RosterHero;
  /** Team accent — drives the foil rim, glow, slot pip and no-art fallback. */
  tint: string;
  /** Lineup position (0-based) — used for the slot pip and the staggered deal. */
  index: number;
  /** Card width in px; height derives at a 7:9 trading-card ratio. */
  size: number;
  /** When false (reduced motion), render the resting card with no entrance. */
  animate: boolean;
  /** Optional tap (mobile reveal) — when set the card becomes pressable. */
  onPress?: () => void;
  /** Highlights the card with a gold ring (the currently-revealed hero). */
  selected?: boolean;
}

/** A foil collectible card for one hero: team-tinted rim + glow, lineup pip,
 *  and a portrait → image → monogram fallback so a member with no art never
 *  renders blank. Tappable on mobile to reveal that hero's stats. */
export function HeroBattleCard({ hero, tint, index, size, animate, onPress, selected }: Props) {
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
    <LinearGradient
      colors={selected ? [COLORS.goldAccent, '#fff', COLORS.goldAccent] : [tint, 'rgba(255,255,255,0.22)', 'rgba(0,0,0,0.45)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.frame}
    >
      <View style={styles.inner}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
        ) : (
          <LinearGradient colors={[tint, '#1a1426']} style={[styles.fill, styles.fallback]}>
            <Text style={styles.initials}>{initials}</Text>
          </LinearGradient>
        )}
        <View style={[styles.pip, { borderColor: selected ? COLORS.goldAccent : tint }]}>
          <Text style={styles.pipTxt}>{index + 1}</Text>
        </View>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.plate} pointerEvents="none">
          <Text style={styles.name} numberOfLines={1}>
            {hero.name}
          </Text>
        </LinearGradient>
      </View>
    </LinearGradient>
  );

  return (
    <Animated.View
      entering={animate ? FadeInDown.delay(index * 80).duration(440).springify().damping(15) : undefined}
      style={[styles.glow, { width: size, height: Math.round((size * 9) / 7), shadowColor: selected ? COLORS.goldAccent : tint }]}
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
  glow: { borderRadius: 14, shadowOpacity: 0.5, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  press: { flex: 1 },
  frame: { flex: 1, borderRadius: 14, padding: 1.5 },
  inner: { flex: 1, borderRadius: 12.5, overflow: 'hidden', backgroundColor: '#241a36' },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'Flame-Regular', fontSize: 22, color: 'rgba(255,255,255,0.92)' },
  pip: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipTxt: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.beige },
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingTop: 16, paddingBottom: 5 },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.beige, letterSpacing: 0.2 },
});
