import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { heroImageSource } from '../../../src/constants/heroImages';
import { useCompareMatchup } from '../../../src/hooks/useCompareMatchup';
import { getFighterArt } from '../../../src/lib/compareHandoff';
import { COLORS } from '../../../src/constants/colors';
import { ClashPortraits } from '../../../src/components/compare/ClashPortraits';
import { VerdictReveal } from '../../../src/components/compare/VerdictReveal';
import { StatBattleRow } from '../../../src/components/compare/StatBattleRow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const CARD_HEIGHT = 286;

const headerBase = {
  headerShown: true,
  headerTitle: '',
  // Transparent so the immersive navy stage reads as one continuous surface —
  // no opaque header bar appearing over the content on scroll.
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor: COLORS.beige,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function NativeCompareScreen() {
  const { hero, opponent } = useLocalSearchParams<{ hero: string; opponent: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { statsA, statsB, result, overallWinner, verdict, error } = useCompareMatchup(
    hero,
    opponent,
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={headerBase} />
        <StatusBar style="light" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ready = !!(statsA && statsB && result && overallWinner);

  // The header floats (transparent), so pad the navy stage down to clear it.
  const headerHeight = insets.top + (Platform.OS === 'ios' ? 44 : 56);

  // Paint portraits instantly from the picker handoff so there's no blank navy
  // gap before stats load — the slide-in entrance plays over the real art, and
  // the winner cue reveals once the result resolves (winner: 'neutral' → real).
  const artA = getFighterArt(hero);
  const artB = getFighterArt(opponent);
  const imageA = heroImageSource(
    hero,
    statsA?.image.url ?? artA?.image_url,
    statsA?.image.portraitUrl ?? artA?.portrait_url,
  );
  const imageB = heroImageSource(
    opponent,
    statsB?.image.url ?? artB?.image_url,
    statsB?.image.portraitUrl ?? artB?.portrait_url,
  );
  const nameA = statsA?.name ?? artA?.name ?? '';
  const nameB = statsB?.name ?? artB?.name ?? '';

  const handleShare = () => {
    Share.share({
      message: `${nameA} vs ${nameB} — ${verdict ?? result?.verdict ?? ''}. Check it out on Hero app!`,
    }).catch(() => {});
  };

  // Back returns to wherever the matchup was launched from — the hero's page on
  // a fresh comparison, or the previous matchup mid-swap. Fall back to the
  // hero's page when there's no history (e.g. opened via a deep link).
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/character/${hero}`);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          ...headerBase,
          headerLeft: () => (
            <TouchableOpacity
              onPress={goBack}
              hitSlop={8}
              activeOpacity={0.7}
              style={styles.headerBtn}
            >
              <Ionicons name="chevron-back" size={26} color={COLORS.beige} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleShare}
              hitSlop={8}
              activeOpacity={0.7}
              style={styles.headerBtn}
            >
              <SymbolView
                name="square.and.arrow.up"
                weight="heavy"
                tintColor={COLORS.beige}
                size={22}
                resizeMode="scaleAspectFit"
                style={styles.headerIcon}
                fallback={<Ionicons name="share" size={23} color={COLORS.beige} />}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <StatusBar style="light" />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.navyTop, { paddingTop: headerHeight }]}>
          <View style={styles.clashCard}>
            <ClashPortraits
              imageA={imageA}
              imageB={imageB}
              nameA={nameA}
              nameB={nameB}
              winner={overallWinner ?? 'neutral'}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              onSwapA={() =>
                router.push(`/compare/${opponent}/pick?name=${encodeURIComponent(nameB)}`)
              }
              onSwapB={() =>
                router.push(`/compare/${hero}/pick?name=${encodeURIComponent(nameA)}`)
              }
              onViewProfileA={() => router.push(`/character/${hero}`)}
              onViewProfileB={() => router.push(`/character/${opponent}`)}
            />
          </View>

          <View style={styles.verdictBlock}>
            <VerdictReveal verdict={verdict} />
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.battleWrap}>
            {ready && result ? (
              result.stats.map((stat, i) => (
                <StatBattleRow key={stat.key} stat={stat} animateIn animationDelay={i * 70} />
              ))
            ) : (
              <View style={styles.statsLoading}>
                <ActivityIndicator color={COLORS.orange} />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  body: { flex: 1, backgroundColor: COLORS.navy },
  bodyContent: { flexGrow: 1 },
  statsLoading: {
    flexGrow: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: COLORS.navy,
  },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.beige },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },

  navyTop: {
    backgroundColor: COLORS.navy,
    paddingBottom: 30,
  },
  clashCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: CARD_MARGIN,
    marginTop: CARD_MARGIN,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  verdictBlock: {
    minHeight: 76,
    paddingTop: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 22,
    height: 22,
  },

  sheet: {
    flexGrow: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -14,
    paddingTop: 12,
  },
  battleWrap: {
    gap: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 28,
  },
});
