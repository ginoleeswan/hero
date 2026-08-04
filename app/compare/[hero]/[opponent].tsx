import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useMatchupShareImage } from '../../../src/hooks/useMatchupShareImage';
import { useMatchupVote } from '../../../src/hooks/useMatchupVote';
import { CommunityVotes } from '../../../src/components/compare/CommunityVotes';
import { getFighterArt } from '../../../src/lib/compareHandoff';
import { COLORS } from '../../../src/constants/colors';
import { ClashPortraits } from '../../../src/components/compare/ClashPortraits';
import { VerdictReveal } from '../../../src/components/compare/VerdictReveal';
import { StatBattleRow } from '../../../src/components/compare/StatBattleRow';
import { MatchupBadge } from '../../../src/components/compare/MatchupBadge';
import { useRelationship } from '../../../src/lib/query/heroQueries';
import { relationshipBadge } from '../../../src/lib/db/heroes';
import { TakesSection } from '../../../src/components/takes/TakesSection';

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

  const { data: relationship } = useRelationship(hero, opponent);
  const badge = relationshipBadge(relationship);

  // Portrait art comes from the picker handoff (pure lookups) so it's available
  // before any early return — the share-image hook below must run unconditionally.
  const artA = getFighterArt(hero);
  const artB = getFighterArt(opponent);
  const nameA = statsA?.name ?? artA?.name ?? '';
  const nameB = statsB?.name ?? artB?.name ?? '';

  const shareUrlA =
    statsA?.image.portraitUrl ?? statsA?.image.url ?? artA?.portrait_url ?? artA?.image_url;
  const shareUrlB =
    statsB?.image.portraitUrl ?? statsB?.image.url ?? artB?.portrait_url ?? artB?.image_url;
  const { hiddenCard, share: shareImage } = useMatchupShareImage({
    nameA,
    nameB,
    imageA: shareUrlA ? { uri: shareUrlA } : null,
    imageB: shareUrlB ? { uri: shareUrlB } : null,
    winner: overallWinner ?? 'tie',
    verdict,
    winsA: result?.winsA ?? 0,
    winsB: result?.winsB ?? 0,
  });

  // The arena is the READ-ONLY result page (matches web): show who wins (stats +
  // verdict) and the fan-vote tally. Voting happens earlier, as an in-place poll
  // on the matchup cards — never here.
  const { tally, pickedId } = useMatchupVote(hero, opponent);

  if (error) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={headerBase} />
        <StatusBar style="light" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(`/character/${hero}`)
          }
          activeOpacity={0.7}
          style={styles.retryBtn}
        >
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

  const handleShare = async () => {
    // Lead with the generated VS poster; fall back to a text share if the OS
    // share sheet or the snapshot is unavailable.
    const outcome = await shareImage();
    if (outcome === 'shared' || outcome === 'downloaded') return;
    Share.share({
      message: `${nameA} vs ${nameB} — ${verdict ?? ''}. Settle it on mythique.`,
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
      {hiddenCard}
      <Stack.Screen
        options={{
          ...headerBase,
          headerLeft: () => (
            <TouchableOpacity
              onPress={goBack}
              hitSlop={8}
              activeOpacity={0.7}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
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
              accessibilityRole="button"
              accessibilityLabel="Share this matchup"
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

      {/* The takes composer lives at the bottom of this scroll — without the
          KAV the iOS keyboard covers the input and Post button, and without
          persistTaps the first tap on Post only dismisses the keyboard. */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

            <MatchupBadge badge={badge} style={styles.matchupBadge} />

            <View style={styles.verdictBlock}>
              <VerdictReveal verdict={verdict} />
              <View style={styles.communityWrap}>
                <CommunityVotes tally={tally} pickedId={pickedId} heroAId={hero} tone="dark" />
              </View>
              <TouchableOpacity
                onPress={handleShare}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Share matchup"
                style={styles.shareRow}
              >
                <Ionicons name="share-outline" size={14} color="rgba(245,235,220,0.7)" />
                <Text style={styles.shareRowText}>Share result</Text>
              </TouchableOpacity>
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

            {ready && (
              <View style={styles.takesWrap}>
                <TakesSection
                  heroA={{ id: hero, name: nameA }}
                  heroB={{ id: opponent, name: nameB }}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  matchupBadge: { marginTop: 14, marginBottom: 2 },
  verdictBlock: {
    minHeight: 76,
    paddingTop: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.18)',
  },
  shareRowText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
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
    paddingTop: 24,
  },
  communityWrap: {
    alignSelf: 'stretch',
    marginTop: 14,
    marginBottom: 2,
  },
  battleWrap: {
    gap: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 28,
  },
  takesWrap: {
    paddingHorizontal: 22,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(41,60,67,0.1)',
    paddingTop: 24,
  },
});
