import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHeroById, heroRowToCharacterData } from '../../../src/lib/db/heroes';
import { fetchHeroStats, type VerdictInput } from '../../../src/lib/api';
import { useVerdict } from '../../../src/lib/query/heroQueries';
import { heroImageSource } from '../../../src/constants/heroImages';
import { compareStats } from '../../../src/lib/compare';
import type { StatResult } from '../../../src/lib/compare';
import type { HeroStats } from '../../../src/types';
import { COLORS } from '../../../src/constants/colors';
import { ClashPortraits } from '../../../src/components/compare/ClashPortraits';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const CARD_HEIGHT = 330;

const headerBase = {
  headerShown: true,
  headerTitle: '',
  headerStyle: { backgroundColor: COLORS.navy },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

async function loadHeroStats(id: string): Promise<HeroStats> {
  const row = await getHeroById(id);
  if (row?.enriched_at) return heroRowToCharacterData(row).stats;
  return fetchHeroStats(id);
}

function StatBattleRow({ stat }: { stat: StatResult }) {
  const aWins = stat.winner === 'A';
  const bWins = stat.winner === 'B';
  const winColor = stat.color;
  const dimColor = 'rgba(41,60,67,0.18)';

  return (
    <View style={battle.row}>
      <View style={battle.side}>
        <Text style={[battle.val, aWins && battle.valWin]}>{stat.valueA}</Text>
        <View style={battle.track}>
          <View
            style={[
              battle.barLeft,
              { width: `${stat.valueA}%`, backgroundColor: aWins ? winColor : dimColor } as object,
            ]}
          />
        </View>
      </View>
      <Text style={battle.label}>{stat.label}</Text>
      <View style={[battle.side, battle.sideRight]}>
        <View style={battle.track}>
          <View
            style={[
              battle.barRight,
              { width: `${stat.valueB}%`, backgroundColor: bWins ? winColor : dimColor } as object,
            ]}
          />
        </View>
        <Text style={[battle.val, bWins && battle.valWin]}>{stat.valueB}</Text>
      </View>
    </View>
  );
}

export default function NativeCompareScreen() {
  const { hero, opponent } = useLocalSearchParams<{ hero: string; opponent: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [statsA, setStatsA] = useState<HeroStats | null>(null);
  const [statsB, setStatsB] = useState<HeroStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadHeroStats(hero), loadHeroStats(opponent)])
      .then(([a, b]) => {
        setStatsA(a);
        setStatsB(b);
      })
      .catch(() => setError('Could not load hero data.'));
  }, [hero, opponent]);

  // Verdict is cached per matchup (staleTime: Infinity), so the AI edge function
  // is invoked once — revisiting the same pair reuses the generated text.
  const verdictInput = useMemo<VerdictInput | null>(() => {
    if (!statsA || !statsB) return null;
    const r = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
    const toNums = (ps: HeroStats['powerstats']) =>
      Object.fromEntries(Object.entries(ps).map(([k, v]) => [k, parseInt(v, 10) || 0]));
    return {
      heroA: statsA.name,
      heroB: statsB.name,
      winsA: r.winsA,
      winsB: r.winsB,
      statsA: toNums(statsA.powerstats),
      statsB: toNums(statsB.powerstats),
    };
  }, [statsA, statsB]);
  const verdict = useVerdict(hero, opponent, verdictInput).data ?? null;

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

  if (!statsA || !statsB) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={headerBase} />
        <StatusBar style="light" />
      </View>
    );
  }

  const result = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
  const imageA = heroImageSource(hero, statsA.image.url, statsA.image.portraitUrl);
  const imageB = heroImageSource(opponent, statsB.image.url, statsB.image.portraitUrl);
  const overallWinner: 'A' | 'B' | 'tie' =
    result.winsA > result.winsB ? 'A' : result.winsB > result.winsA ? 'B' : 'tie';

  const handleShare = () => {
    Share.share({
      message: `${statsA.name} vs ${statsB.name} — ${verdict ?? result.verdict}. Check it out on Hero app!`,
    }).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          ...headerBase,
          headerRight: ({ tintColor }) => (
            <TouchableOpacity onPress={handleShare} hitSlop={10} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={24} color={tintColor} />
            </TouchableOpacity>
          ),
        }}
      />
      <StatusBar style="light" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.navyTop}>
          <View style={styles.clashCard}>
            <ClashPortraits
              imageA={imageA}
              imageB={imageB}
              nameA={statsA.name}
              nameB={statsB.name}
              winner={overallWinner}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
            />
          </View>

          <View style={styles.verdictWrap}>
            {verdict ? (
              <Text style={styles.verdict}>{verdict}</Text>
            ) : (
              <Text style={styles.verdictPlaceholder}>{result.verdict}</Text>
            )}
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.battleWrap}>
            {result.stats.map((stat) => (
              <StatBattleRow key={stat.key} stat={stat} />
            ))}
          </View>

          <TouchableOpacity
            onPress={() =>
              router.replace(`/compare/${hero}/pick?name=${encodeURIComponent(statsA.name)}`)
            }
            activeOpacity={0.85}
            style={styles.compareAnotherBtn}
          >
            <Text style={styles.compareAnotherText}>
              Compare {statsA.name} with someone else →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1, backgroundColor: COLORS.navy },
  scrollContent: { flexGrow: 1 },
  loading: {
    flex: 1,
    backgroundColor: COLORS.navy,
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
    paddingBottom: 18,
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
  verdictWrap: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  verdict: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 26,
  },
  verdictPlaceholder: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },

  sheet: {
    flexGrow: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -14,
    paddingTop: 20,
  },
  battleWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  compareAnotherBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  compareAnotherText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13.5,
    color: COLORS.beige,
    letterSpacing: 0.3,
  },
});

const battle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideRight: { flexDirection: 'row-reverse' },
  val: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(41,60,67,0.35)',
    width: 26,
    textAlign: 'center',
    flexShrink: 0,
  },
  valWin: { color: COLORS.navy },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barLeft: { position: 'absolute', right: 0, top: 0, bottom: 0, borderRadius: 4 },
  barRight: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: 80,
    textAlign: 'center',
    flexShrink: 0,
  },
});
