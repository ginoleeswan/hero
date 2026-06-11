// app/(tabs)/versus.tsx
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair } from '../../src/lib/versus';
import { stashFighters, type FighterArt } from '../../src/lib/compareHandoff';
import { TodaysMatchupCard } from '../../src/components/versus/TodaysMatchupCard';
import { RivalriesRail } from '../../src/components/versus/RivalriesRail';

export default function VersusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { matchup, rivalries, iconicPool, loading } = useVersusHub();

  const openArena = (a: FighterArt, b: FighterArt) => {
    stashFighters(a, b);
    router.push(`/compare/${a.id}/${b.id}`);
  };

  const surprise = () => {
    const pair = pickRandomPair(iconicPool);
    if (!pair) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openArena(pair[0], pair[1]);
  };

  const canSurprise = iconicPool.length >= 2;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Navy stage */}
        <View style={[styles.stage, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.eyebrow}>SETTLE THE DEBATE</Text>
          <Text style={styles.title}>Versus</Text>
        </View>

        <View style={styles.sheet}>
          {loading && !matchup ? (
            <View style={styles.loading}>
              <ActivityIndicator color={COLORS.orange} />
            </View>
          ) : (
            <>
              {matchup ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Today's Matchup</Text>
                  <TodaysMatchupCard matchup={matchup} onOpen={openArena} />
                </View>
              ) : null}

              <Pressable
                onPress={surprise}
                disabled={!canSurprise}
                accessibilityRole="button"
                accessibilityLabel="Surprise me with a random matchup"
                style={({ pressed }) => [
                  styles.surprise,
                  pressed && styles.surprisePressed,
                  !canSurprise && styles.surpriseDisabled,
                ]}
              >
                <Ionicons name="shuffle" size={18} color={COLORS.beige} />
                <Text style={styles.surpriseText}>Surprise me</Text>
              </Pressable>

              <View style={styles.section}>
                <RivalriesRail rivalries={rivalries} onOpen={openArena} />
              </View>

              <Pressable
                onPress={() => router.push('/compare/pick')}
                accessibilityRole="button"
                accessibilityLabel="Build your own matchup"
                style={({ pressed }) => [styles.build, pressed && styles.buildPressed]}
              >
                <View style={styles.buildIcon}>
                  <Ionicons name="git-compare" size={20} color={COLORS.orange} />
                </View>
                <View style={styles.buildTextWrap}>
                  <Text style={styles.buildTitle}>Build your own</Text>
                  <Text style={styles.buildSub}>Pick any two fighters</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(41,60,67,0.4)" />
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1, backgroundColor: COLORS.navy },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: 16, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.beige },
  sheet: {
    backgroundColor: COLORS.navy,
    paddingTop: 8,
    gap: 26,
  },
  loading: { paddingVertical: 60, alignItems: 'center' },
  section: { paddingHorizontal: 0 },
  sectionLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  // Surprise me — orange brand CTA
  surprise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.orange,
  },
  surprisePressed: { opacity: 0.9 },
  surpriseDisabled: { opacity: 0.4 },
  surpriseText: { fontFamily: 'Nunito_900Black', fontSize: 15, color: COLORS.beige },
  // Build your own — beige row card
  build: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.beige,
  },
  buildPressed: { opacity: 0.9 },
  buildIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,115,51,0.14)',
  },
  buildTextWrap: { flex: 1 },
  buildTitle: { fontFamily: 'Nunito_900Black', fontSize: 15, color: COLORS.navy },
  buildSub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: 'rgba(41,60,67,0.6)' },
});
