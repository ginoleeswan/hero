import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useHeroRow } from '../../lib/query/heroQueries';
import { HeroImage } from '../HeroImage';
import { COLORS, PAPER_TEXT } from '../../constants/colors';
import { alignmentLabel } from '../../lib/characterTaxonomy';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PeekHero {
  id: string;
  name: string;
  full_name?: string | null;
  publisher?: string | null;
  alignment?: string | null;
  image_url?: string | null;
  portrait_url?: string | null;
}

const STATS = [
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'strength', label: 'Strength' },
  { key: 'speed', label: 'Speed' },
  { key: 'durability', label: 'Durability' },
  { key: 'power', label: 'Power' },
  { key: 'combat', label: 'Combat' },
] as const;

function PeekStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${value}%` }]} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/**
 * In-context "peek" sheet for a hero — slides up over a dimmed backdrop so a
 * curious user can learn who someone is without leaving the pick/arena flow.
 * Shows identity + powerstats and offers "View profile" (deeper) or "Fight"
 * (commit). Shared verbatim by native and web for parity.
 */
export function HeroPeek({
  hero,
  subjectName,
  onClose,
  onFight,
  onViewProfile,
}: {
  hero: PeekHero;
  /** The hero this opponent is being chosen for — labels the Fight button. */
  subjectName?: string;
  onClose: () => void;
  onFight: () => void;
  onViewProfile: () => void;
}) {
  const { data: row } = useHeroRow(hero.id);

  const progress = useSharedValue(0);
  const [sheetH, setSheetH] = useState(480);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 20, stiffness: 180, mass: 0.9 });
  }, [progress]);

  const close = (after: () => void) => {
    // Reanimated shared-value write (library API, not a React mutation).
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(after)();
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetH }],
  }));

  const name = row?.name ?? hero.name;
  const realName = row?.full_name ?? hero.full_name;
  const publisher = row?.publisher ?? hero.publisher;
  const alignment = row?.alignment ?? hero.alignment;
  const showRealName = !!realName && realName.toLowerCase() !== name.toLowerCase();

  const stats = STATS.map((s) => ({
    key: s.key as string,
    label: s.label as string,
    value: (row?.[s.key] ?? null) as number | null,
  })).filter(
    (s): s is { key: string; label: string; value: number } => typeof s.value === 'number',
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        onPress={() => close(onClose)}
        accessibilityLabel="Dismiss"
      />

      <Animated.View
        style={[styles.sheet, sheetStyle]}
        onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
      >
        <View style={styles.grabber} />

        <View style={styles.headRow}>
          <View style={styles.portrait}>
            <HeroImage
              id={hero.id}
              name={name}
              imageUrl={row?.image_url ?? hero.image_url}
              portraitUrl={row?.portrait_url ?? hero.portrait_url}
              contentFit="cover"
              contentPosition="top"
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            {showRealName && (
              <Text style={styles.realName} numberOfLines={1}>
                {realName}
              </Text>
            )}
            <View style={styles.chips}>
              {!!publisher && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{publisher}</Text>
                </View>
              )}
              {/* The fallback used to render `alignment` raw, so a neutral
                  character's chip read a lowercase "neutral" next to properly
                  cased "Hero"/"Villain" ones. */}
              {!!alignmentLabel(alignment) && (
                <View style={[styles.chip, alignment === 'bad' && styles.chipBad]}>
                  <Text style={styles.chipText}>{alignmentLabel(alignment)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {stats.length > 0 && (
          <View style={styles.stats}>
            {stats.map((s) => (
              <PeekStat key={s.key} label={s.label} value={s.value} />
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={() => close(onViewProfile)}
            style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnSecondaryText}>View profile</Text>
          </Pressable>
          <Pressable
            onPress={() => close(onFight)}
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
          >
            <Ionicons name="flash" size={16} color={COLORS.beige} />
            <Text style={styles.btnPrimaryText}>
              {subjectName ? `Fight ${subjectName}` : 'Fight!'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 100,
  },
  backdrop: { backgroundColor: 'rgba(12,18,22,0.55)' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    ...Platform.select({ web: { borderRadius: 26, marginBottom: 24 } as object, default: {} }),
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
    boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
  } as object,
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.22)',
    alignSelf: 'center',
    marginBottom: 18,
  },

  headRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  portrait: {
    width: 92,
    height: 116,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
  },
  identity: { flex: 1, justifyContent: 'center', gap: 6 },
  name: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 30 },
  realName: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: PAPER_TEXT.faint },
  chips: { flexDirection: 'row', gap: 7, marginTop: 4, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.08)',
  },
  chipBad: { backgroundColor: 'rgba(176,58,46,0.12)' },
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  stats: { gap: 11, marginBottom: 22 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statLabel: {
    width: 96,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  },
  statFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.navy },
  statValue: {
    width: 28,
    textAlign: 'right',
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.navy,
    fontVariant: ['tabular-nums'],
  },

  actions: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  } as object,
  btnPressed: { opacity: 0.85 },
  btnSecondary: { backgroundColor: 'rgba(41,60,67,0.08)' },
  btnSecondaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.navy },
  btnPrimary: { backgroundColor: COLORS.orange },
  btnPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.beige },
});
