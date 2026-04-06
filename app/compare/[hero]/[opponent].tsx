import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHeroById, heroRowToCharacterData } from '../../../src/lib/db/heroes';
import { fetchHeroStats, generateVerdict } from '../../../src/lib/api';
import { heroImageSource } from '../../../src/constants/heroImages';
import { compareStats } from '../../../src/lib/compare';
import type { StatResult } from '../../../src/lib/compare';
import type { HeroStats } from '../../../src/types';
import { COLORS } from '../../../src/constants/colors';
import { ClashPortraits } from '../../../src/components/compare/ClashPortraits';

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
          <View style={[battle.barLeft, { width: `${stat.valueA}%`, backgroundColor: aWins ? winColor : dimColor } as object]} />
        </View>
      </View>
      <Text style={battle.label}>{stat.label}</Text>
      <View style={[battle.side, battle.sideRight]}>
        <View style={battle.track}>
          <View style={[battle.barRight, { width: `${stat.valueB}%`, backgroundColor: bWins ? winColor : dimColor } as object]} />
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
  const [verdict, setVerdict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadHeroStats(hero), loadHeroStats(opponent)])
      .then(([a, b]) => {
        setStatsA(a);
        setStatsB(b);
        const result = compareStats(a.name, a.powerstats, b.name, b.powerstats);
        const psA = Object.fromEntries(
          Object.entries(a.powerstats).map(([k, v]) => [k, parseInt(v, 10) || 0]),
        );
        const psB = Object.fromEntries(
          Object.entries(b.powerstats).map(([k, v]) => [k, parseInt(v, 10) || 0]),
        );
        generateVerdict({
          heroA: a.name, heroB: b.name,
          winsA: result.winsA, winsB: result.winsB,
          statsA: psA, statsB: psB,
        }).then(setVerdict);
      })
      .catch(() => setError('Could not load hero data.'));
  }, [hero, opponent]);

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!statsA || !statsB) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  const result = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
  const imageA = heroImageSource(hero, statsA.image.url);
  const imageB = heroImageSource(opponent, statsB.image.url);
  const overallWinner: 'A' | 'B' | 'tie' =
    result.winsA > result.winsB ? 'A' : result.winsB > result.winsA ? 'B' : 'tie';

  const handleShare = () => {
    Share.share({
      message: `${statsA.name} vs ${statsB.name} — ${verdict ?? result.verdict}. Check it out on Hero app!`,
    }).catch(() => {});
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.beige} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>vs</Text>
        <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.beige} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <ClashPortraits
          imageA={imageA}
          imageB={imageB}
          nameA={statsA.name}
          nameB={statsB.name}
          winner={overallWinner}
          height={280}
        />

        <View style={styles.verdictWrap}>
          {verdict ? (
            <Text style={styles.verdict}>{verdict}</Text>
          ) : (
            <Text style={styles.verdictPlaceholder}>{result.verdict}</Text>
          )}
        </View>

        <View style={styles.battleWrap}>
          {result.stats.map((stat) => (
            <StatBattleRow key={stat.key} stat={stat} />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.replace(`/compare/${hero}/pick?name=${encodeURIComponent(statsA.name)}`)}
          activeOpacity={0.8}
          style={styles.compareAnotherBtn}
        >
          <Text style={styles.compareAnotherText}>Compare {statsA.name} with someone else →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { padding: 6 },
  topBarTitle: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  verdictWrap: {
    backgroundColor: COLORS.navy,
    paddingVertical: 18,
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
  battleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  compareAnotherBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 32,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  compareAnotherText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.65)',
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
  barLeft:  { position: 'absolute', right: 0, top: 0, bottom: 0, borderRadius: 4 },
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
