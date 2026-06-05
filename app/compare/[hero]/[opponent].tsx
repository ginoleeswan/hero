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
import { SymbolView } from 'expo-symbols';
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
import { VerdictReveal } from '../../../src/components/compare/VerdictReveal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const CARD_HEIGHT = 286;

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

const BAR_DIM = 'rgba(41,60,67,0.16)';

function StatBattleRow({ stat }: { stat: StatResult }) {
  const aStrong = stat.winner !== 'B'; // win or tie → strong
  const bStrong = stat.winner !== 'A';

  return (
    <View>
      <View style={battle.head}>
        <Text style={[battle.val, aStrong ? battle.valStrong : battle.valDim]}>{stat.valueA}</Text>
        <Text style={battle.label}>{stat.label}</Text>
        <Text style={[battle.val, bStrong ? battle.valStrong : battle.valDim]}>{stat.valueB}</Text>
      </View>
      <View style={battle.track}>
        <View style={[battle.half, battle.halfLeft]}>
          <View
            style={[
              battle.barLeft,
              { width: `${stat.valueA}%`, backgroundColor: aStrong ? COLORS.navy : BAR_DIM } as object,
            ]}
          />
        </View>
        <View style={battle.half}>
          <View
            style={[
              battle.barRight,
              { width: `${stat.valueB}%`, backgroundColor: bStrong ? COLORS.navy : BAR_DIM } as object,
            ]}
          />
        </View>
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
                tintColor={COLORS.navy}
                size={22}
                resizeMode="scaleAspectFit"
                style={styles.headerIcon}
                fallback={<Ionicons name="share" size={23} color={COLORS.navy} />}
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
              onSwapA={() =>
                router.replace(
                  `/compare/${opponent}/pick?name=${encodeURIComponent(statsB.name)}`,
                )
              }
              onSwapB={() =>
                router.replace(`/compare/${hero}/pick?name=${encodeURIComponent(statsA.name)}`)
              }
            />
          </View>

          <View style={styles.verdictBlock}>
            <VerdictReveal verdict={verdict} />
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.battleWrap}>
            {result.stats.map((stat) => (
              <StatBattleRow key={stat.key} stat={stat} />
            ))}
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
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
});

const battle = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  val: { fontVariant: ['tabular-nums'] },
  valStrong: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.navy,
  },
  valDim: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(41,60,67,0.4)',
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: '#9a9388',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  track: { flexDirection: 'row', height: 9, gap: 6 },
  half: { flex: 1, flexDirection: 'row' },
  halfLeft: { justifyContent: 'flex-end' },
  barLeft: { height: '100%', borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  barRight: { height: '100%', borderTopRightRadius: 5, borderBottomRightRadius: 5 },
});
